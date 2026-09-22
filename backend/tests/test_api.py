import re

from app import mailer


def last_otp(to: str) -> str:
    """Lấy mã 6 số trong email cuối cùng gửi tới `to` (chế độ console)."""
    mail = next(m for m in reversed(mailer.console_outbox) if m["to"] == to)
    return re.search(r">(\d{6})<", mail["html"]).group(1)


def verify(client, token: str, email: str) -> None:
    r = client.post("/api/auth/verification/confirm", json={"code": last_otp(email)}, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200 and r.json()["email_verified"] is True, r.text


def test_health(client):
    assert client.get("/api/health").json()["status"] == "ok"


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
    assert client.post(f"/api/courses/{free}/enroll", headers=h).status_code == 403  # chưa xác thực email
    verify(client, token, "sv@phenikaa.edu.vn")
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


def test_progress_flow(client):
    """Đánh dấu hoàn thành bài học, tính phần trăm, chỉ cho người đã ghi danh."""
    token = client.post("/api/auth/login", json={"email": "sv@phenikaa.edu.vn", "password": "secret123"}).json()["access_token"]
    h = {"Authorization": f"Bearer {token}"}
    free = client.get("/api/courses", params={"category": "free"}).json()[0]["slug"]  # đã ghi danh ở test_enroll_flow
    paid = next(c for c in client.get("/api/courses").json() if c["price"] > 0)["slug"]
    total = len(client.get(f"/api/courses/{free}").json()["lessons"])

    assert client.get(f"/api/courses/{free}/progress").status_code == 401
    assert client.get(f"/api/courses/{paid}/progress", headers=h).status_code == 403  # chưa ghi danh
    assert client.put(f"/api/courses/{paid}/lessons/0/complete", headers=h).status_code == 403

    p = client.get(f"/api/courses/{free}/progress", headers=h).json()
    assert p == {"completed": [], "total": total, "percent": 0, "next_index": 0}

    p = client.put(f"/api/courses/{free}/lessons/0/complete", headers=h).json()
    assert p["completed"] == [0] and p["next_index"] == 1
    p = client.put(f"/api/courses/{free}/lessons/0/complete", headers=h).json()  # idempotent
    assert p["completed"] == [0]
    p = client.put(f"/api/courses/{free}/lessons/2/complete", headers=h).json()
    assert p["completed"] == [0, 2] and p["percent"] == round(2 * 100 / total) and p["next_index"] == 1
    assert client.put(f"/api/courses/{free}/lessons/99/complete", headers=h).status_code == 404

    mine = client.get("/api/courses/me/enrolled", headers=h).json()
    assert mine[0]["slug"] == free and mine[0]["progress"]["completed"] == [0, 2]

    p = client.delete(f"/api/courses/{free}/lessons/2/complete", headers=h).json()
    assert p["completed"] == [0]

    # hoàn thành hết → next_index None, 100%
    for i in range(total):
        p = client.put(f"/api/courses/{free}/lessons/{i}/complete", headers=h).json()
    assert p["percent"] == 100 and p["next_index"] is None


def test_password_policy(client):
    def reg(pw, email="pw-test@example.com", **extra):
        return client.post("/api/auth/register", json={"email": email, "full_name": "Test", "password": pw, **extra})

    weak = {
        "abc123": "ít nhất 8",           # ngắn
        "abcdefgh": "chữ số",            # không số
        "12345678": "chữ cái",           # không chữ  (cũng nằm trong danh sách phổ biến, nhưng lỗi chữ cái báo trước)
        "password1": "phổ biến",
        " abcd1234": "khoảng trắng",
        "pw-test2024": "tên đăng nhập",  # chứa local-part của email
    }
    for pw, expect in weak.items():
        r = reg(pw)
        assert r.status_code == 422, (pw, r.text)
        body = r.json()
        assert expect in body["detail"], (pw, body["detail"])
        assert body["errors"][0]["field"] == "password"

    # thiếu đồng ý điều khoản
    r = reg("HopLe2024", accept_terms=False)
    assert r.status_code == 422 and r.json()["errors"][0]["field"] == "accept_terms"
    # email sai định dạng → thông báo tiếng Việt
    r = reg("HopLe2024", email="khong-phai-email")
    assert r.status_code == 422 and r.json()["detail"] == "Email không hợp lệ"

    # hợp lệ + chuẩn hoá email/họ tên
    r = client.post("/api/auth/register", json={"email": "  PW-Test@Example.com ", "full_name": "  Nguyễn   Văn  A ", "password": "HopLe2024"})
    assert r.status_code == 201, r.text
    assert r.json()["user"]["email"] == "pw-test@example.com" and r.json()["user"]["full_name"] == "Nguyễn Văn A"

    # đổi mật khẩu cũng áp quy tắc
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    assert client.post("/api/auth/change-password", json={"current_password": "HopLe2024", "new_password": "short1"}, headers=h).status_code == 422
    r2 = client.post("/api/auth/change-password", json={"current_password": "HopLe2024", "new_password": "MoiHopLe2025"}, headers=h)
    assert r2.status_code == 200 and "access_token" in r2.json()
    # token cũ hết hiệu lực, token mới dùng được
    assert client.get("/api/auth/me", headers=h).status_code == 401
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {r2.json()['access_token']}"}).status_code == 200



def test_email_verification_flow(client):
    email = "verify-me@example.com"
    r = client.post("/api/auth/register", json={"email": email, "full_name": "Verify", "password": "HopLe2024"})
    assert r.status_code == 201 and r.json()["user"]["email_verified"] is False
    token = r.json()["access_token"]
    h = {"Authorization": f"Bearer {token}"}

    # đã gửi mail có mã 6 số
    code = last_otp(email)
    assert re.fullmatch(r"\d{6}", code)
    st = client.get("/api/auth/verification", headers=h).json()
    assert st["email_verified"] is False and st["mail_provider"] == "console" and st["cooldown_seconds"] > 0

    # gửi lại ngay → 429 (cooldown)
    assert client.post("/api/auth/verification/resend", headers=h).status_code == 429

    # sai mã → 400 kèm số lần còn lại; sai định dạng → 422
    wrong = "000000" if code != "000000" else "111111"
    r = client.post("/api/auth/verification/confirm", json={"code": wrong}, headers=h)
    assert r.status_code == 400 and "còn 4 lần" in r.json()["detail"]
    assert client.post("/api/auth/verification/confirm", json={"code": "12ab"}, headers=h).status_code == 422

    # chưa xác thực → không ghi danh được
    free = client.get("/api/courses", params={"category": "free"}).json()[1]["slug"]
    assert client.post(f"/api/courses/{free}/enroll", headers=h).status_code == 403

    # đúng mã → xác thực; /me phản ánh; resend sau đó bị từ chối; ghi danh được
    verify(client, token, email)
    assert client.get("/api/auth/me", headers=h).json()["email_verified"] is True
    assert client.post("/api/auth/verification/resend", headers=h).status_code == 400
    assert client.post(f"/api/courses/{free}/enroll", headers=h).status_code == 201

    # admin seed đã xác thực sẵn
    admin = client.post("/api/auth/login", json={"email": "admin@example.com", "password": "admin123"}).json()["user"]
    assert admin["email_verified"] is True



def test_forgot_reset_password_flow(client):
    email = "reset-me@example.com"
    r = client.post("/api/auth/register", json={"email": email, "full_name": "Reset", "password": "CuHopLe2024"})
    old_token = r.json()["access_token"]
    n_mails = len(mailer.console_outbox)

    # email lạ → vẫn 200, cùng thông báo, không gửi mail
    r = client.post("/api/auth/forgot-password", json={"email": "khong-co@example.com"})
    assert r.status_code == 200 and "Nếu email tồn tại" in r.json()["detail"]
    assert len(mailer.console_outbox) == n_mails

    # email đúng → gửi mail chứa link có token
    assert client.post("/api/auth/forgot-password", json={"email": email.upper()}).status_code == 200
    mail = mailer.console_outbox[-1]
    assert mail["to"] == email and "Đặt lại mật khẩu" in mail["subject"]
    token = re.search(r"reset-password\?token=([A-Za-z0-9_-]+)", mail["html"]).group(1)
    # gửi lại ngay → không tạo mail mới (cooldown) nhưng vẫn 200
    client.post("/api/auth/forgot-password", json={"email": email})
    assert len(mailer.console_outbox) == n_mails + 1

    # token sai / mật khẩu yếu
    assert client.post("/api/auth/reset-password", json={"token": "x" * 40, "new_password": "MoiHopLe2025"}).status_code == 400
    assert client.post("/api/auth/reset-password", json={"token": token, "new_password": "yeu"}).status_code == 422

    # đặt lại thành công → mật khẩu cũ sai, mới đúng, token dùng 1 lần, phiên cũ bị đăng xuất, email coi như đã xác thực
    assert client.post("/api/auth/reset-password", json={"token": token, "new_password": "MoiHopLe2025"}).status_code == 204
    assert client.post("/api/auth/reset-password", json={"token": token, "new_password": "KhacNua2026"}).status_code == 400
    assert client.post("/api/auth/login", json={"email": email, "password": "CuHopLe2024"}).status_code == 401
    r = client.post("/api/auth/login", json={"email": email, "password": "MoiHopLe2025"})
    assert r.status_code == 200 and r.json()["user"]["email_verified"] is True
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {old_token}"}).status_code == 401


def test_export_courses_public(client):
    """Export cho build tĩnh: đủ mọi khóa, đủ mô tả/bài học, nhưng không lộ video bài trả phí."""
    rows = client.get("/api/courses/export").json()
    assert len(rows) == len(client.get("/api/courses", params={"limit": 200}).json())
    ml = next(c for c in rows if c["slug"] == "video-nhap-mon-machine-learning")
    assert ml["description"] and ml["includes"] and len(ml["lessons"]) >= 5
    paid = [l for l in ml["lessons"] if not l["free"]]
    assert any(l["has_video"] for l in paid), "seed phải có video ở bài trả phí để test có ý nghĩa"
    assert all(l["video"] is None for l in paid)
    assert any(l["free"] and l["video"] for l in ml["lessons"])  # bài xem thử vẫn có video
    # không có bất kỳ ID video trả phí nào trong toàn bộ export
    import json
    from app.database import SessionLocal
    from app.models import Course
    db = SessionLocal()
    paid_ids = {l["video"] for c in db.query(Course).all() for l in c.lessons if l.get("video") and not l.get("free")}
    db.close()
    dump = json.dumps(rows)
    assert paid_ids and not any(v in dump for v in paid_ids)
