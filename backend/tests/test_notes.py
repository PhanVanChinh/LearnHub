"""Ghi chú theo bài: riêng từng người, luật truy cập như video, rỗng = xóa, đi theo mã bài khi admin đổi thứ tự."""
from tests.test_api import verify


def _admin(client):
    r = client.post("/api/auth/login", json={"email": "admin@example.com", "password": "admin123"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _student(client, email):
    r = client.post("/api/auth/register", json={"email": email, "full_name": "HV", "password": "MatKhau2024"})
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    verify(client, r.json()["access_token"], email)
    return h


def test_notes_crud_and_access(client):
    admin = _admin(client)
    r = client.post("/api/admin/courses", json={
        "slug": "khoa-ghi-chu", "title": "Khóa ghi chú", "category": "pdf", "price": 0, "short": "s", "description": "d", "includes": [],
        "lessons": [{"title": "Xem thử", "duration": "1:00", "free": True}, {"title": "Bài khóa", "duration": "1:00"}],
    }, headers=admin)
    assert r.status_code == 201, r.text
    cid = r.json()["id"]
    slug = "khoa-ghi-chu"
    h = _student(client, "note1@example.com")

    # chưa đăng nhập → 401 kể cả bài free; đã đăng nhập chưa ghi danh → bài free được, bài khóa 403
    assert client.get(f"/api/courses/{slug}/lessons/0/note").status_code == 401
    assert client.get(f"/api/courses/{slug}/lessons/0/note", headers=h).json()["text"] == ""
    assert client.put(f"/api/courses/{slug}/lessons/1/note", json={"text": "x"}, headers=h).status_code == 403
    assert client.post(f"/api/courses/{slug}/enroll", headers=h).status_code == 201

    # lưu, đọc lại, cập nhật
    r = client.put(f"/api/courses/{slug}/lessons/1/note", json={"text": "  Ghi nhớ: con trỏ là địa chỉ.  "}, headers=h)
    assert r.status_code == 200 and r.json()["text"] == "Ghi nhớ: con trỏ là địa chỉ." and r.json()["updated_at"]
    assert client.get(f"/api/courses/{slug}/lessons/1/note", headers=h).json()["title"] == "Bài khóa"
    client.put(f"/api/courses/{slug}/lessons/0/note", json={"text": "Bài mở đầu"}, headers=h)
    notes = client.get(f"/api/courses/{slug}/notes", headers=h).json()
    assert [n["index"] for n in notes] == [0, 1]

    # người khác không thấy
    other = _student(client, "note2@example.com")
    assert client.get(f"/api/courses/{slug}/lessons/0/note", headers=other).json()["text"] == ""
    assert client.get(f"/api/courses/{slug}/notes", headers=other).json() == []

    # admin đảo thứ tự bài → ghi chú đi theo bài
    r = client.patch(f"/api/admin/courses/{cid}", json={"lessons": [{"title": "Bài khóa", "duration": "1:00"}, {"title": "Xem thử", "duration": "1:00", "free": True}]}, headers=admin)
    assert r.status_code == 200
    assert client.get(f"/api/courses/{slug}/lessons/0/note", headers=h).json()["text"] == "Ghi nhớ: con trỏ là địa chỉ."
    assert client.get(f"/api/courses/{slug}/lessons/1/note", headers=h).json()["text"] == "Bài mở đầu"

    # xuất dữ liệu có ghi chú; rỗng = xóa; quá dài → 422
    data = client.get("/api/account/export", headers=h).json()
    assert {n["lesson_title"] for n in data["lesson_notes"]} == {"Bài khóa", "Xem thử"}
    assert client.put(f"/api/courses/{slug}/lessons/1/note", json={"text": "   "}, headers=h).json()["text"] == ""
    assert len(client.get(f"/api/courses/{slug}/notes", headers=h).json()) == 1
    assert client.put(f"/api/courses/{slug}/lessons/1/note", json={"text": "x" * 20_001}, headers=h).status_code == 422
