"""Nhật ký hành động: mọi thao tác ghi dữ liệu của admin + tự xoá tài khoản đều để lại dấu."""
from tests.test_api import verify

NEW = {"slug": "audit-course", "title": "Khóa audit", "category": "video", "price": 50000, "short": "s", "description": "d",
       "includes": [], "lessons": [{"title": "B1", "duration": "01:00", "free": True}]}


def _admin(client):
    r = client.post("/api/auth/login", json={"email": "admin@example.com", "password": "admin123"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _logs(client, admin, **params):
    return client.get("/api/admin/audit", params=params, headers=admin).json()


def test_admin_actions_are_logged(client):
    admin = _admin(client)
    assert client.get("/api/admin/audit").status_code == 401
    before = _logs(client, admin)["total"]

    c = client.post("/api/admin/courses", json=NEW, headers=admin).json()
    client.patch(f"/api/admin/courses/{c['id']}", json={"price": 60000, "featured": True}, headers=admin)
    u = client.post("/api/admin/users", json={"email": "audited@example.com", "full_name": "A", "password": "MatKhau2024"}, headers=admin).json()
    client.patch(f"/api/admin/users/{u['id']}", json={"password": "MatKhauMoi2024", "is_active": False}, headers=admin)
    e = client.post("/api/admin/enrollments", json={"user_id": u["id"], "course_id": c["id"]}, headers=admin).json()
    client.delete(f"/api/admin/enrollments/{e['id']}", headers=admin)
    client.delete(f"/api/admin/courses/{c['id']}", headers=admin)
    client.delete(f"/api/admin/users/{u['id']}", headers=admin)

    logs = _logs(client, admin)
    assert logs["total"] == before + 8
    actions = [l["action"] for l in logs["items"][:8]]
    assert actions == ["user.delete", "course.delete", "enrollment.delete", "enrollment.create", "user.update", "user.create", "course.update", "course.create"]
    for l in logs["items"][:8]:
        assert l["actor_email"] == "admin@example.com" and l["ip"] and l["created_at"]

    upd = next(l for l in logs["items"] if l["action"] == "course.update")
    assert upd["detail"]["changed"]["price"] == {"from": 50000, "to": 60000} and upd["target_id"] == str(c["id"])
    uupd = next(l for l in logs["items"] if l["action"] == "user.update")
    assert "password" in uupd["detail"]["fields"] and "MatKhauMoi2024" not in str(uupd)  # không lộ mật khẩu
    assert "audited@example.com" in next(l for l in logs["items"] if l["action"] == "user.delete")["summary"]

    # lọc theo tiền tố action, actor, tìm tóm tắt
    assert all(l["action"].startswith("course") for l in _logs(client, admin, action="course")["items"])
    assert _logs(client, admin, action="course.delete")["total"] >= 1
    assert _logs(client, admin, actor="admin@")["total"] == logs["total"]
    assert _logs(client, admin, q="Khóa audit")["total"] == 5  # tạo, sửa, xoá khóa + cấp/thu hồi quyền có tên khóa


def test_order_contact_and_account_delete_logged(client):
    admin = _admin(client)
    r = client.post("/api/auth/register", json={"email": "aud-buyer@example.com", "full_name": "B", "password": "MatKhau2024"})
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    verify(client, r.json()["access_token"], "aud-buyer@example.com")
    paid = next(c for c in client.get("/api/courses").json() if c["price"] > 0 and c["category"] != "ai-check")
    o = client.post("/api/orders", json={"course_slug": paid["slug"]}, headers=h).json()
    client.post(f"/api/admin/orders/{o['id']}/confirm", json={"note": "GD 777"}, headers=admin)
    log = _logs(client, admin, action="order.confirm")["items"][0]
    assert o["code"] in log["summary"] and log["detail"]["note"] == "GD 777" and "aud-buyer@example.com" in log["summary"]

    client.post("/api/contact", json={"name": "B", "email": "aud-buyer@example.com", "message": "Tin nhắn để kiểm tra nhật ký"})
    m = client.get("/api/admin/contacts", params={"q": "kiểm tra nhật ký"}, headers=admin).json()["items"][0]
    client.post(f"/api/admin/contacts/{m['id']}/replied", headers=admin)
    assert _logs(client, admin, action="contact.replied")["items"][0]["target_id"] == str(m["id"])

    client.request("DELETE", "/api/account", json={"confirm": "aud-buyer@example.com", "password": "MatKhau2024"}, headers=h)
    log = _logs(client, admin, action="account.delete")["items"][0]
    assert log["actor_id"] is None and "aud-buyer@example.com" in log["summary"] and log["ip"]
