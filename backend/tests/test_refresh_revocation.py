"""Refresh token thu hồi được: đăng xuất vô hiệu đúng token đó (kể cả bản đã bị lộ), thiết bị khác không ảnh hưởng."""
from datetime import datetime, timedelta, timezone

from jose import jwt

from app.config import settings
from app.database import SessionLocal
from app.models import RefreshToken, User


def _login(client, email):
    r = client.post("/api/auth/login", json={"email": email, "password": "MatKhau2024"})
    assert r.status_code == 200, r.text
    return r.json()["refresh_token"]


def test_logout_revokes_that_token_only(client):
    email = "rt1@example.com"
    client.post("/api/auth/register", json={"email": email, "full_name": "RT", "password": "MatKhau2024"})
    client.cookies.clear()
    laptop, phone = _login(client, email), _login(client, email)
    client.cookies.clear()
    assert client.post("/api/auth/refresh", json={"refresh_token": laptop}).status_code == 200

    # đăng xuất laptop: token laptop (dù kẻ gian đã chép) hết dùng được; điện thoại vẫn bình thường
    assert client.post("/api/auth/logout", json={"refresh_token": laptop}).status_code == 204
    client.cookies.clear()
    assert client.post("/api/auth/refresh", json={"refresh_token": laptop}).status_code == 401
    client.cookies.clear()
    assert client.post("/api/auth/refresh", json={"refresh_token": phone}).status_code == 200


def test_logout_all_revokes_rows(client):
    email = "rt2@example.com"
    r = client.post("/api/auth/register", json={"email": email, "full_name": "RT", "password": "MatKhau2024"})
    access = r.json()["access_token"]
    client.cookies.clear()
    other = _login(client, email)
    assert client.post("/api/auth/logout-all", headers={"Authorization": f"Bearer {access}"}).status_code == 200
    db = SessionLocal()
    try:
        uid = db.query(User).filter_by(email=email).one().id
        live = db.query(RefreshToken).filter_by(user_id=uid, revoked_at=None).count()
        assert live == 1  # chỉ token mới cấp cho thiết bị hiện tại
    finally:
        db.close()
    client.cookies.clear()
    assert client.post("/api/auth/refresh", json={"refresh_token": other}).status_code == 401


def test_legacy_token_without_jti_still_accepted(client):
    """Token phát hành trước bản cập nhật (không jti) vẫn gia hạn được tới khi hết hạn, không bắt mọi người đăng nhập lại."""
    db = SessionLocal()
    try:
        u = db.query(User).filter_by(email="rt1@example.com").one()
        now = datetime.now(timezone.utc)
        mark = u.token_invalid_before
        pv = int(mark.replace(tzinfo=timezone.utc).timestamp() * 1000) if mark else 0
        legacy = jwt.encode({"sub": str(u.id), "typ": "refresh", "pv": pv, "iat": int(now.timestamp()), "exp": now + timedelta(days=1)},
                            settings.secret_key, algorithm=settings.algorithm)
    finally:
        db.close()
    client.cookies.clear()
    r = client.post("/api/auth/refresh", json={"refresh_token": legacy})
    assert r.status_code == 200 and "jti" in jwt.get_unverified_claims(r.json()["refresh_token"])



def _refresh(client, token):
    client.cookies.clear()
    return client.post("/api/auth/refresh", json={"refresh_token": token})


def _new_user(client, email):
    client.post("/api/auth/register", json={"email": email, "full_name": "RT", "password": "MatKhau2024"})
    client.cookies.clear()


def test_refresh_rotates_token(client):
    _new_user(client, "rt3@example.com")
    t1 = _login(client, "rt3@example.com")
    r = _refresh(client, t1)
    assert r.status_code == 200
    t2 = r.json()["refresh_token"]
    assert t2 != t1 and _refresh(client, t2).status_code == 200


def test_reuse_within_grace_is_allowed(client):
    """Hai tab gia hạn cùng lúc bằng cùng token: không ai bị đá ra."""
    _new_user(client, "rt4@example.com")
    t1 = _login(client, "rt4@example.com")
    t2 = _refresh(client, t1).json()["refresh_token"]
    again = _refresh(client, t1)
    assert again.status_code == 200
    assert _refresh(client, t2).status_code == 200


def test_reuse_after_grace_revokes_whole_family(client, monkeypatch):
    """Token đã bị thay mà vẫn có người dùng lại (kẻ gian chép được) → 401 và cả chuỗi bị thu hồi, chủ thật phải đăng nhập lại."""
    from app.routers import auth as auth_router
    monkeypatch.setattr(auth_router, "ROTATION_GRACE_SECONDS", -1)
    _new_user(client, "rt5@example.com")
    stolen = _login(client, "rt5@example.com")
    legit = _refresh(client, stolen).json()["refresh_token"]
    assert _refresh(client, stolen).status_code == 401
    assert _refresh(client, legit).status_code == 401
    # lần đăng nhập khác (chuỗi khác) không bị ảnh hưởng
    other = _login(client, "rt5@example.com")
    assert _refresh(client, other).status_code == 200


def test_logout_with_rotated_token_ends_session(client):
    """Đăng xuất bằng token cũ (đã xoay vòng) vẫn kết thúc lần đăng nhập đó; khoảng ân hạn không cứu được token cũ."""
    _new_user(client, "rt6@example.com")
    t1 = _login(client, "rt6@example.com")
    t2 = _refresh(client, t1).json()["refresh_token"]
    client.cookies.clear()
    assert client.post("/api/auth/logout", json={"refresh_token": t1}).status_code == 204
    assert _refresh(client, t1).status_code == 401
    assert _refresh(client, t2).status_code == 401
