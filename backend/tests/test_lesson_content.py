"""Nội dung bài học dạng Markdown: bài free công khai, bài khóa chỉ lộ cờ has_content cho tới khi ghi danh (như video)."""
from tests.test_api import verify

MD = "# Chương 1\n\nĐoạn mở đầu với `code`.\n\n```c\nint main(void) { return 0; }\n```"


def _admin(client):
    r = client.post("/api/auth/login", json={"email": "admin@example.com", "password": "admin123"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_lesson_content_access(client):
    admin = _admin(client)
    r = client.post("/api/admin/courses", json={
        "slug": "khoa-noi-dung", "title": "Khóa bài đọc", "category": "pdf", "price": 0, "short": "s", "description": "d", "includes": [],
        "lessons": [{"title": "Xem thử", "duration": "1:00", "free": True, "content": MD},
                    {"title": "Bài khóa", "duration": "2:00", "content": "Nội dung chỉ dành cho học viên."},
                    {"title": "Chưa có nội dung", "duration": "3:00", "content": "   "}],
    }, headers=admin)
    assert r.status_code == 201, r.text

    # public: bài free giữ nguyên markdown; bài khóa ẩn nội dung nhưng có cờ; nội dung toàn khoảng trắng = không có
    ls = client.get("/api/courses/khoa-noi-dung").json()["lessons"]
    assert ls[0]["content"] == MD and ls[0]["has_content"] is True
    assert ls[1]["content"] is None and ls[1]["has_content"] is True
    assert ls[2]["content"] is None and ls[2]["has_content"] is False
    # export (dùng để build tĩnh) cũng không lộ nội dung bài khóa
    exp = next(c for c in client.get("/api/courses/export").json() if c["slug"] == "khoa-noi-dung")
    assert exp["lessons"][1]["content"] is None and exp["lessons"][0]["content"] == MD

    # ghi danh → thấy nội dung bài khóa
    email = "doc@example.com"
    r = client.post("/api/auth/register", json={"email": email, "full_name": "Doc", "password": "MatKhau2024"})
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    verify(client, r.json()["access_token"], email)
    assert client.get("/api/courses/khoa-noi-dung", headers=h).json()["lessons"][1]["content"] is None
    assert client.post("/api/courses/khoa-noi-dung/enroll", headers=h).status_code == 201
    assert client.get("/api/courses/khoa-noi-dung", headers=h).json()["lessons"][1]["content"] == "Nội dung chỉ dành cho học viên."


def test_lesson_content_too_long_rejected(client):
    admin = _admin(client)
    r = client.post("/api/admin/courses", json={
        "slug": "khoa-qua-dai", "title": "x", "category": "pdf", "price": 0, "short": "s", "description": "d", "includes": [],
        "lessons": [{"title": "a", "duration": "1:00", "content": "x" * 50_001}],
    }, headers=admin)
    assert r.status_code == 422
