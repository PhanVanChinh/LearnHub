"""Quyền dữ liệu cá nhân: xuất dữ liệu (và xoá tài khoản ở commit sau)."""
from tests.test_api import verify


def _verified_user(client, email):
    r = client.post("/api/auth/register", json={"email": email, "full_name": "Data User", "password": "MatKhau2024"})
    verify(client, r.json()["access_token"], email)
    return {"Authorization": f"Bearer {r.json()['access_token']}"}, r.json()["user"]["id"]


def test_export_my_data(client):
    h, uid = _verified_user(client, "export@example.com")
    free = next(c for c in client.get("/api/courses").json() if c["price"] == 0)
    paid = next(c for c in client.get("/api/courses").json() if c["price"] > 0 and c["category"] != "ai-check")
    client.post(f"/api/courses/{free['slug']}/enroll", headers=h)
    client.put(f"/api/courses/{free['slug']}/lessons/0/complete", headers=h)
    client.post("/api/orders", json={"course_slug": paid["slug"]}, headers=h)
    client.post("/api/courses/trac-nghiem-triet-hoc-mac-lenin/lessons/0/quiz/submit", json={"answers": [1, 1, 1, 2, 2]}, headers=h)
    client.post("/api/contact", json={"name": "Data User", "email": "export@example.com", "subject": "Hỏi", "message": "Tôi muốn hỏi về khóa học này ạ"}, headers=h)

    assert client.get("/api/account/export").status_code == 401
    r = client.get("/api/account/export", headers=h)
    assert r.status_code == 200, r.text
    assert "attachment" in r.headers["content-disposition"] and ".json" in r.headers["content-disposition"]
    d = r.json()
    assert d["profile"]["email"] == "export@example.com" and d["profile"]["id"] == uid
    assert "hashed_password" not in str(d) and "MatKhau2024" not in str(d)
    assert [e["course_slug"] for e in d["enrollments"]] == [free["slug"]]
    assert d["lesson_progress"][0]["lesson_index"] == 0 and d["lesson_progress"][0]["lesson_title"]
    assert d["quiz_attempts"][0]["score"] == 5
    assert d["orders"][0]["course_slug"] == paid["slug"] and d["orders"][0]["status"] == "pending"
    assert d["contact_messages"][0]["subject"] == "Hỏi"
    assert d["ai_check_runs"] == []
    # người khác không thấy dữ liệu của mình lẫn vào
    h2, _ = _verified_user(client, "export2@example.com")
    d2 = client.get("/api/account/export", headers=h2).json()
    assert d2["enrollments"] == [] and d2["orders"] == [] and d2["contact_messages"] == []
