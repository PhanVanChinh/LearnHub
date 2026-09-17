"""AI Check: giả lập lời gọi Claude; kiểm tra cấu hình, phân quyền, hạn mức, validate."""
from app import ai_check
from app.config import settings
from tests.test_api import verify

TEXT = " ".join(["Trí tuệ nhân tạo đang thay đổi cách sinh viên học tập và nghiên cứu."] * 12)  # ~120 từ
FAKE = ai_check.AiCheckResult(ai_score=72, confidence="medium", verdict="Nhiều dấu hiệu AI.", signals=["Câu đều đặn"],
                              segments=[ai_check.Segment(text="Trí tuệ nhân tạo đang thay đổi", ai_likelihood=80, reason="Công thức")],
                              suggestions=["Thêm ví dụ cá nhân"], writing_feedback="Thiếu dẫn chứng.")


def _user(client, email):
    r = client.post("/api/auth/register", json={"email": email, "full_name": "AI", "password": "MatKhau2024"})
    verify(client, r.json()["access_token"], email)
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_disabled_without_key(client, monkeypatch):
    monkeypatch.setattr(settings, "anthropic_api_key", "")
    st = client.get("/api/ai-check/status").json()
    assert st["enabled"] is False and st["used_today"] == 0 and st["remaining"] == st["daily_limit"]
    h = _user(client, "ai0@example.com")
    assert client.post("/api/ai-check", json={"text": TEXT}, headers=h).status_code == 503


def test_run_and_daily_limit(client, monkeypatch):
    monkeypatch.setattr(settings, "anthropic_api_key", "sk-test")
    monkeypatch.setattr(settings, "ai_check_daily_limit", 2)
    calls = []
    monkeypatch.setattr(ai_check, "analyze", lambda text: calls.append(text) or FAKE)

    assert client.post("/api/ai-check", json={"text": TEXT}).status_code == 401
    # chưa xác thực email → 403
    r = client.post("/api/auth/register", json={"email": "ai-unverified@example.com", "full_name": "U", "password": "MatKhau2024"})
    assert client.post("/api/ai-check", json={"text": TEXT}, headers={"Authorization": f"Bearer {r.json()['access_token']}"}).status_code == 403

    h = _user(client, "ai1@example.com")
    assert client.post("/api/ai-check", json={"text": "quá ngắn"}, headers=h).status_code == 422
    assert client.post("/api/ai-check", json={"text": "x " * 20000}, headers=h).status_code == 422
    assert calls == []  # validate xong mới gọi Claude

    r = client.post("/api/ai-check", json={"text": TEXT}, headers=h)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["ai_score"] == 72 and d["confidence"] == "medium" and d["remaining"] == 1 and d["daily_limit"] == 2 and d["words"] > 100
    assert d["segments"][0]["ai_likelihood"] == 80 and d["model"] == settings.ai_check_model
    st = client.get("/api/ai-check/status", headers=h).json()
    assert st["enabled"] is True and st["used_today"] == 1 and st["remaining"] == 1

    assert client.post("/api/ai-check", json={"text": TEXT}, headers=h).status_code == 200
    r = client.post("/api/ai-check", json={"text": TEXT}, headers=h)
    assert r.status_code == 429 and "lượt" in r.json()["detail"]
    assert len(calls) == 2
    # người khác không bị ảnh hưởng hạn mức
    assert client.get("/api/ai-check/status", headers=_user(client, "ai2@example.com")).json()["remaining"] == 2
