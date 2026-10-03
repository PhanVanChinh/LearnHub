"""Tiến độ gắn với mã bài: admin chèn / xóa / đổi thứ tự bài không làm lệch tiến độ, trắc nghiệm, chứng nhận.
Kèm test chép dữ liệu cũ (theo số thứ tự) sang bảng mới lúc khởi động."""
from datetime import datetime

from app.database import SessionLocal
from app.lessons import migrate_lesson_refs
from app.models import Course, LessonCompletion, LessonProgress, QuizAttempt, User
from tests.test_api import verify

QUIZ = {"pass_percent": 50, "questions": [{"q": "1+1?", "options": ["1", "2"], "answer": 1}]}


def _admin(client):
    r = client.post("/api/auth/login", json={"email": "admin@example.com", "password": "admin123"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _student(client, email):
    r = client.post("/api/auth/register", json={"email": email, "full_name": "HV", "password": "MatKhau2024"})
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    verify(client, r.json()["access_token"], email)
    return h


def _lesson(title, **kw):
    return {"title": title, "duration": "1:00", **kw}


def test_progress_survives_lesson_edits(client):
    admin = _admin(client)
    r = client.post("/api/admin/courses", json={
        "slug": "khoa-on-dinh", "title": "Khóa ổn định", "category": "pdf", "price": 0, "short": "s", "description": "d", "includes": [],
        "lessons": [_lesson("Mở đầu"), _lesson("Chương 1", quiz=QUIZ), _lesson("Chương 2"), _lesson("Ôn tập")],
    }, headers=admin)
    assert r.status_code == 201, r.text
    cid = r.json()["id"]
    slug = "khoa-on-dinh"
    h = _student(client, "ondinh@example.com")
    assert client.post(f"/api/courses/{slug}/enroll", headers=h).status_code == 201

    # hoàn thành "Mở đầu" (0) và đạt trắc nghiệm "Chương 1" (1) → 2/4
    assert client.put(f"/api/courses/{slug}/lessons/0/complete", headers=h).json()["completed"] == [0]
    q = client.post(f"/api/courses/{slug}/lessons/1/quiz/submit", json={"answers": [1]}, headers=h).json()
    assert q["passed"] and q["lesson_completed"]
    p = client.get(f"/api/courses/{slug}/progress", headers=h).json()
    assert p["completed"] == [0, 1] and p["percent"] == 50 and p["next_index"] == 2

    # admin chèn bài mới lên đầu và đảo Chương 1 / Chương 2 → tiến độ đi theo bài, không theo vị trí
    r = client.patch(f"/api/admin/courses/{cid}", json={"lessons": [
        _lesson("Giới thiệu khóa"), _lesson("Mở đầu"), _lesson("Chương 2"), _lesson("Chương 1", quiz=QUIZ), _lesson("Ôn tập")]}, headers=admin)
    assert r.status_code == 200, r.text
    p = client.get(f"/api/courses/{slug}/progress", headers=h).json()
    assert p["completed"] == [1, 3] and p["total"] == 5 and p["percent"] == 40 and p["next_index"] == 0
    # lịch sử trắc nghiệm cũng đi theo bài "Chương 1" (giờ ở vị trí 3)
    assert client.get(f"/api/courses/{slug}/lessons/3/quiz/attempts", headers=h).json()["count"] == 1

    # xóa "Mở đầu" (đã hoàn thành) → tiến độ của nó biến mất, không còn tính; chứng nhận chưa được cấp
    r = client.patch(f"/api/admin/courses/{cid}", json={"lessons": [_lesson("Giới thiệu khóa"), _lesson("Chương 2"), _lesson("Chương 1", quiz=QUIZ)]}, headers=admin)
    assert r.status_code == 200
    p = client.get(f"/api/courses/{slug}/progress", headers=h).json()
    assert p["completed"] == [2] and p["total"] == 3 and p["percent"] == 33
    assert client.post(f"/api/courses/{slug}/certificate", headers=h).status_code == 400

    # xóa bớt bài KHÔNG làm người học "tự nhiên" đạt 100%: hoàn thành nốt mới được cấp
    for i in (0, 1):
        client.put(f"/api/courses/{slug}/lessons/{i}/complete", headers=h)
    assert client.get(f"/api/courses/{slug}/progress", headers=h).json()["percent"] == 100
    assert client.post(f"/api/courses/{slug}/certificate", headers=h).status_code == 200

    # bỏ đánh dấu theo vị trí hiện tại cũng đúng bài
    assert client.delete(f"/api/courses/{slug}/lessons/2/complete", headers=h).json()["completed"] == [0, 1]

    # xuất dữ liệu cá nhân ghi mã bài + tiêu đề
    # xuất dữ liệu cá nhân ghi mã bài + tiêu đề; bài đã bị admin xóa ("Mở đầu") vẫn xuất với tiêu đề rỗng (dữ liệu của người dùng)
    data = client.get("/api/account/export", headers=h).json()
    titles = {x["lesson_title"] for x in data["lesson_progress"]}
    assert titles == {"Giới thiệu khóa", "Chương 2", None} and all(x["lesson_id"] for x in data["lesson_progress"])
    assert data["quiz_attempts"][0]["lesson_title"] == "Chương 1"


def test_migrate_legacy_progress_rows(client):
    """Dòng cũ theo số thứ tự (bảng lesson_progress, quiz_attempts.lesson_id NULL) được chép sang mã bài; chạy lại không nhân đôi."""
    db = SessionLocal()
    try:
        course = db.query(Course).filter_by(slug="khoa-on-dinh").first()
        user = db.query(User).filter_by(email="ondinh@example.com").first()
        before = db.query(LessonCompletion).filter_by(user_id=user.id, course_id=course.id).count()
        db.add(LessonProgress(user_id=user.id, course_id=course.id, lesson_index=2, completed_at=datetime(2026, 1, 2)))  # "Chương 1"
        db.add(LessonProgress(user_id=user.id, course_id=course.id, lesson_index=99))  # chỉ số không còn bài → bỏ qua
        db.add(QuizAttempt(user_id=user.id, course_id=course.id, lesson_index=2, lesson_id=None, score=1, total=1, percent=100, passed=True))
        db.commit()
        added, filled = migrate_lesson_refs(db)
        assert (added, filled) == (1, 1)
        rows = db.query(LessonCompletion).filter_by(user_id=user.id, course_id=course.id).all()
        assert len(rows) == before + 1
        new = next(r for r in rows if r.lesson_id == course.lessons[2]["id"])
        assert new.completed_at == datetime(2026, 1, 2)
        assert db.query(QuizAttempt).filter(QuizAttempt.lesson_id.is_(None)).count() == 0
        assert migrate_lesson_refs(db) == (0, 0)
    finally:
        db.close()
