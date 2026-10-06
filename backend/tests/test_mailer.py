"""Gửi mail: thử lại khi Resend lỗi tạm thời, không thử lại với lỗi dữ liệu; mail hủy đơn tới người mua."""
import httpx

from app import mailer
from app.config import settings
from tests.test_orders import _buyer, _paid_course


class _Resp:
    def __init__(self, status): self.status_code, self.text = status, "x"


def _patch_resend(monkeypatch, outcomes):
    """outcomes: dãy mã HTTP hoặc Exception cho từng lần gọi httpx.post."""
    calls = []
    def fake_post(url, **kw):
        calls.append(kw["json"]["to"])
        o = outcomes[len(calls) - 1]
        if isinstance(o, Exception):
            raise o
        return _Resp(o)
    monkeypatch.setattr(httpx, "post", fake_post)
    monkeypatch.setattr(mailer.time, "sleep", lambda s: None)
    monkeypatch.setattr(settings, "resend_api_key", "re_test")
    return calls


def test_resend_retries_then_succeeds(monkeypatch):
    calls = _patch_resend(monkeypatch, [httpx.ConnectError("boom"), 503, 200])
    assert mailer._send_resend("a@example.com", "s", "<p>x</p>") is True
    assert len(calls) == 3


def test_resend_gives_up_after_retries(monkeypatch):
    calls = _patch_resend(monkeypatch, [500, 500, 500])
    assert mailer._send_resend("a@example.com", "s", "<p>x</p>") is False
    assert len(calls) == 3


def test_resend_does_not_retry_client_error(monkeypatch):
    calls = _patch_resend(monkeypatch, [422])
    assert mailer._send_resend("a@example.com", "s", "<p>x</p>") is False
    assert len(calls) == 1


def test_admin_cancel_sends_email(client):
    admin = {"Authorization": f"Bearer {client.post('/api/auth/login', json={'email': 'admin@example.com', 'password': 'admin123'}).json()['access_token']}"}
    h = _buyer(client, "cancelmail@example.com")
    o = client.post("/api/orders", json={"course_slug": _paid_course(client)["slug"]}, headers=h).json()
    n = len(mailer.console_outbox)
    r = client.post(f"/api/admin/orders/{o['id']}/cancel", json={"note": "Không nhận được tiền"}, headers=admin)
    assert r.status_code == 200 and r.json()["status"] == "cancelled"
    mail = mailer.console_outbox[-1]
    assert len(mailer.console_outbox) == n + 1 and mail["to"] == "cancelmail@example.com"
    assert o["code"] in mail["subject"] and "hủy" in mail["subject"] and "Không nhận được tiền" in mail["html"]
