"""Đánh giá khóa học: quyền, một người một đánh giá, ngưỡng hiển thị trung bình, admin ẩn."""
from tests.test_api import verify


def _user(client, email):
    r = client.post("/api/auth/register", json={"email": email, "full_name": f"Người {email[:3].upper()}", "password": "MatKhau2024"})
    verify(client, r.json()["access_token"], email)
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _admin(client):
    r = client.post("/api/auth/login", json={"email": "admin@example.com", "password": "admin123"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_review_flow(client):
    free = next(c for c in client.get("/api/courses").json() if c["price"] == 0)
    slug = free["slug"]
    url = f"/api/courses/{slug}/reviews"
    assert client.get(url).json() == {"summary": {"count": 0, "average": None, "distribution": {"5": 0, "4": 0, "3": 0, "2": 0, "1": 0}}, "total": 0, "items": [], "mine": None, "can_review": False}

    h1 = _user(client, "rv1@example.com")
    assert client.put(f"{url}/me", json={"rating": 5}, headers=h1).status_code == 403  # chưa ghi danh
    client.post(f"/api/courses/{slug}/enroll", headers=h1)
    assert client.get(url, headers=h1).json()["can_review"] is True
    assert client.put(f"{url}/me", json={"rating": 6}, headers=h1).status_code == 422
    r = client.put(f"{url}/me", json={"rating": 4, "comment": "  Khá   hay  "}, headers=h1)
    assert r.status_code == 200 and r.json()["comment"] == "Khá hay" and r.json()["mine"] is True and r.json()["user_initial"] == "N"
    # sửa → vẫn 1 đánh giá
    client.put(f"{url}/me", json={"rating": 5, "comment": "Rất hay"}, headers=h1)
    d = client.get(url, headers=h1).json()
    assert d["total"] == 1 and d["mine"]["rating"] == 5 and d["summary"]["count"] == 1 and d["summary"]["average"] is None  # < 3 → chưa hiện TB

    for i, rating in ((2, 3), (3, 4)):
        h = _user(client, f"rv{i}@example.com")
        client.post(f"/api/courses/{slug}/enroll", headers=h)
        client.put(f"{url}/me", json={"rating": rating}, headers=h)
    d = client.get(url).json()
    assert d["summary"]["count"] == 3 and d["summary"]["average"] == 4.0 and d["summary"]["distribution"]["5"] == 1
    assert d["items"][0]["comment"] == "Rất hay"  # có nhận xét lên đầu
    assert all(x["mine"] is False for x in d["items"])  # khách
    # stats/courses có rating
    row = next(r for r in client.get("/api/stats/courses").json() if r["slug"] == slug)
    assert row["rating"]["average"] == 4.0 and row["rating"]["count"] == 3

    # xoá của tôi
    assert client.delete(f"{url}/me", headers=h1).status_code == 204
    assert client.delete(f"{url}/me", headers=h1).status_code == 404
    assert client.get(url).json()["summary"]["count"] == 2


def test_admin_hide_review(client):
    admin = _admin(client)
    free = next(c for c in client.get("/api/courses").json() if c["price"] == 0)
    slug = free["slug"]
    h = _user(client, "rv-bad@example.com")
    client.post(f"/api/courses/{slug}/enroll", headers=h)
    rid = client.put(f"/api/courses/{slug}/reviews/me", json={"rating": 1, "comment": "spam link xxx"}, headers=h).json()["id"]
    before = client.get(f"/api/courses/{slug}/reviews").json()["summary"]["count"]

    assert client.post(f"/api/admin/reviews/{rid}/hide", json={}, headers=h).status_code == 403
    lst = client.get("/api/admin/reviews", params={"q": "spam"}, headers=admin).json()
    assert lst["total"] == 1 and lst["items"][0]["user_email"] == "rv-bad@example.com" and lst["items"][0]["hidden"] is False
    r = client.post(f"/api/admin/reviews/{rid}/hide", json={"reason": "spam"}, headers=admin)
    assert r.status_code == 200 and r.json()["hidden"] is True and r.json()["hidden_reason"] == "spam"
    d = client.get(f"/api/courses/{slug}/reviews", headers=h).json()
    assert d["summary"]["count"] == before - 1 and all(x["id"] != rid for x in d["items"]) and d["mine"]["id"] == rid  # chủ vẫn thấy của mình
    assert client.get("/api/admin/reviews", params={"hidden": True}, headers=admin).json()["total"] >= 1
    assert client.get("/api/admin/audit", params={"action": "review.hide"}, headers=admin).json()["total"] == 1
    # hiện lại
    assert client.post(f"/api/admin/reviews/{rid}/hide", json={}, headers=admin).json()["hidden"] is False
    assert client.post("/api/admin/reviews/99999/hide", json={}, headers=admin).status_code == 404
