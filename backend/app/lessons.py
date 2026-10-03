"""Mã cố định cho bài học: trường `id` trong JSON `course.lessons`.

Tiến độ, trắc nghiệm, chứng nhận gắn với mã này thay vì số thứ tự bài, nên admin chèn / xóa / đổi thứ tự
bài không làm lệch dữ liệu học viên. Mã do server sinh; form admin không cần biết tới nó.
"""
import secrets

from sqlalchemy.orm import Session

from .models import Course, LessonCompletion, LessonProgress, QuizAttempt


def new_lesson_id() -> str:
    return secrets.token_hex(4)  # 8 ký tự hex, đủ phân biệt trong một khóa


def _norm(title: str | None) -> str:
    return " ".join((title or "").split()).casefold()


def assign_lesson_ids(lessons: list[dict], existing: list[dict] | None = None) -> list[dict]:
    """Gán `id` cho danh sách bài mới gửi lên, giữ mã cũ khi nhận ra bài cũ. Thứ tự ưu tiên:
    1. bài gửi lên đã có `id` thuộc khóa này → giữ;
    2. cùng tiêu đề với một bài cũ chưa được nhận → lấy mã bài đó (chèn, xóa, đổi thứ tự đều đúng);
    3. số bài không đổi và bài cũ ở cùng vị trí chưa được nhận → lấy mã đó (đổi tên tại chỗ);
    4. còn lại → mã mới.
    Trả về bản sao, không sửa list truyền vào."""
    existing = existing or []
    old_ids = {l.get("id") for l in existing if l.get("id")}
    taken: set[str] = set()
    ids: list[str | None] = [None] * len(lessons)

    for i, l in enumerate(lessons):  # 1
        lid = l.get("id")
        if lid and lid in old_ids and lid not in taken:
            ids[i] = lid
            taken.add(lid)

    by_title: dict[str, list[str]] = {}
    for l in existing:
        if l.get("id"):
            by_title.setdefault(_norm(l.get("title")), []).append(l["id"])
    for i, l in enumerate(lessons):  # 2
        if ids[i]:
            continue
        for lid in by_title.get(_norm(l.get("title")), []):
            if lid not in taken:
                ids[i] = lid
                taken.add(lid)
                break

    if len(lessons) == len(existing):  # 3
        for i, l in enumerate(lessons):
            if ids[i]:
                continue
            lid = existing[i].get("id")
            if lid and lid not in taken:
                ids[i] = lid
                taken.add(lid)

    for i in range(len(lessons)):  # 4
        if not ids[i]:
            lid = new_lesson_id()
            while lid in taken or lid in old_ids:
                lid = new_lesson_id()
            ids[i] = lid
            taken.add(lid)

    return [{**l, "id": lid} for l, lid in zip(lessons, ids)]


def ensure_lesson_ids(db: Session) -> int:
    """Khởi động: gán mã cho bài học của dữ liệu cũ (seed, backup) chưa có `id`. Trả về số khóa đã cập nhật."""
    changed = 0
    for course in db.query(Course).all():
        lessons = course.lessons or []
        if lessons and any(not l.get("id") for l in lessons):
            course.lessons = assign_lesson_ids(lessons, lessons)  # gán list mới để SQLAlchemy nhận ra JSON đã đổi
            changed += 1
    if changed:
        db.commit()
    return changed


def lesson_id_at(course: Course, index: int) -> str | None:
    lessons = course.lessons or []
    return lessons[index].get("id") if 0 <= index < len(lessons) else None


def migrate_lesson_refs(db: Session) -> tuple[int, int]:
    """Khởi động (sau ensure_lesson_ids): chuyển dữ liệu theo số thứ tự sang mã bài.
    - lesson_progress (cũ) → lesson_completions: thêm dòng còn thiếu, bỏ qua chỉ số không còn bài.
    - quiz_attempts.lesson_id NULL → điền từ vị trí lúc làm bài.
    Chạy lại nhiều lần vô hại (idempotent) — khôi phục backup cũ rồi khởi động lại vẫn đúng.
    Trả (số completion thêm, số attempt điền)."""
    courses = {c.id: c for c in db.query(Course).all()}
    have = {(r.user_id, r.course_id, r.lesson_id) for r in db.query(LessonCompletion).all()}
    added = 0
    for p in db.query(LessonProgress).all():
        course = courses.get(p.course_id)
        lid = lesson_id_at(course, p.lesson_index) if course else None
        if lid and (p.user_id, p.course_id, lid) not in have:
            db.add(LessonCompletion(user_id=p.user_id, course_id=p.course_id, lesson_id=lid, completed_at=p.completed_at))
            have.add((p.user_id, p.course_id, lid))
            added += 1
    filled = 0
    for a in db.query(QuizAttempt).filter(QuizAttempt.lesson_id.is_(None)).all():
        course = courses.get(a.course_id)
        lid = lesson_id_at(course, a.lesson_index) if course else None
        if lid:
            a.lesson_id = lid
            filled += 1
    if added or filled:
        db.commit()
    return added, filled
