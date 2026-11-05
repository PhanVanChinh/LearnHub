"""Chống lạm dụng: rate limit, khóa tạm khi sai mật khẩu, refresh token, đăng xuất mọi thiết bị, captcha."""
import re
from datetime import datetime, timedelta

import pytest

from app import captcha, mailer, ratelimit
from app.config import settings
from app.database import SessionLocal
from app.models import User

PW = "StrongPass2024"  # không chứa "abuse" (tên email) để qua quy tắc mật khẩu


@pytest.fixture(scope="module")
def account(client):
    r = client.post("/api/auth/register", json={"email": "abuse@example.com", "full_name": "Abuse", "password": PW})
    assert r.status_code == 201, r.text
    return r.json()


def login(client, pw=PW):
    return client.post("/api/auth/login", json={"email": "abuse@example.com", "password": pw})


def test_tokens_and_refresh(client, account):
    assert account["refresh_token"] and account["access_token"]
    # refresh token không dùng được như access token và ngược lại
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {account['refresh_token']}"}).status_code == 401
    assert client.post("/api/auth/refresh", json={"refresh_token": account["access_token"]}).status_code == 401
    r = client.post("/api/auth/refresh", json={"refresh_token": account["refresh_token"]})
    assert r.status_code == 200 and r.json()["access_token"]
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {r.json()['access_token']}"}).status_code == 200
    assert client.post("/api/auth/refresh", json={"refresh_token": "rac"}).status_code == 401


def test_logout_all(client, account):
    h_old = {"Authorization": f"Bearer {account['access_token']}"}
    r = client.post("/api/auth/logout-all", headers=h_old)
    assert r.status_code == 200
    new = r.json()
    # token cũ (access + refresh) chết, token mới sống
    assert client.get("/api/auth/me", headers=h_old).status_code == 401
    assert client.post("/api/auth/refresh", json={"refresh_token": account["refresh_token"]}).status_code == 401
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {new['access_token']}"}).status_code == 200


def test_login_lockout(client, account):
    for i in range(settings.login_max_failures - 1):
        r = login(client, "sai-mat-khau-1")
        assert r.status_code == 401
    assert "còn 1 lần" in r.json()["detail"]
    r = login(client, "sai-mat-khau-1")
    assert r.status_code == 423 and "tạm khóa" in r.json()["detail"]
    # đúng mật khẩu cũng bị chặn khi đang khóa
    assert login(client).status_code == 423
    # hết hạn khóa → đăng nhập lại được, bộ đếm reset, last_login_at cập nhật
    db = SessionLocal()
    u = db.query(User).filter_by(email="abuse@example.com").one()
    u.locked_until = datetime.utcnow() - timedelta(seconds=1)
    db.commit(); db.close()
    r = login(client)
    assert r.status_code == 200
    db = SessionLocal()
    u = db.query(User).filter_by(email="abuse@example.com").one()
    assert u.failed_login_attempts == 0 and u.locked_until is None and u.last_login_at is not None
    db.close()


def test_reset_password_unlocks_account(client, account):
    """Thông báo khóa tạm gợi ý dùng Quên mật khẩu → đặt lại xong phải đăng nhập được ngay, không chờ hết 15 phút."""
    for _ in range(settings.login_max_failures):
        login(client, "sai-mat-khau-2")
    assert login(client).status_code == 423
    assert client.post("/api/auth/forgot-password", json={"email": "abuse@example.com"}).status_code == 200
    token = re.search(r"reset-password\?token=([A-Za-z0-9_-]+)", mailer.console_outbox[-1]["html"]).group(1)
    new_pw = "MatKhauMoi2025"
    assert client.post("/api/auth/reset-password", json={"token": token, "new_password": new_pw}).status_code == 204
    r = login(client, new_pw)
    assert r.status_code == 200, r.text
    db = SessionLocal()
    u = db.query(User).filter_by(email="abuse@example.com").one()
    assert u.failed_login_attempts == 0 and u.locked_until is None
    db.close()
    # trả lại mật khẩu cũ cho các test sau trong module
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    assert client.post("/api/auth/change-password", json={"current_password": new_pw, "new_password": PW}, headers=h).status_code in (200, 204)


def test_rate_limit(client, monkeypatch):
    monkeypatch.setattr(settings, "rate_limit_enabled", True)
    ratelimit.reset()
    codes = [client.post("/api/auth/login", json={"email": "x@example.com", "password": "whatever1"}).status_code for _ in range(11)]
    assert codes[:10] == [401] * 10 and codes[10] == 429
    r = client.post("/api/auth/login", json={"email": "x@example.com", "password": "whatever1"})
    assert r.status_code == 429 and "Retry-After" in r.headers
    # endpoint khác không bị ảnh hưởng bởi bucket login
    assert client.get("/api/health").status_code == 200
    ratelimit.reset()
    # /token (form OAuth2 cho /docs) gọi login() thẳng → phải chung bucket, không thành cửa sau để dò mật khẩu
    codes = [client.post("/api/auth/token", data={"username": "x@example.com", "password": "whatever1"}).status_code for _ in range(11)]
    assert codes[:10] == [401] * 10 and codes[10] == 429
    ratelimit.reset()


def test_captcha_required_when_enabled(client, monkeypatch):
    assert client.get("/api/auth/config").json()["captcha_enabled"] is False
    monkeypatch.setattr(settings, "turnstile_secret_key", "secret-test")
    assert client.get("/api/auth/config").json()["captcha_enabled"] is True

    body = {"email": "cap@example.com", "full_name": "Cap", "password": PW}
    r = client.post("/api/auth/register", json=body)
    assert r.status_code == 400 and "robot" in r.json()["detail"]

    class FakeResp:
        def __init__(self, ok): self.status_code = 200; self._ok = ok
        def json(self): return {"success": self._ok}

    monkeypatch.setattr(captcha.httpx, "post", lambda *a, **k: FakeResp(False))
    assert client.post("/api/auth/register", json={**body, "captcha_token": "bad"}).status_code == 400
    monkeypatch.setattr(captcha.httpx, "post", lambda *a, **k: FakeResp(True))
    assert client.post("/api/auth/register", json={**body, "captcha_token": "good"}).status_code == 201
    # quên mật khẩu cũng yêu cầu captcha
    assert client.post("/api/auth/forgot-password", json={"email": "cap@example.com"}).status_code == 400
    assert client.post("/api/auth/forgot-password", json={"email": "cap@example.com", "captcha_token": "good"}).status_code == 200
