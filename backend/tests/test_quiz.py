"""Trắc nghiệm: đề không lộ đáp án, chấm điểm, lưu lần làm, đánh dấu hoàn thành, phân quyền."""
import json

from tests.test_api import verify

QUIZ = {"pass_percent": 60, "questions": [
    {"q": "1 + 1 = ?", "options": ["1", "2", "3"], "answer": 1, "explain": "Cộng cơ bản"},
    {"q": "Thủ đô Việt Nam?", "options": ["Hà Nội", "Huế"], "answer": 0},
    {"q": "2 × 3 = ?", "options": ["5", "6", "7", "8"], "answer": 1, "explain": "Nhân"},
]}
COURSE = {
    "slug": "quiz-test", "title": "Khóa quiz", "category": "quiz", "price": 0, "short": "s", "description": "d", "includes": [],
    "lessons": [
        {"title": "Bài mở", "duration": "05:00", "free": True, "quiz": QUIZ},
        {"title": "Bài khoá", "duration": "05:00", "quiz": QUIZ},
        {"title": "Bài không quiz", "duration": "05:00", "free": True},
    ],
}


def _admin(client):
    r = client.post("/api/auth/login", json={"email": "admin@example.com", "password": "admin123"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _user(client, email):
    r = client.post("/api/auth/register", json={"email": email, "full_name": "Q", "password": "MatKhau2024"})
    verify(client, r.json()["access_token"], email)
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_quiz_validation_and_no_leak(client):
    admin = _admin(client)
    bad = {**COURSE, "slug": "quiz-bad", "lessons": [{"title": "x", "duration": "1:00", "quiz": {"questions": [{"q": "?", "options": ["a", "b"], "answer": 5}]}}]}
    assert client.post("/api/admin/courses", json=bad, headers=admin).status_code == 422
    r = client.post("/api/admin/courses", json=COURSE, headers=admin)
    assert r.status_code == 201, r.text
    assert r.json()["lessons"][0]["quiz"]["questions"][0]["answer"] == 1  # admin thấy đáp án

    # public: chỉ cờ + số câu, không có đáp án/giải thích ở bất kỳ đâu
    for url in ("/api/courses/quiz-test", "/api/courses/export"):
        dump = json.dumps(client.get(url).json(), ensure_ascii=False)
        assert '"answer"' not in dump and "Cộng cơ bản" not in dump and '"quiz":' not in dump
    d = client.get("/api/courses/quiz-test").json()
    assert d["lessons"][0]["has_quiz"] is True and d["lessons"][0]["quiz_count"] == 3 and d["lessons"][2]["has_quiz"] is False

    q = client.get("/api/courses/quiz-test/lessons/0/quiz").json()  # bài free: khách vẫn xem đề
    assert q["total"] == 3 and q["pass_percent"] == 60 and [x["q"] for x in q["questions"]][0] == "1 + 1 = ?"
    assert "answer" not in json.dumps(q) and "explain" not in json.dumps(q)
    assert client.get("/api/courses/quiz-test/lessons/2/quiz").status_code == 404
    assert client.get("/api/courses/quiz-test/lessons/1/quiz").status_code == 401  # bài khoá: chưa đăng nhập


def test_submit_scores_and_marks_progress(client):
    h = _user(client, "quiz1@example.com")
    # khách làm bài free: được chấm, không lưu
    r = client.post("/api/courses/quiz-test/lessons/0/quiz/submit", json={"answers": [1, 0, 1]})
    assert r.status_code == 200 and r.json()["score"] == 3 and r.json()["passed"] is True and r.json()["saved"] is False
    # sai số câu → 422
    assert client.post("/api/courses/quiz-test/lessons/0/quiz/submit", json={"answers": [1]}, headers=h).status_code == 422

    # đã đăng nhập nhưng chưa ghi danh → bài khoá bị 403, bài free vẫn làm được và lưu nhưng không đánh dấu hoàn thành
    assert client.get("/api/courses/quiz-test/lessons/1/quiz", headers=h).status_code == 403
    r = client.post("/api/courses/quiz-test/lessons/0/quiz/submit", json={"answers": [1, 1, None]}, headers=h).json()
    assert r["score"] == 1 and r["percent"] == 33 and r["passed"] is False and r["saved"] is True and r["lesson_completed"] is False
    assert r["results"][1] == {"index": 1, "chosen": 1, "answer": 0, "correct": False, "explain": ""}
    assert r["results"][2]["chosen"] is None and r["results"][2]["explain"] == "Nhân"

    # ghi danh → làm bài khoá, đạt → bài 1 hoàn thành trong progress
    assert client.post("/api/courses/quiz-test/enroll", headers=h).status_code == 201
    r = client.post("/api/courses/quiz-test/lessons/1/quiz/submit", json={"answers": [1, 0, 9]}, headers=h).json()  # 9 ngoài phạm vi → coi như bỏ trống
    assert r["score"] == 2 and r["percent"] == 67 and r["passed"] is True and r["lesson_completed"] is True
    assert r["results"][2]["chosen"] is None
    assert 1 in client.get("/api/courses/quiz-test/progress", headers=h).json()["completed"]

    # lịch sử: bài 0 có 1 lần (33%), làm thêm lần đạt → best cập nhật
    a = client.get("/api/courses/quiz-test/lessons/0/quiz/attempts", headers=h).json()
    assert a["count"] == 1 and a["best"]["percent"] == 33
    client.post("/api/courses/quiz-test/lessons/0/quiz/submit", json={"answers": [1, 0, 1]}, headers=h)
    a = client.get("/api/courses/quiz-test/lessons/0/quiz/attempts", headers=h).json()
    assert a["count"] == 2 and a["best"]["percent"] == 100 and a["last"]["percent"] == 100
    assert client.get("/api/courses/quiz-test/lessons/0/quiz/attempts").status_code == 401


def test_seed_quizzes_present_and_hidden(client):
    """Seed mẫu: các khóa Trắc nghiệm có đề ở bài 0 (xem thử) → khách làm được; đáp án không lộ ở export."""
    from app.database import SessionLocal
    from app.seed import apply_seed_quizzes

    d = client.get("/api/courses/trac-nghiem-triet-hoc-mac-lenin").json()
    assert d["lessons"][0]["has_quiz"] and d["lessons"][0]["quiz_count"] == 5 and d["lessons"][1]["quiz_count"] == 5
    q = client.get("/api/courses/trac-nghiem-triet-hoc-mac-lenin/lessons/0/quiz").json()
    assert q["total"] == 5 and "answer" not in json.dumps(q)
    r = client.post("/api/courses/trac-nghiem-triet-hoc-mac-lenin/lessons/0/quiz/submit", json={"answers": [1, 1, 1, 2, 2]}).json()
    assert r["score"] == 5 and r["passed"] is True
    quiz_courses = [c for c in client.get("/api/courses", params={"category": "quiz"}).json()]
    assert len(quiz_courses) >= 8
    export = {c["slug"]: c for c in client.get("/api/courses/export").json()}
    assert all(export[c["slug"]]["lessons"][0]["has_quiz"] for c in quiz_courses)
    assert '"answer"' not in json.dumps(export)

    # idempotent: DB đã có đề → không đổi gì; overwrite → ghi lại đúng số bài có đề
    db = SessionLocal()
    assert apply_seed_quizzes(db) == 0
    assert apply_seed_quizzes(db, overwrite=True) == 9
    db.close()
