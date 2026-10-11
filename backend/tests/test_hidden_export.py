"""Khóa ẩn: export mặc định bỏ qua; include_hidden=true trả kèm cờ hidden để build tĩnh vẫn sinh trang học cho người đã ghi danh."""


def _admin(client):
    r = client.post("/api/auth/login", json={"email": "admin@example.com", "password": "admin123"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_export_include_hidden(client):
    admin = _admin(client)
    r = client.post("/api/admin/courses", json={"slug": "khoa-an", "title": "Khóa ẩn", "category": "pdf", "price": 0, "short": "s",
                                                "description": "d", "includes": [], "lessons": [], "hidden": True}, headers=admin)
    assert r.status_code == 201, r.text
    assert "khoa-an" not in {c["slug"] for c in client.get("/api/courses/export").json()}
    rows = {c["slug"]: c for c in client.get("/api/courses/export", params={"include_hidden": "true"}).json()}
    assert rows["khoa-an"]["hidden"] is True and all(not c["hidden"] for s, c in rows.items() if s != "khoa-an")
    # trang chi tiết theo link trực tiếp vẫn mở được
    assert client.get("/api/courses/khoa-an").status_code == 200
