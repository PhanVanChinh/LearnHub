"""Mã cố định cho bài học: trường `id` trong JSON `course.lessons`.

Tiến độ, trắc nghiệm, chứng nhận gắn với mã này thay vì số thứ tự bài, nên admin chèn / xóa / đổi thứ tự
bài không làm lệch dữ liệu học viên. Mã do server sinh; form admin không cần biết tới nó.
"""
import secrets

from sqlalchemy.orm import Session

from .models import Course


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
