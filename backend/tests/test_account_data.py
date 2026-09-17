"""Quyền dữ liệu cá nhân: xuất dữ liệu (và xoá tài khoản ở commit sau)."""
from tests.test_api import verify


def _verified_user(client, email):
    r = client.post("/api/auth/register", json={"email": email, "full_name": "Data User", "password": "MatKhau2024"})
    verify(client, r.json()["access_token"], email)
    return {"Authorization": f"Bearer {r.json()['access_token']}"}, r.json()["user"]["id"]


def test_export_my_data(client):
    h, uid = _verified_user(client, "export@example.com")
    free = next(c for c in client.get("/api/courses").json() if c["price"] == 0)
    paid = next(c for c in client.get("/api/courses").json() if c["price"] > 0 and c["category"] != "ai-check")
    client.post(f"/api/courses/{free['slug']}/enroll", headers=h)
    client.put(f"/api/courses/{free['slug']}/lessons/0/complete", headers=h)
    client.post("/api/orders", json={"course_slug": paid["slug"]}, headers=h)
    client.post("/api/courses/trac-nghiem-triet-hoc-mac-lenin/lessons/0/quiz/submit", json={"answers": [1, 1, 1, 2, 2]}, headers=h)
    client.post("/api/contact", json={"name": "Data User", "email": "export@example.com", "subject": "Hỏi", "message": "Tôi muốn hỏi về khóa học này ạ"}, headers=h)

    assert client.get("/api/account/export").status_code == 401
    r = client.get("/api/account/export", headers=h)
    assert r.status_code == 200, r.text
    assert "attachment" in r.headers["content-disposition"] and ".json" in r.headers["content-disposition"]
    d = r.json()
    assert d["profile"]["email"] == "export@example.com" and d["profile"]["id"] == uid
    assert "hashed_password" not in str(d) and "MatKhau2024" not in str(d)
    assert [e["course_slug"] for e in d["enrollments"]] == [free["slug"]]
    assert d["lesson_progress"][0]["lesson_index"] == 0 and d["lesson_progress"][0]["lesson_title"]
    assert d["quiz_attempts"][0]["score"] == 5
    assert d["orders"][0]["course_slug"] == paid["slug"] and d["orders"][0]["status"] == "pending"
    assert d["contact_messages"][0]["subject"] == "Hỏi"
    assert d["ai_check_runs"] == []
    # người khác không thấy dữ liệu của mình lẫn vào
    h2, _ = _verified_user(client, "export2@example.com")
    d2 = client.get("/api/account/export", headers=h2).json()
    assert d2["enrollments"] == [] and d2["orders"] == [] and d2["contact_messages"] == []


def test_delete_account_anonymizes(client, monkeypatch):
    from datetime import datetime, timedelta

    from app import google_auth
    from app.config import settings
    from app.database import SessionLocal
    from app.models import ContactMessage, EmailVerification, Enrollment, Order, PasswordReset, User
    from app.routers.account import purge_expired_tokens

    admin_h = {"Authorization": f"Bearer {client.post('/api/auth/login', json={'email': 'admin@example.com', 'password': 'admin123'}).json()['access_token']}"}
    h, uid = _verified_user(client, "bye@example.com")
    free = next(c for c in client.get("/api/courses").json() if c["price"] == 0)
    paid = next(c for c in client.get("/api/courses").json() if c["price"] > 0 and c["category"] != "ai-check")
    client.post(f"/api/courses/{free['slug']}/enroll", headers=h)
    paid_order = client.post("/api/orders", json={"course_slug": paid["slug"]}, headers=h).json()
    client.post(f"/api/admin/orders/{paid_order['id']}/confirm", json={}, headers=admin_h)  # đơn đã thanh toán → phải giữ
    other_paid = next(c for c in client.get("/api/courses").json() if c["price"] > 0 and c["category"] != "ai-check" and c["slug"] != paid["slug"])
    pending = client.post("/api/orders", json={"course_slug": other_paid["slug"]}, headers=h).json()
    client.post("/api/contact", json={"name": "Bye", "email": "bye@example.com", "subject": "S", "message": "Nội dung cần giữ để hỗ trợ"}, headers=h)

    # sai email xác nhận / sai mật khẩu / admin
    assert client.request("DELETE", "/api/account", json={"confirm": "khac@example.com", "password": "MatKhau2024"}, headers=h).status_code == 400
    assert client.request("DELETE", "/api/account", json={"confirm": "bye@example.com", "password": "sai"}, headers=h).status_code == 400
    assert client.request("DELETE", "/api/account", json={"confirm": "admin@example.com", "password": "admin123"}, headers=admin_h).status_code == 400

    r = client.request("DELETE", "/api/account", json={"confirm": "BYE@example.com", "password": "MatKhau2024"}, headers=h)
    assert r.status_code == 204, r.text
    assert client.get("/api/auth/me", headers=h).status_code == 401  # token hết hiệu lực
    assert client.post("/api/auth/login", json={"email": "bye@example.com", "password": "MatKhau2024"}).status_code == 401

    db = SessionLocal()
    u = db.get(User, uid)
    assert u.deleted_at and not u.is_active and u.email.startswith(f"deleted-{uid}@") and u.full_name == "Người dùng đã xoá" and u.hashed_password == ""
    assert db.query(Enrollment).filter_by(user_id=uid).count() == 0
    orders = {o.code: o.status for o in db.query(Order).filter_by(user_id=uid).all()}
    assert orders == {paid_order["code"]: "paid", pending["code"]: "cancelled"}  # giữ đơn, huỷ đơn chờ
    m = db.query(ContactMessage).filter(ContactMessage.message == "Nội dung cần giữ để hỗ trợ").first()
    assert m.user_id is None and m.email.startswith("deleted-") and m.name == "Người dùng đã xoá"
    db.close()
    # email được giải phóng → đăng ký lại được
    assert client.post("/api/auth/register", json={"email": "bye@example.com", "full_name": "Lại", "password": "MatKhau2024"}).status_code == 201
    # admin thấy tài khoản đã xoá là inactive kèm deleted_at
    lst = client.get("/api/admin/users", params={"q": f"deleted-{uid}"}, headers=admin_h).json()
    assert lst["items"][0]["deleted_at"] and lst["items"][0]["is_active"] is False

    # tài khoản Google không mật khẩu: chỉ cần gõ email
    monkeypatch.setattr(settings, "google_client_id", "test-client-id")
    monkeypatch.setattr(google_auth, "verify_id_token", lambda cred: {"sub": "g-del", "email": "gdel@gmail.com", "email_verified": True, "name": "G"})
    g = client.post("/api/auth/google", json={"credential": "fake-google-token-abcdefghij"}).json()
    gh = {"Authorization": f"Bearer {g['access_token']}"}
    assert client.request("DELETE", "/api/account", json={"confirm": "gdel@gmail.com"}, headers=gh).status_code == 204

    # dọn token hết hạn
    db = SessionLocal()
    old = datetime.utcnow() - timedelta(days=10)
    db.add(EmailVerification(user_id=1, code_hash="x", expires_at=old))
    db.add(PasswordReset(user_id=1, token_hash="y", expires_at=datetime.utcnow() + timedelta(hours=1), used_at=old))
    db.add(PasswordReset(user_id=1, token_hash="z", expires_at=datetime.utcnow() + timedelta(hours=1)))  # còn hạn, chưa dùng → giữ
    db.commit()
    assert purge_expired_tokens(db) >= 2
    assert db.query(PasswordReset).filter_by(token_hash="z").count() == 1 and db.query(PasswordReset).filter_by(token_hash="y").count() == 0
    db.close()
