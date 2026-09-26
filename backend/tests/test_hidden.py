"""Ẩn khóa học: biến mất khỏi danh sách/tìm kiếm/export/thống kê, vẫn mở được bằng link trực tiếp."""
NEW = {"slug": "khoa-trong", "title": "Khóa trống", "category": "video", "price": 0, "short": "s", "description": "d",
       "includes": [], "lessons": [{"title": "Bài 1", "duration": "10:00"}]}
FULL = {**NEW, "slug": "khoa-co-noi-dung", "title": "Khóa có nội dung",
        "lessons": [{"title": "Bài 1", "duration": "10:00", "video": "aircAruvnKk"}]}


def _admin(client):
    r = client.post("/api/auth/login", json={"email": "admin@example.com", "password": "admin123"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_toggle_hidden(client):
    admin = _admin(client)
    cid = client.post("/api/admin/courses", json=NEW, headers=admin).json()["id"]
    assert any(c["slug"] == "khoa-trong" for c in client.get("/api/courses", params={"limit": 200}).json())

    r = client.post(f"/api/admin/courses/{cid}/hidden", headers=admin)
    assert r.status_code == 200 and r.json()["hidden"] is True
    # biến mất khỏi mọi nơi công khai
    assert not any(c["slug"] == "khoa-trong" for c in client.get("/api/courses", params={"limit": 200}).json())
    assert not any(c["slug"] == "khoa-trong" for c in client.get("/api/courses/export").json())
    assert not any(r["slug"] == "khoa-trong" for r in client.get("/api/stats/courses").json())
    assert not any(c["slug"] == "khoa-trong" for c in client.get("/api/courses", params={"q": "Khóa trống"}).json())
    # nhưng link trực tiếp vẫn mở được (admin xem trước, người đã ghi danh học tiếp)
    assert client.get("/api/courses/khoa-trong").json()["hidden"] is True
    # admin lọc được theo trạng thái
    assert any(c["slug"] == "khoa-trong" for c in client.get("/api/admin/courses", params={"hidden": True}, headers=admin).json()["items"])
    assert client.post(f"/api/admin/courses/{cid}/hidden", headers=admin).json()["hidden"] is False
    assert client.get("/api/admin/audit", params={"action": "course.hide"}, headers=admin).json()["total"] >= 1


def test_hide_empty_bulk(client):
    admin = _admin(client)
    client.post("/api/admin/courses", json=FULL, headers=admin)
    empty_id = client.post("/api/admin/courses", json={**NEW, "slug": "khoa-trong-2"}, headers=admin).json()["id"]

    dry = client.post("/api/admin/courses/hide-empty", params={"dry_run": True}, headers=admin).json()
    assert dry["dry_run"] is True and "khoa-trong-2" in dry["slugs"] and "khoa-co-noi-dung" not in dry["slugs"]
    assert client.get(f"/api/admin/courses/{empty_id}", headers=admin).json()["hidden"] is False  # dry run không đổi gì

    r = client.post("/api/admin/courses/hide-empty", headers=admin).json()
    assert r["hidden"] == len(dry["slugs"]) and "khoa-trong-2" in r["slugs"]
    assert client.get(f"/api/admin/courses/{empty_id}", headers=admin).json()["hidden"] is True
    assert client.get("/api/courses/khoa-co-noi-dung").json()["hidden"] is False  # khóa có nội dung không bị ẩn
    # chạy lại → không còn gì để ẩn
    assert client.post("/api/admin/courses/hide-empty", headers=admin).json()["hidden"] == 0
