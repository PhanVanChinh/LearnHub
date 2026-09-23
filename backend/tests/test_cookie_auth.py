"""Refresh token trong cookie httpOnly: đặt khi đăng nhập, dùng được không cần body, xoá khi logout, chế độ chỉ-cookie."""
from app.config import settings

COOKIE = "learnhub_refresh"


def _register(client, email):
    return client.post("/api/auth/register", json={"email": email, "full_name": "Cookie", "password": "MatKhau2024"})


def test_cookie_set_and_refresh_without_body(client):
    r = _register(client, "ck1@example.com")
    set_cookie = r.headers["set-cookie"]
    assert COOKIE in set_cookie and "HttpOnly" in set_cookie and "Path=/api/auth" in set_cookie and "SameSite=lax" in set_cookie
    assert "Secure" not in set_cookie  # FRONTEND_URL localhost trong test
    assert client.cookies.get(COOKIE)

    # refresh chỉ bằng cookie (không body) → token mới, cookie mới
    r2 = client.post("/api/auth/refresh")
    assert r2.status_code == 200 and r2.json()["access_token"] and COOKIE in r2.headers["set-cookie"]
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {r2.json()['access_token']}"}).status_code == 200

    # logout → cookie bị xoá → refresh 401
    r3 = client.post("/api/auth/logout")
    assert r3.status_code == 204 and ("Max-Age=0" in r3.headers["set-cookie"] or "expires=" in r3.headers["set-cookie"].lower())
    client.cookies.clear()
    assert client.post("/api/auth/refresh").status_code == 401
    assert client.post("/api/auth/refresh", json={}).status_code == 401


def test_cookie_only_mode_hides_token_from_json(client, monkeypatch):
    monkeypatch.setattr(settings, "refresh_token_in_body", False)
    r = _register(client, "ck2@example.com")
    assert r.json()["refresh_token"] is None and COOKIE in r.headers["set-cookie"]
    # đăng nhập bằng mật khẩu cũng vậy; refresh qua cookie vẫn chạy
    r = client.post("/api/auth/login", json={"email": "ck2@example.com", "password": "MatKhau2024"})
    assert r.json()["refresh_token"] is None
    assert client.post("/api/auth/refresh").status_code == 200
    # cookie hỏng → 401 và server ra lệnh xoá cookie
    client.cookies.clear()
    client.cookies.set(COOKIE, "rac", path="/api/auth")
    r = client.post("/api/auth/refresh")
    sc = r.headers.get("set-cookie", "").lower()
    assert r.status_code == 401 and ("max-age=0" in sc or "expires=" in sc)
    client.cookies.clear()


def test_cookie_flags_for_cross_site(client, monkeypatch):
    monkeypatch.setattr(settings, "cookie_samesite", "none")
    monkeypatch.setattr(settings, "frontend_url", "https://phanvanchinh.github.io/LearnHub")
    r = _register(client, "ck3@example.com")
    sc = r.headers["set-cookie"]
    assert "SameSite=none" in sc and "Secure" in sc and "HttpOnly" in sc
