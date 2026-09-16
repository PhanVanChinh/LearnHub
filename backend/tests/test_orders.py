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
    return next(c for c in client.get("/api/courses").json() if c["price"] > 0)


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
