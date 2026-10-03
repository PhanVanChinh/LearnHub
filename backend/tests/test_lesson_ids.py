"""Mã cố định của bài học giữ nguyên khi admin chèn / xóa / đổi thứ tự / đổi tên bài."""
from app.lessons import assign_lesson_ids


def _admin(client):
    r = client.post("/api/auth/login", json={"email": "admin@example.com", "password": "admin123"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _lesson(title):
    return {"title": title, "duration": "1:00"}


def test_assign_ids_pure():
    old = assign_lesson_ids([_lesson("A"), _lesson("B"), _lesson("C")])
    a, b, c = (l["id"] for l in old)
    assert len({a, b, c}) == 3 and all(len(x) == 8 for x in (a, b, c))
    # đổi thứ tự: theo tiêu đề (không phân biệt hoa thường / khoảng trắng thừa); cùng số bài → bài tên lạ ở vị trí 2 coi như B đổi tên
    new = assign_lesson_ids([_lesson("C"), _lesson("Mới"), _lesson("a  ")], old)
    assert [l["id"] for l in new] == [c, b, a]
    # chèn thêm bài (số bài tăng): bài cũ giữ mã, bài mới nhận mã mới
    new = assign_lesson_ids([_lesson("Mới"), _lesson("A"), _lesson("B"), _lesson("C")], old)
    assert [l["id"] for l in new][1:] == [a, b, c] and new[0]["id"] not in (a, b, c)
    # xóa B, giữ nguyên còn lại
    new = assign_lesson_ids([_lesson("A"), _lesson("C")], old)
    assert [l["id"] for l in new] == [a, c]
    # đổi tên tại chỗ (số bài không đổi)
    new = assign_lesson_ids([_lesson("A"), _lesson("B đã sửa"), _lesson("C")], old)
    assert [l["id"] for l in new] == [a, b, c]
    # id gửi lên thuộc khóa thì được ưu tiên dù tiêu đề khác
    new = assign_lesson_ids([{"title": "Khác hẳn", "duration": "1:00", "id": b}], old)
    assert new[0]["id"] == b
    # id lạ (không thuộc khóa) bị thay bằng id mới
    new = assign_lesson_ids([{"title": "X", "duration": "1:00", "id": "deadbeef"}], old)
    assert new[0]["id"] != "deadbeef"
    # hai bài trùng tiêu đề: mỗi bài nhận một id cũ khác nhau
    old2 = assign_lesson_ids([_lesson("Ôn tập"), _lesson("Ôn tập")])
    new = assign_lesson_ids([_lesson("Ôn tập"), _lesson("Ôn tập")], old2)
    assert [l["id"] for l in new] == [l["id"] for l in old2]


def test_ids_assigned_and_kept_via_admin_api(client):
    admin = _admin(client)
    r = client.post("/api/admin/courses", json={
        "slug": "khoa-ma-bai", "title": "Khóa mã bài", "category": "pdf", "price": 0, "short": "s", "description": "d", "includes": [],
        "lessons": [_lesson("Mở đầu"), _lesson("Chương 1"), _lesson("Chương 2")],
    }, headers=admin)
    assert r.status_code == 201, r.text
    cid = r.json()["id"]
    ids = [l["id"] for l in r.json()["lessons"]]
    assert len(set(ids)) == 3 and all(ids)
    # public API cũng trả id
    assert [l["id"] for l in client.get("/api/courses/khoa-ma-bai").json()["lessons"]] == ids

    # admin lưu lại với bài mới chèn đầu và đổi thứ tự hai chương, không gửi id
    r = client.patch(f"/api/admin/courses/{cid}", json={"lessons": [_lesson("Giới thiệu"), _lesson("Chương 2"), _lesson("Chương 1"), _lesson("Mở đầu")]}, headers=admin)
    assert r.status_code == 200, r.text
    got = {l["title"]: l["id"] for l in r.json()["lessons"]}
    assert got["Mở đầu"] == ids[0] and got["Chương 1"] == ids[1] and got["Chương 2"] == ids[2]
    assert got["Giới thiệu"] not in ids


def test_seed_courses_have_ids(client):
    for c in client.get("/api/courses/export").json():
        assert all(l.get("id") for l in c["lessons"]), c["slug"]
