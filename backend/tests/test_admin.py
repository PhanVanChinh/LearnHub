"""Test CRUD admin: khóa học, người dùng, ghi danh, thống kê, và phân quyền."""
import pytest


@pytest.fixture(scope="module")
def admin(client):
    r = client.post("/api/auth/login", json={"email": "admin@example.com", "password": "admin123"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="module")
def user(client):
    r = client.post("/api/auth/register", json={"email": "user@test.vn", "full_name": "User", "password": "secret123"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}, r.json()["user"]["id"]


NEW_COURSE = {
    "slug": "khoa-hoc-moi", "title": "Khóa học mới", "category": "video", "price": 0,
    "short": "Mô tả ngắn", "description": "Mô tả dài", "includes": ["A", "B"],
    "lessons": [{"title": "Bài 1", "duration": "10:00", "free": True}],
}


def test_requires_admin(client, user):
    headers, _ = user
    assert client.get("/api/admin/courses").status_code == 401
    assert client.get("/api/admin/courses", headers=headers).status_code == 403
    assert client.post("/api/admin/courses", json=NEW_COURSE, headers=headers).status_code == 403
    assert client.get("/api/admin/users", headers=headers).status_code == 403
    assert client.get("/api/admin/stats", headers=headers).status_code == 403


def test_stats(client, admin):
    s = client.get("/api/admin/stats", headers=admin).json()
    assert s["courses"] >= 20 and s["users"] >= 2 and s["admins"] >= 1
    assert s["free_courses"] + s["paid_courses"] == s["courses"]


def test_course_crud(client, admin):
    # create
    r = client.post("/api/admin/courses", json=NEW_COURSE, headers=admin)
    assert r.status_code == 201, r.text
    c = r.json()
    cid = c["id"]
    assert c["tags"] == ["video", "free"]  # tự thêm category + free
    assert c["enrollment_count"] == 0

    # slug trùng
    assert client.post("/api/admin/courses", json=NEW_COURSE, headers=admin).status_code == 409
    # slug sai định dạng
    assert client.post("/api/admin/courses", json={**NEW_COURSE, "slug": "Sai Slug"}, headers=admin).status_code == 422

    # public thấy được
    assert client.get("/api/courses/khoa-hoc-moi").status_code == 200

    # read + list + search
    assert client.get(f"/api/admin/courses/{cid}", headers=admin).json()["slug"] == "khoa-hoc-moi"
    lst = client.get("/api/admin/courses", params={"q": "khoa-hoc-moi"}, headers=admin).json()
    assert lst["total"] == 1 and lst["items"][0]["id"] == cid

    # update một phần: đổi giá → mất tag free
    r = client.patch(f"/api/admin/courses/{cid}", json={"price": 50000, "featured": True}, headers=admin)
    assert r.status_code == 200, r.text
    assert r.json()["price"] == 50000 and r.json()["featured"] is True and "free" not in r.json()["tags"]
    assert r.json()["title"] == "Khóa học mới"  # trường khác giữ nguyên

    # body rỗng
    assert client.patch(f"/api/admin/courses/{cid}", json={}, headers=admin).status_code == 400
    # đổi slug trùng với khóa khác
    other = client.get("/api/courses").json()[0]["slug"]
    assert client.patch(f"/api/admin/courses/{cid}", json={"slug": other}, headers=admin).status_code == 409

    # delete
    assert client.delete(f"/api/admin/courses/{cid}", headers=admin).status_code == 204
    assert client.get(f"/api/admin/courses/{cid}", headers=admin).status_code == 404
    assert client.get("/api/courses/khoa-hoc-moi").status_code == 404


def test_user_crud(client, admin, user):
    _, uid = user
    # list + search
    lst = client.get("/api/admin/users", params={"q": "user@test"}, headers=admin).json()
    assert lst["total"] == 1 and lst["items"][0]["id"] == uid and lst["items"][0]["is_active"] is True

    # create
    r = client.post("/api/admin/users", json={"email": "Mod@Test.vn", "full_name": "Mod", "password": "secret123", "role": "admin"}, headers=admin)
    assert r.status_code == 201, r.text
    mid = r.json()["id"]
    assert r.json()["email"] == "mod@test.vn" and r.json()["role"] == "admin"
    assert client.post("/api/admin/users", json={"email": "mod@test.vn", "full_name": "x", "password": "secret123"}, headers=admin).status_code == 409

    # update: thăng quyền + đổi mật khẩu + khoá
    r = client.patch(f"/api/admin/users/{uid}", json={"role": "admin", "password": "newpass123"}, headers=admin)
    assert r.status_code == 200 and r.json()["role"] == "admin"
    assert client.post("/api/auth/login", json={"email": "user@test.vn", "password": "newpass123"}).status_code == 200
    r = client.patch(f"/api/admin/users/{uid}", json={"role": "user", "is_active": False}, headers=admin)
    assert r.json()["role"] == "user" and r.json()["is_active"] is False
    assert client.post("/api/auth/login", json={"email": "user@test.vn", "password": "newpass123"}).status_code == 403
    client.patch(f"/api/admin/users/{uid}", json={"is_active": True}, headers=admin)

    # không tự hạ quyền / tự khoá / tự xoá
    me = client.get("/api/auth/me", headers=admin).json()["id"]
    assert client.patch(f"/api/admin/users/{me}", json={"role": "user"}, headers=admin).status_code == 400
    assert client.patch(f"/api/admin/users/{me}", json={"is_active": False}, headers=admin).status_code == 400
    assert client.delete(f"/api/admin/users/{me}", headers=admin).status_code == 400

    # delete
    assert client.delete(f"/api/admin/users/{mid}", headers=admin).status_code == 204
    assert client.get(f"/api/admin/users/{mid}", headers=admin).status_code == 404


def test_enrollment_admin(client, admin, user):
    headers, uid = user
    paid = next(c for c in client.get("/api/courses").json() if c["price"] > 0)
    sold_before = paid["sold"]

    # admin cấp quyền khóa trả phí
    r = client.post("/api/admin/enrollments", json={"user_id": uid, "course_id": paid["id"]}, headers=admin)
    assert r.status_code == 201, r.text
    eid = r.json()["id"]
    assert r.json()["course_slug"] == paid["slug"] and r.json()["user_email"] == "user@test.vn"
    assert client.post("/api/admin/enrollments", json={"user_id": uid, "course_id": paid["id"]}, headers=admin).status_code == 409
    assert client.post("/api/admin/enrollments", json={"user_id": 9999, "course_id": paid["id"]}, headers=admin).status_code == 404

    # người dùng thấy khóa học trong "của tôi", sold tăng
    assert paid["slug"] in [c["slug"] for c in client.get("/api/courses/me/enrolled", headers=headers).json()]
    assert client.get(f"/api/admin/courses/{paid['id']}", headers=admin).json()["sold"] == sold_before + 1

    lst = client.get("/api/admin/enrollments", params={"user_id": uid}, headers=admin).json()
    assert lst["total"] == 1 and lst["items"][0]["id"] == eid

    # xoá ghi danh
    assert client.delete(f"/api/admin/enrollments/{eid}", headers=admin).status_code == 204
    assert client.delete(f"/api/admin/enrollments/{eid}", headers=admin).status_code == 404
    assert client.get("/api/courses/me/enrolled", headers=headers).json() == []
    assert client.get(f"/api/admin/courses/{paid['id']}", headers=admin).json()["sold"] == sold_before
