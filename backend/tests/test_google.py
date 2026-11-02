"""Đăng nhập Google: giả lập verify_id_token để không gọi Google thật."""
from datetime import datetime

import pytest

from app import google_auth
from app.config import settings
from app.database import SessionLocal
from app.models import User

CLAIMS = {"sub": "google-uid-1", "email": "GG.User@gmail.com", "email_verified": True, "name": "Google User", "picture": "https://img/x.png"}


def test_disabled_without_client_id(client):
    assert client.get("/api/auth/config").json()["google_client_id"] == ""
    r = client.post("/api/auth/google", json={"credential": "x" * 40})
    assert r.status_code == 503


def test_google_new_and_existing_user(client, monkeypatch):
    monkeypatch.setattr(settings, "google_client_id", "test-client-id")
    assert client.get("/api/auth/config").json()["google_client_id"] == "test-client-id"
    monkeypatch.setattr(google_auth, "verify_id_token", lambda cred: dict(CLAIMS))

    # người mới → tạo tài khoản đã xác thực, có avatar, có refresh token
    r = client.post("/api/auth/google", json={"credential": "fake-google-token-abcdefghij"})
    assert r.status_code == 200, r.text
    u = r.json()["user"]
    assert u["email"] == "gg.user@gmail.com" and u["email_verified"] is True and u["has_google"] is True and u["full_name"] == "Google User"
    assert r.json()["refresh_token"]
    # đăng nhập lại → cùng user, không tạo trùng
    r2 = client.post("/api/auth/google", json={"credential": "fake-google-token-abcdefghij"})
    assert r2.json()["user"]["id"] == u["id"]
    db = SessionLocal(); assert db.query(User).filter_by(email="gg.user@gmail.com").count() == 1; db.close()

    # tài khoản đăng ký bằng mật khẩu nhưng CHƯA xác thực → Google cùng email: liên kết + tự xác thực,
    # nhưng mật khẩu và phiên cũ bị bỏ (có thể là người khác đăng ký trước để chiếm tài khoản)
    reg = client.post("/api/auth/register", json={"email": "link@example.com", "full_name": "Link", "password": "MatKhau2024"})
    old_access = reg.json()["access_token"]
    monkeypatch.setattr(google_auth, "verify_id_token", lambda cred: {**CLAIMS, "sub": "google-uid-2", "email": "link@example.com"})
    r = client.post("/api/auth/google", json={"credential": "another-fake-token-abcdefghij"})
    assert r.status_code == 200 and r.json()["user"]["email_verified"] is True and r.json()["user"]["has_google"] is True
    assert r.json()["user"]["has_password"] is False
    assert client.post("/api/auth/login", json={"email": "link@example.com", "password": "MatKhau2024"}).status_code == 401
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {old_access}"}).status_code == 401
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {r.json()['access_token']}"}).status_code == 200

    # tài khoản ĐÃ xác thực → liên kết Google giữ nguyên mật khẩu
    client.post("/api/auth/register", json={"email": "verified@example.com", "full_name": "Đã XT", "password": "MatKhau2024"})
    db = SessionLocal(); vu = db.query(User).filter_by(email="verified@example.com").one(); vu.email_verified_at = datetime.utcnow(); db.commit(); db.close()
    monkeypatch.setattr(google_auth, "verify_id_token", lambda cred: {**CLAIMS, "sub": "google-uid-3", "email": "verified@example.com"})
    r = client.post("/api/auth/google", json={"credential": "verified-fake-token-abcdefghij"})
    assert r.status_code == 200 and r.json()["user"]["has_password"] is True
    assert client.post("/api/auth/login", json={"email": "verified@example.com", "password": "MatKhau2024"}).status_code == 200

    # email đã liên kết với sub khác → 409
    monkeypatch.setattr(google_auth, "verify_id_token", lambda cred: {**CLAIMS, "sub": "google-uid-999", "email": "link@example.com"})
    assert client.post("/api/auth/google", json={"credential": "third-fake-token-abcdefghij"}).status_code == 409

    # email Google chưa xác minh → 401 (đi qua verify thật, chỉ giả claims)
    monkeypatch.undo()
    monkeypatch.setattr(settings, "google_client_id", "test-client-id")
    monkeypatch.setattr(google_auth.jwt, "get_unverified_header", lambda t: {"kid": "k1"})
    monkeypatch.setattr(google_auth, "_keys", lambda: [{"kid": "k1"}])
    monkeypatch.setattr(google_auth.jwt, "decode", lambda *a, **k: {**CLAIMS, "email_verified": False})
    assert client.post("/api/auth/google", json={"credential": "unverified-fake-token-abcdefghij"}).status_code == 401
    monkeypatch.setattr(google_auth.jwt, "decode", lambda *a, **k: (_ for _ in ()).throw(google_auth.JWTError("bad sig")))
    assert client.post("/api/auth/google", json={"credential": "badsig-fake-token-abcdefghij"}).status_code == 401
