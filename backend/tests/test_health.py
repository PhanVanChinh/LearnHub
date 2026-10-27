"""/api/health công khai: không lộ chi tiết lỗi DB hay môi trường."""
from app import main


def test_health_ok_shape(client):
    assert client.get("/api/health").json() == {"status": "ok", "db": "ok"}


def test_health_db_down_hides_details(client, monkeypatch):
    class Boom:
        def connect(self):
            raise RuntimeError('connection to server at "db.internal" (10.0.0.5), port 5432 failed: password authentication failed for user "learnhub"')
    monkeypatch.setattr(main, "engine", Boom())
    r = client.get("/api/health")
    assert r.status_code == 503 and r.json() == {"status": "error", "db": "down"}
    assert "db.internal" not in r.text and "learnhub" not in r.text
