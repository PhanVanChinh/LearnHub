def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_register_login_me(client):
    r = client.post("/api/auth/register", json={"email": "sv@phenikaa.edu.vn", "full_name": "Sinh Viên", "password": "secret123"})
    assert r.status_code == 201, r.text
    token = r.json()["access_token"]
    assert r.json()["user"]["role"] == "user"

    # trùng email
    assert client.post("/api/auth/register", json={"email": "SV@phenikaa.edu.vn", "full_name": "x", "password": "secret123"}).status_code == 409

    # sai mật khẩu
    assert client.post("/api/auth/login", json={"email": "sv@phenikaa.edu.vn", "password": "wrong"}).status_code == 401

    r = client.post("/api/auth/login", json={"email": "sv@phenikaa.edu.vn", "password": "secret123"})
    assert r.status_code == 200

    assert client.get("/api/auth/me").status_code == 401
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200 and me.json()["email"] == "sv@phenikaa.edu.vn"


def test_admin_seeded(client):
    r = client.post("/api/auth/login", json={"email": "admin@example.com", "password": "admin123"})
    assert r.status_code == 200 and r.json()["user"]["role"] == "admin"


def test_courses(client):
    all_ = client.get("/api/courses").json()
    assert len(all_) >= 20
    quiz = client.get("/api/courses", params={"category": "quiz"}).json()
    assert quiz and all("quiz" in c["tags"] for c in quiz)
    free = client.get("/api/courses", params={"category": "free"}).json()
    assert free and all(c["price"] == 0 for c in free)
    assert client.get("/api/courses", params={"q": "python"}).json()
    cats = {c["key"]: c["count"] for c in client.get("/api/courses/categories").json()}
    assert cats["all"] == len(all_) and cats["quiz"] == len(quiz)

    slug = free[0]["slug"]
    d = client.get(f"/api/courses/{slug}").json()
    assert d["lessons"] and d["enrolled"] is False
    assert client.get("/api/courses/khong-ton-tai").status_code == 404


def test_enroll_flow(client):
    token = client.post("/api/auth/login", json={"email": "sv@phenikaa.edu.vn", "password": "secret123"}).json()["access_token"]
    h = {"Authorization": f"Bearer {token}"}
    free = client.get("/api/courses", params={"category": "free"}).json()[0]["slug"]
    paid = next(c for c in client.get("/api/courses").json() if c["price"] > 0)["slug"]

    assert client.post(f"/api/courses/{free}/enroll").status_code == 401
    assert client.post(f"/api/courses/{paid}/enroll", headers=h).status_code == 402
    r = client.post(f"/api/courses/{free}/enroll", headers=h)
    assert r.status_code == 201 and r.json()["enrolled"] is True
    assert client.get(f"/api/courses/{free}", headers=h).json()["enrolled"] is True
    mine = client.get("/api/courses/me/enrolled", headers=h).json()
    assert [c["slug"] for c in mine] == [free]


def test_lesson_video_access(client):
    """Video bài free: công khai. Bài khác: ẩn ID với người chưa ghi danh, endpoint trả 401/403."""
    admin = {"Authorization": f"Bearer {client.post('/api/auth/login', json={'email': 'admin@example.com', 'password': 'admin123'}).json()['access_token']}"}
    # tạo khóa trả phí có video ở cả bài free và bài khoá
    r = client.post("/api/admin/courses", json={
        "slug": "khoa-video-khoa", "title": "Khóa video", "category": "video", "price": 50000,
        "lessons": [{"title": "Xem thử", "duration": "1:00", "free": True, "video": "aircAruvnKk"},
                    {"title": "Bài khoá", "duration": "2:00", "video": "IHZwWFHWa-w"},
                    {"title": "Chưa có video", "duration": "3:00"}],
    }, headers=admin)
    assert r.status_code == 201, r.text
    cid = r.json()["id"]

    # public detail: bài free giữ video, bài khoá chỉ còn has_video
    d = client.get("/api/courses/khoa-video-khoa").json()
    assert d["lessons"][0]["video"] == "aircAruvnKk"
    assert d["lessons"][1]["video"] is None and d["lessons"][1]["has_video"] is True
    assert d["lessons"][2]["video"] is None and d["lessons"][2]["has_video"] is False

    # endpoint video
    assert client.get("/api/courses/khoa-video-khoa/lessons/0/video").json()["video"] == "aircAruvnKk"
    assert client.get("/api/courses/khoa-video-khoa/lessons/1/video").status_code == 401
    assert client.get("/api/courses/khoa-video-khoa/lessons/9/video").status_code == 404
    assert client.get("/api/courses/khong-ton-tai/lessons/0/video").status_code == 404

    token = client.post("/api/auth/login", json={"email": "sv@phenikaa.edu.vn", "password": "secret123"}).json()["access_token"]
    h = {"Authorization": f"Bearer {token}"}
    assert client.get("/api/courses/khoa-video-khoa/lessons/1/video", headers=h).status_code == 403

    # admin cấp quyền → xem được, detail cũng trả đầy đủ video
    uid = client.get("/api/auth/me", headers=h).json()["id"]
    assert client.post("/api/admin/enrollments", json={"user_id": uid, "course_id": cid}, headers=admin).status_code == 201
    r = client.get("/api/courses/khoa-video-khoa/lessons/1/video", headers=h)
    assert r.status_code == 200 and r.json()["video"] == "IHZwWFHWa-w"
    assert client.get("/api/courses/khoa-video-khoa/lessons/2/video", headers=h).json()["video"] is None
    d = client.get("/api/courses/khoa-video-khoa", headers=h).json()
    assert d["enrolled"] is True and d["lessons"][1]["video"] == "IHZwWFHWa-w"

    client.delete(f"/api/admin/courses/{cid}", headers=admin)
