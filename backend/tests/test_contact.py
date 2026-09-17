"""Form liên hệ: lưu DB, mail admin + mail xác nhận, validate."""
from app import mailer
from app.config import settings
from app.database import SessionLocal
from app.models import ContactMessage

BODY = {"name": "  Nguyễn  Văn A ", "email": "Guest@Example.com", "subject": "Hỏi khóa ML", "message": "Khóa này có bài tập thực hành không ạ?"}


def test_send_contact_guest(client, monkeypatch):
    monkeypatch.setattr(settings, "order_notify_email", "support@example.com")
    n = len(mailer.console_outbox)
    r = client.post("/api/contact", json=BODY)
    assert r.status_code == 201, r.text
    assert "24 giờ" in r.json()["detail"]

    db = SessionLocal()
    m = db.query(ContactMessage).order_by(ContactMessage.id.desc()).first()
    assert m.name == "Nguyễn Văn A" and m.email == "guest@example.com" and m.user_id is None and m.status == "new"
    db.close()

    admin_mail, ack = mailer.console_outbox[n:]
    assert admin_mail["to"] == "support@example.com" and f"#{m.id}" in admin_mail["subject"] and "guest@example.com" in admin_mail["html"]
    assert "thực hành" in admin_mail["html"] and "/admin" in admin_mail["html"]
    assert ack["to"] == "guest@example.com" and "24 giờ" in ack["html"]


def test_contact_validation_and_user_link(client):
    r = client.post("/api/contact", json={**BODY, "message": "ngắn"})
    assert r.status_code == 422 and r.json()["errors"][0]["field"] == "message"
    r = client.post("/api/contact", json={**BODY, "email": "khong-phai-email"})
    assert r.status_code == 422 and r.json()["errors"][0]["field"] == "email"
    r = client.post("/api/contact", json={**BODY, "name": "   "})
    assert r.status_code == 422 and r.json()["errors"][0]["field"] == "name"

    # HTML trong nội dung không được chèn thô vào email admin
    r = client.post("/api/contact", json={**BODY, "message": "<script>alert(1)</script> xin chào mọi người"})
    assert r.status_code == 201 and "<script>" not in mailer.console_outbox[-2]["html"]

    # đăng nhập → gắn user_id
    reg = client.post("/api/auth/register", json={"email": "ct@example.com", "full_name": "CT", "password": "MatKhau2024"})
    h = {"Authorization": f"Bearer {reg.json()['access_token']}"}
    assert client.post("/api/contact", json={**BODY, "email": "ct@example.com"}, headers=h).status_code == 201
    db = SessionLocal()
    assert db.query(ContactMessage).filter_by(email="ct@example.com").first().user_id == reg.json()["user"]["id"]
    db.close()
