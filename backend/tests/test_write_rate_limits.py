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


def test_expired_buckets_are_swept(monkeypatch):
    """Bucket của IP không quay lại phải được dọn sau khi hết window, bucket còn hạn thì giữ."""
    clock = [1000.0]
    monkeypatch.setattr(ratelimit.time, "monotonic", lambda: clock[0])
    ratelimit.reset()
    try:
        for i in range(1000):
            assert ratelimit.hit(f"login:10.0.{i // 256}.{i % 256}", 10, 60) == 0
        assert ratelimit.hit("register:9.9.9.9", 5, 3600) == 0  # window dài, chưa hết hạn lúc dọn
        assert len(ratelimit._buckets) == 1001
        clock[0] += 30
        ratelimit.hit("login:1.1.1.1", 10, 60)  # chưa tới lượt dọn (mỗi 60 giây)
        assert len(ratelimit._buckets) == 1002
        clock[0] += 31  # 61 giây sau lần dọn đầu: 1000 bucket login đã quá window 60 giây
        ratelimit.hit("login:2.2.2.2", 10, 60)
        assert set(ratelimit._buckets) == {"register:9.9.9.9", "login:1.1.1.1", "login:2.2.2.2"}
        # bucket giữ lại vẫn đếm đúng
        for _ in range(4):
            assert ratelimit.hit("register:9.9.9.9", 5, 3600) == 0
        assert ratelimit.hit("register:9.9.9.9", 5, 3600) > 0
    finally:
        ratelimit.reset()
