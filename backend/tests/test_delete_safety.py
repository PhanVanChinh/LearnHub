"""Xóa khóa học / người dùng không được làm mất đơn đã thanh toán (chứng từ doanh thu)."""
from tests.test_orders import _buyer, _paid_course


def _admin(client):
    r = client.post("/api/auth/login", json={"email": "admin@example.com", "password": "admin123"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _paid_order(client, admin, email):
    h = _buyer(client, email)
    course = _paid_course(client)
    o = client.post("/api/orders", json={"course_slug": course["slug"]}, headers=h).json()
    r = client.post(f"/api/admin/orders/{o['id']}/confirm", json={"note": "test"}, headers=admin)
    assert r.status_code == 200 and r.json()["status"] == "paid", r.text
    return h, course, r.json()


def test_cannot_delete_course_with_paid_orders(client):
    admin = _admin(client)
    _, course, order = _paid_order(client, admin, "del-course@example.com")
    cid = client.get("/api/admin/courses", params={"q": course["slug"]}, headers=admin).json()["items"][0]["id"]
    revenue = client.get("/api/admin/stats", headers=admin).json()["revenue"]
    r = client.delete(f"/api/admin/courses/{cid}", headers=admin)
    assert r.status_code == 409 and "đã thanh toán" in r.json()["detail"]
    # khóa và đơn vẫn còn, doanh thu không đổi; ẩn khóa thì được
    assert client.get("/api/admin/stats", headers=admin).json()["revenue"] == revenue
    assert client.patch(f"/api/admin/courses/{cid}", json={"hidden": True}, headers=admin).status_code == 200


def test_delete_user_with_paid_orders_keeps_orders(client):
    admin = _admin(client)
    h, _, order = _paid_order(client, admin, "del-user@example.com")
    uid = client.get("/api/auth/me", headers=h).json()["id"]
    revenue = client.get("/api/admin/stats", headers=admin).json()["revenue"]
    assert client.delete(f"/api/admin/users/{uid}", headers=admin).status_code == 204
    # đơn còn nguyên trạng thái paid, doanh thu giữ; tài khoản bị ẩn danh và khóa, không đăng nhập được
    assert client.get("/api/admin/stats", headers=admin).json()["revenue"] == revenue
    rows = client.get("/api/admin/orders", params={"q": order["code"]}, headers=admin).json()["items"]
    assert rows and rows[0]["status"] == "paid" and "deleted" in rows[0]["user_email"]
    assert client.post("/api/auth/login", json={"email": "del-user@example.com", "password": "MatKhau2024"}).status_code == 401


def test_delete_admin_who_confirmed_orders(client):
    """Xóa admin đã duyệt đơn: FK confirmed_by_id phải được gỡ, không lỗi 500 (Postgres)."""
    admin = _admin(client)
    r = client.post("/api/admin/users", json={"email": "admin2@example.com", "full_name": "A2", "password": "MatKhau2024", "role": "admin"}, headers=admin)
    assert r.status_code == 201, r.text
    a2_id = r.json()["id"]
    a2 = {"Authorization": f"Bearer {client.post('/api/auth/login', json={'email': 'admin2@example.com', 'password': 'MatKhau2024'}).json()['access_token']}"}
    _, _, order = _paid_order(client, a2, "del-admin-buyer@example.com")
    assert client.delete(f"/api/admin/users/{a2_id}", headers=admin).status_code == 204
    rows = client.get("/api/admin/orders", params={"q": order["code"]}, headers=admin).json()["items"]
    assert rows and rows[0]["status"] == "paid"


def test_delete_user_without_paid_orders_hard_deletes(client):
    admin = _admin(client)
    h = _buyer(client, "del-plain@example.com")
    uid = client.get("/api/auth/me", headers=h).json()["id"]
    assert client.delete(f"/api/admin/users/{uid}", headers=admin).status_code == 204
    assert client.get(f"/api/admin/users/{uid}", headers=admin).status_code == 404
