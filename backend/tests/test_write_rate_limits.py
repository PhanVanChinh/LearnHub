"""Các endpoint ghi của người học có giới hạn tần suất: spam nộp trắc nghiệm không làm phình DB vô hạn."""
from app import ratelimit
from app.config import settings


def test_quiz_submit_is_rate_limited(client, monkeypatch):
    free = next(c for c in client.get("/api/courses/export").json() if c["price"] == 0 and any(l["quiz_count"] and l["free"] for l in c["lessons"]))
    idx = next(i for i, l in enumerate(free["lessons"]) if l["quiz_count"] and l["free"])
    answers = [None] * free["lessons"][idx]["quiz_count"]
    monkeypatch.setattr(settings, "rate_limit_enabled", True)
    ratelimit.reset()
    try:
        codes = [client.post(f"/api/courses/{free['slug']}/lessons/{idx}/quiz/submit", json={"answers": answers}).status_code for _ in range(31)]
        assert codes[:30] == [200] * 30 and codes[30] == 429
    finally:
        ratelimit.reset()


def test_note_save_is_rate_limited(client, monkeypatch):
    from tests.test_api import verify
    free = next(c for c in client.get("/api/courses/export").json() if c["price"] == 0 and c["lessons"] and c["lessons"][0]["free"])
    email = "notelimit@example.com"
    r = client.post("/api/auth/register", json={"email": email, "full_name": "N", "password": "MatKhau2024"})
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    verify(client, r.json()["access_token"], email)
    monkeypatch.setattr(settings, "rate_limit_enabled", True)
    ratelimit.reset()
    try:
        url = f"/api/courses/{free['slug']}/lessons/0/note"
        codes = [client.put(url, json={"text": f"v{i}"}, headers=h).status_code for i in range(121)]
        assert codes[:120] == [200] * 120 and codes[120] == 429
    finally:
        ratelimit.reset()
