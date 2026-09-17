"""Đơn hàng khóa trả phí (phía người mua)."""
from datetime import datetime, timedelta

from app.config import settings
from app.database import SessionLocal
from app.models import Order
from tests.test_api import verify


def _buyer(client, email):
    r = client.post("/api/auth/register", json={"email": email, "full_name": "Buyer", "password": "MatKhau2024"})
    verify(client, r.json()["access_token"], email)
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _paid_course(client):
    """Khóa trả phí mua được (bỏ danh mục 'sắp mở bán')."""
    return next(c for c in client.get("/api/courses").json() if c["price"] > 0 and c["category"] != "ai-check")


def test_create_and_reuse_order(client, monkeypatch):
    monkeypatch.setattr(settings, "bank_bin", "970436")
    monkeypatch.setattr(settings, "bank_account_number", "0123456789")
    monkeypatch.setattr(settings, "bank_account_name", "PHAN VAN CHINH")
    monkeypatch.setattr(settings, "bank_name", "Vietcombank")
    h = _buyer(client, "buyer1@example.com")
    paid = _paid_course(client)
    free = next(c for c in client.get("/api/courses").json() if c["price"] == 0)

    assert client.post("/api/orders", json={"course_slug": paid["slug"]}).status_code == 401
    assert client.post("/api/orders", json={"course_slug": "khong-ton-tai"}, headers=h).status_code == 404
    assert client.post("/api/orders", json={"course_slug": free["slug"]}, headers=h).status_code == 400

    r = client.post("/api/orders", json={"course_slug": paid["slug"]}, headers=h)
    assert r.status_code == 201, r.text
    o = r.json()
    assert o["status"] == "pending" and o["amount"] == paid["price"] and o["course_slug"] == paid["slug"]
    assert o["code"].startswith("LH") and len(o["code"]) == 8
    pay = o["payment"]
    assert pay["content"] == o["code"] and pay["amount"] == paid["price"] and pay["bank_name"] == "Vietcombank"
    assert pay["qr_url"].startswith("https://img.vietqr.io/image/970436-0123456789-") and o["code"] in pay["qr_url"]

    # tạo lại cùng khóa → trả đơn chờ cũ, không tạo trùng
    r2 = client.post("/api/orders", json={"course_slug": paid["slug"]}, headers=h)
    assert r2.status_code == 201 and r2.json()["code"] == o["code"]
    assert len(client.get("/api/orders/me", headers=h).json()) == 1

    # xem chi tiết (không phân biệt hoa thường), người khác không thấy
    assert client.get(f"/api/orders/{o['code'].lower()}", headers=h).json()["code"] == o["code"]
    other = _buyer(client, "buyer2@example.com")
    assert client.get(f"/api/orders/{o['code']}", headers=other).status_code == 404

    # huỷ → cancelled, không có payment; huỷ lần 2 → 400; tạo lại → đơn mới
    r = client.post(f"/api/orders/{o['code']}/cancel", headers=h)
    assert r.status_code == 200 and r.json()["status"] == "cancelled" and r.json()["payment"] is None
    assert client.post(f"/api/orders/{o['code']}/cancel", headers=h).status_code == 400
    r3 = client.post("/api/orders", json={"course_slug": paid["slug"]}, headers=h)
    assert r3.status_code == 201 and r3.json()["code"] != o["code"]
    assert [x["status"] for x in client.get("/api/orders/me", headers=h).json()] == ["pending", "cancelled"]


def test_no_bank_config_hides_qr(client, monkeypatch):
    monkeypatch.setattr(settings, "bank_bin", "")
    h = _buyer(client, "buyer3@example.com")
    r = client.post("/api/orders", json={"course_slug": _paid_course(client)["slug"]}, headers=h)
    assert r.status_code == 201 and r.json()["payment"]["qr_url"] is None and r.json()["payment"]["content"] == r.json()["code"]


def test_order_expires(client):
    h = _buyer(client, "buyer4@example.com")
    code = client.post("/api/orders", json={"course_slug": _paid_course(client)["slug"]}, headers=h).json()["code"]
    db = SessionLocal()
    db.query(Order).filter_by(code=code).update({"expires_at": datetime.utcnow() - timedelta(minutes=1)})
    db.commit(); db.close()
    r = client.get(f"/api/orders/{code}", headers=h)
    assert r.json()["status"] == "expired" and r.json()["payment"] is None
    # đơn hết hạn → tạo lại được đơn mới
    assert client.post("/api/orders", json={"course_slug": _paid_course(client)["slug"]}, headers=h).json()["code"] != code


def _admin(client):
    r = client.post("/api/auth/login", json={"email": "admin@example.com", "password": "admin123"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_admin_confirms_order_and_grants_access(client):
    admin = _admin(client)
    h = _buyer(client, "buyer5@example.com")
    paid = _paid_course(client)
    o = client.post("/api/orders", json={"course_slug": paid["slug"]}, headers=h).json()
    before = client.get("/api/admin/stats", headers=admin).json()

    # người thường không vào được admin
    assert client.get("/api/admin/orders", headers=h).status_code == 403
    lst = client.get("/api/admin/orders", params={"status": "pending", "q": "buyer5"}, headers=admin).json()
    assert lst["total"] == 1 and lst["items"][0]["code"] == o["code"] and lst["items"][0]["user_email"] == "buyer5@example.com"

    # chưa duyệt → chưa có quyền
    assert client.get(f"/api/courses/{paid['slug']}", headers=h).json()["enrolled"] is False
    r = client.post(f"/api/admin/orders/{o['id']}/confirm", json={"note": "CK 16/09 mã GD 999"}, headers=admin)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["status"] == "paid" and d["paid_at"] and d["note"] == "CK 16/09 mã GD 999" and d["confirmed_by_email"] == "admin@example.com"
    # người mua có quyền học, đơn hiện paid, xem được video bài trả phí
    assert client.get(f"/api/courses/{paid['slug']}", headers=h).json()["enrolled"] is True
    assert client.get(f"/api/orders/{o['code']}", headers=h).json()["status"] == "paid"
    assert paid["slug"] in [c["slug"] for c in client.get("/api/courses/me/enrolled", headers=h).json()]
    # duyệt lần 2 → 400; huỷ đơn đã paid → 400
    assert client.post(f"/api/admin/orders/{o['id']}/confirm", json={}, headers=admin).status_code == 400
    assert client.post(f"/api/admin/orders/{o['id']}/cancel", json={}, headers=admin).status_code == 400
    # doanh thu thật tăng đúng số tiền đơn
    after = client.get("/api/admin/stats", headers=admin).json()
    assert after["revenue"] == before["revenue"] + paid["price"] and after["paid_orders"] == before["paid_orders"] + 1
    # đã có quyền → không tạo đơn mới cho khóa đó
    assert client.post("/api/orders", json={"course_slug": paid["slug"]}, headers=h).status_code == 409


def test_admin_cancel_and_confirm_expired(client):
    admin = _admin(client)
    h = _buyer(client, "buyer6@example.com")
    paid = _paid_course(client)
    o = client.post("/api/orders", json={"course_slug": paid["slug"]}, headers=h).json()
    r = client.post(f"/api/admin/orders/{o['id']}/cancel", json={"note": "khách đổi ý"}, headers=admin)
    assert r.status_code == 200 and r.json()["status"] == "cancelled" and r.json()["note"] == "khách đổi ý"
    assert client.get(f"/api/orders/{o['code']}", headers=h).json()["status"] == "cancelled"

    # đơn hết hạn nhưng tiền về muộn → vẫn duyệt được
    o2 = client.post("/api/orders", json={"course_slug": paid["slug"]}, headers=h).json()
    db = SessionLocal()
    db.query(Order).filter_by(code=o2["code"]).update({"expires_at": datetime.utcnow() - timedelta(hours=1)})
    db.commit(); db.close()
    assert client.get("/api/admin/orders", params={"status": "expired"}, headers=admin).json()["total"] >= 1
    r = client.post(f"/api/admin/orders/{o2['id']}/confirm", json={}, headers=admin)
    assert r.status_code == 200 and r.json()["status"] == "paid"
    assert client.get(f"/api/courses/{paid['slug']}", headers=h).json()["enrolled"] is True
    assert client.post("/api/admin/orders/99999/confirm", json={}, headers=admin).status_code == 404


def test_order_emails(client, monkeypatch):
    from app import mailer

    monkeypatch.setattr(settings, "bank_bin", "970436")
    monkeypatch.setattr(settings, "bank_account_number", "0123456789")
    monkeypatch.setattr(settings, "bank_name", "Vietcombank")
    monkeypatch.setattr(settings, "order_notify_email", "kiemtra@example.com")
    admin = _admin(client)
    h = _buyer(client, "buyer7@example.com")
    paid = _paid_course(client)
    n = len(mailer.console_outbox)

    o = client.post("/api/orders", json={"course_slug": paid["slug"]}, headers=h).json()
    new = mailer.console_outbox[n:]
    assert [m["to"] for m in new] == ["buyer7@example.com", "kiemtra@example.com"]
    buyer_mail, admin_mail = new
    assert o["code"] in buyer_mail["subject"] and o["code"] in buyer_mail["html"] and "0123456789" in buyer_mail["html"]
    assert f"/checkout?order={o['code']}" in buyer_mail["html"]
    assert o["code"] in admin_mail["subject"] and "buyer7@example.com" in admin_mail["html"] and "/admin" in admin_mail["html"]

    # tạo lại → trả đơn cũ, KHÔNG gửi mail lần nữa
    client.post("/api/orders", json={"course_slug": paid["slug"]}, headers=h)
    assert len(mailer.console_outbox) == n + 2

    # duyệt → mail "đã xác nhận" kèm link vào học
    client.post(f"/api/admin/orders/{o['id']}/confirm", json={}, headers=admin)
    m = mailer.console_outbox[-1]
    assert m["to"] == "buyer7@example.com" and "xác nhận" in m["subject"].lower() and f"/learn/{paid['slug']}" in m["html"]


def test_coming_soon_category_refuses_orders(client):
    h = _buyer(client, "buyer8@example.com")
    ai = next(c for c in client.get("/api/courses", params={"category": "ai-check"}).json() if c["price"] > 0)
    r = client.post("/api/orders", json={"course_slug": ai["slug"]}, headers=h)
    assert r.status_code == 400 and "sắp mở bán" in r.json()["detail"].lower()
