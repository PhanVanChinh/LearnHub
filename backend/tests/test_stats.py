"""Số liệu công khai phải phản ánh dữ liệu thật trong DB."""
from tests.test_api import verify


def test_seed_starts_at_zero(client):
    rows = client.get("/api/stats/courses").json()
    assert rows and all(r["views"] == 0 and r["students"] == 0 for r in rows)
    s = client.get("/api/stats").json()
    assert s["courses"] == len(rows) and s["students"] == 0 and s["enrollments"] == 0 and s["views"] == 0
    assert s["lessons"] > 0 and 0 < s["videos"] <= s["lessons"]


def test_stats_follow_real_activity(client):
    free = next(c for c in client.get("/api/courses").json() if c["price"] == 0)
    slug = free["slug"]

    # xem trang chi tiết 2 lần → views = 2
    client.get(f"/api/courses/{slug}"); client.get(f"/api/courses/{slug}")
    row = next(r for r in client.get("/api/stats/courses").json() if r["slug"] == slug)
    assert row["views"] == 2 and row["students"] == 0

    # 2 người ghi danh → students = 2; một người ghi danh 2 khóa vẫn tính 1 học viên toàn site
    hs = []
    for i in range(2):
        email = f"stat{i}@example.com"
        r = client.post("/api/auth/register", json={"email": email, "full_name": f"S{i}", "password": "MatKhau2024"})
        h = {"Authorization": f"Bearer {r.json()['access_token']}"}
        verify(client, r.json()["access_token"], email)
        assert client.post(f"/api/courses/{slug}/enroll", headers=h).status_code == 201
        hs.append(h)
    other = next(c for c in client.get("/api/courses").json() if c["price"] == 0 and c["slug"] != slug)
    assert client.post(f"/api/courses/{other['slug']}/enroll", headers=hs[0]).status_code == 201

    row = next(r for r in client.get("/api/stats/courses").json() if r["slug"] == slug)
    assert row["students"] == 2
    s = client.get("/api/stats").json()
    assert s["students"] == 2 and s["enrollments"] == 3 and s["views"] >= 2
