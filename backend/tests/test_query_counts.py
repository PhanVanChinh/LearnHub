"""Số câu SQL của các endpoint danh sách không tăng theo số dòng (chống N+1)."""
from contextlib import contextmanager

from sqlalchemy import event

from app.database import engine
from tests.test_api import verify


@contextmanager
def count_queries():
    n = {"q": 0}
    def on(*_a, **_k): n["q"] += 1
    event.listen(engine, "before_cursor_execute", on)
    try:
        yield n
    finally:
        event.remove(engine, "before_cursor_execute", on)


def _student(client, email):
    r = client.post("/api/auth/register", json={"email": email, "full_name": "Q", "password": "MatKhau2024"})
    verify(client, r.json()["access_token"], email)
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_my_courses_constant_queries(client):
    h = _student(client, "nplus1@example.com")
    free = [c["slug"] for c in client.get("/api/courses?limit=200").json() if c["price"] == 0]
    client.post(f"/api/courses/{free[0]}/enroll", headers=h)
    with count_queries() as one:
        assert len(client.get("/api/courses/me/enrolled", headers=h).json()) == 1
    for slug in free[1:5]:
        client.post(f"/api/courses/{slug}/enroll", headers=h)
        client.put(f"/api/courses/{slug}/lessons/0/complete", headers=h)
    with count_queries() as many:
        rows = client.get("/api/courses/me/enrolled", headers=h).json()
    assert len(rows) == 5 and any(r["progress"]["completed"] == [0] for r in rows)
    assert many["q"] == one["q"], (one["q"], many["q"])


def _admin(client):
    r = client.post("/api/auth/login", json={"email": "admin@example.com", "password": "admin123"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_admin_lists_constant_queries(client):
    """Danh sách admin: số câu SQL giống nhau dù trang có 1 hay nhiều dòng."""
    admin = _admin(client)
    for i in range(4):
        h = _student(client, f"adm-nq{i}@example.com")
        for c in [c for c in client.get("/api/courses?limit=200").json() if c["price"] == 0][:2]:
            client.post(f"/api/courses/{c['slug']}/enroll", headers=h)
    for path in ("/api/admin/courses", "/api/admin/users", "/api/admin/enrollments", "/api/admin/orders", "/api/admin/reviews"):
        with count_queries() as one:
            client.get(path, params={"limit": 1}, headers=admin)
        with count_queries() as many:
            client.get(path, params={"limit": 200}, headers=admin)
        assert many["q"] == one["q"], (path, one["q"], many["q"])
