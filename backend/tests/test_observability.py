"""Request ID, handler 500 có mã tra cứu, endpoint nhận lỗi client."""
import logging

from fastapi.testclient import TestClient

from app.main import app


def test_request_id_header(client):
    r = client.get("/api/courses/categories")
    assert len(r.headers["x-request-id"]) == 12
    r = client.get("/api/courses/categories", headers={"X-Request-ID": "proxy-abc-123"})
    assert r.headers["x-request-id"] == "proxy-abc-123"  # giữ id từ proxy để tra log xuyên tầng


def test_unhandled_error_returns_lookup_code(client, caplog):
    @app.get("/api/_boom", include_in_schema=False)
    def boom():
        raise RuntimeError("nổ thử")

    with TestClient(app, raise_server_exceptions=False) as c, caplog.at_level(logging.ERROR):
        r = c.get("/api/_boom")
    assert r.status_code == 500
    rid = r.headers["x-request-id"]
    assert r.json()["request_id"] == rid and rid in r.json()["detail"] and "nổ thử" not in r.text  # không lộ nội dung lỗi
    assert any("Lỗi chưa bắt" in rec.message and rec.request_id == rid for rec in caplog.records)


def test_client_error_endpoint(client, caplog):
    with caplog.at_level(logging.ERROR, logger="learnhub.client"):
        r = client.post("/api/client-errors", json={"message": "Cannot read properties of undefined", "stack": "at LearnView", "url": "https://x/learn/a", "user_agent": "UA", "source": "window.onerror"})
    assert r.status_code == 204
    assert any("Cannot read properties" in rec.message and "/learn/a" in rec.message for rec in caplog.records)
    assert client.post("/api/client-errors", json={"message": "x" * 2000}).status_code == 422
