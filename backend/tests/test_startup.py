"""Kiểm tra cấu hình khởi động + health check."""
import pytest

from app.config import settings
from app.database import SessionLocal
from app.startup_checks import find_problems, run_startup_checks


def test_health_reports_db(client):
    r = client.get("/api/health")
    assert r.status_code == 200 and r.json()["db"] == "ok"


def test_find_problems_defaults(client, monkeypatch):
    monkeypatch.setattr(settings, "secret_key", "dev-secret-change-me")  # .env thật có thể đã đặt key mạnh
    monkeypatch.setattr(settings, "admin_password", "admin123")
    db = SessionLocal()
    errors, warnings = find_problems(db)
    db.close()
    joined = " ".join(errors)
    assert "SECRET_KEY" in joined and "ADMIN_PASSWORD" in joined and "SQLite" in joined or "Postgres" in joined
    assert any("admin@example.com" in e for e in errors)  # admin seed đang dùng admin123
    assert any("CORS" in w for w in warnings)


def test_production_refuses_defaults(client, monkeypatch):
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "secret_key", "dev-secret-change-me")
    monkeypatch.setattr(settings, "admin_password", "admin123")
    with pytest.raises(RuntimeError) as ei:
        run_startup_checks()
    assert "SECRET_KEY" in str(ei.value)
    # cấu hình đủ → chạy (DB test vẫn có thể là SQLite → bỏ qua lỗi đó bằng monkeypatch)
    monkeypatch.setattr(settings, "secret_key", "x" * 48)
    monkeypatch.setattr(settings, "admin_password", "MotMatKhauRatManh!2026")
    monkeypatch.setattr(type(settings), "is_sqlite", property(lambda self: False))
    run_startup_checks()  # không ném
    # dev: không ném dù còn mặc định
    monkeypatch.setattr(settings, "app_env", "development")
    monkeypatch.setattr(settings, "secret_key", "dev-secret-change-me")
    run_startup_checks()


def test_health_config_admin_only(client):
    assert client.get("/api/health/config").status_code == 401
    r = client.post("/api/auth/login", json={"email": "admin@example.com", "password": "admin123"})
    admin = {"Authorization": f"Bearer {r.json()['access_token']}"}
    d = client.get("/api/health/config", headers=admin).json()
    assert d["database"] in ("sqlite", "postgres") and "mail" in d["services"] and isinstance(d["errors"], list)
    assert "dev-secret" not in str(d) and "admin123" in " ".join(d["errors"])  # nêu vấn đề nhưng không lộ giá trị secret
