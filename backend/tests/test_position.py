"""Vị trí xem gần nhất: lưu theo mã bài, trả về trong progress, đi theo bài khi admin đổi thứ tự, mất khi bài bị xóa."""
from tests.test_api import verify


def _admin(client):
    r = client.post("/api/auth/login", json={"email": "admin@example.com", "password": "admin123"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _student(client, email):
    r = client.post("/api/auth/register", json={"email": email, "full_name": "HV", "password": "MatKhau2024"})
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    verify(client, r.json()["access_token"], email)
    return h


def _lesson(t):
    return {"title": t, "duration": "1:00"}


def test_position_follows_lesson(client):
    admin = _admin(client)
    r = client.post("/api/admin/courses", json={
        "slug": "khoa-vi-tri", "title": "Khóa vị trí", "category": "video", "price": 0, "short": "s", "description": "d", "includes": [],
        "lessons": [_lesson("A"), _lesson("B"), _lesson("C")],
    }, headers=admin)
    assert r.status_code == 201, r.text
    cid = r.json()["id"]
    slug = "khoa-vi-tri"
    h = _student(client, "vitri@example.com")

    # chưa ghi danh → 403; chưa đăng nhập → 401
    assert client.put(f"/api/courses/{slug}/position", json={"index": 1, "seconds": 30}).status_code == 401
    assert client.put(f"/api/courses/{slug}/position", json={"index": 1, "seconds": 30}, headers=h).status_code == 403
    assert client.post(f"/api/courses/{slug}/enroll", headers=h).status_code == 201
    p = client.get(f"/api/courses/{slug}/progress", headers=h).json()
    assert p["last_index"] is None and p["last_seconds"] == 0

    # lưu vị trí bài B giây 95
    r = client.put(f"/api/courses/{slug}/position", json={"index": 1, "seconds": 95}, headers=h)
    assert r.status_code == 200 and r.json()["last_index"] == 1 and r.json()["last_seconds"] == 95
    assert client.put(f"/api/courses/{slug}/position", json={"index": 9, "seconds": 0}, headers=h).status_code == 404
    assert client.put(f"/api/courses/{slug}/position", json={"index": 0, "seconds": -1}, headers=h).status_code == 422

    # "Khóa học của tôi" cũng mang last_index
    mine = next(c for c in client.get("/api/courses/me/enrolled", headers=h).json() if c["slug"] == slug)
    assert mine["progress"]["last_index"] == 1

    # admin đảo thứ tự → vị trí đi theo bài B (giờ ở 0)
    assert client.patch(f"/api/admin/courses/{cid}", json={"lessons": [_lesson("B"), _lesson("A"), _lesson("C")]}, headers=admin).status_code == 200
    p = client.get(f"/api/courses/{slug}/progress", headers=h).json()
    assert p["last_index"] == 0 and p["last_seconds"] == 95

    # xóa bài B → không còn vị trí, giây về 0
    assert client.patch(f"/api/admin/courses/{cid}", json={"lessons": [_lesson("A"), _lesson("C")]}, headers=admin).status_code == 200
    p = client.get(f"/api/courses/{slug}/progress", headers=h).json()
    assert p["last_index"] is None and p["last_seconds"] == 0
