"""Ghi danh / duyệt đơn / đếm lượt xem an toàn khi có thao tác chen ngang."""
from app.database import SessionLocal
from app.enrollments import bump_views, ensure_enrollment
from app.models import Course, Enrollment, User
from tests.test_delete_safety import _admin
from tests.test_orders import _buyer, _paid_course


def test_ensure_enrollment_idempotent_and_counts_once(client):
    db = SessionLocal()
    try:
        course = db.query(Course).filter(Course.price == 0).first()
        user = db.query(User).filter_by(email="admin@example.com").first()
        sold = course.sold
        assert ensure_enrollment(db, user.id, course.id) is True
        assert ensure_enrollment(db, user.id, course.id) is False
        db.commit()
        db.refresh(course)
        assert course.sold == sold + 1
        assert db.query(Enrollment).filter_by(user_id=user.id, course_id=course.id).count() == 1
        # mô phỏng request khác chen vào giữa "kiểm tra" và "insert": insert trực tiếp rồi gọi lại → không vỡ, không cộng thêm
        other = db.query(Course).filter(Course.price == 0, Course.id != course.id).first()
        db.add(Enrollment(user_id=user.id, course_id=other.id)); db.flush()
        sold2 = other.sold
        assert ensure_enrollment(db, user.id, other.id) is False
        db.commit(); db.refresh(other)
        assert other.sold == sold2
    finally:
        db.close()


def test_bump_views_is_sql_expression(client):
    db = SessionLocal()
    try:
        course = db.query(Course).first()
        before = course.views
        for _ in range(3):
            bump_views(db, course.id)
        db.commit(); db.refresh(course)
        assert course.views == before + 3
    finally:
        db.close()


def test_confirm_order_once_even_with_existing_enrollment(client):
    """Admin đã cấp quyền tay trước → duyệt đơn không tạo ghi danh trùng, không cộng sold lần hai; duyệt lại → 400."""
    admin = _admin(client)
    h = _buyer(client, "race@example.com")
    course = _paid_course(client)
    o = client.post("/api/orders", json={"course_slug": course["slug"]}, headers=h).json()
    uid = client.get("/api/auth/me", headers=h).json()["id"]
    cid = client.get("/api/admin/courses", params={"q": course["slug"]}, headers=admin).json()["items"][0]["id"]
    assert client.post("/api/admin/enrollments", json={"user_id": uid, "course_id": cid}, headers=admin).status_code == 201
    assert client.post("/api/admin/enrollments", json={"user_id": uid, "course_id": cid}, headers=admin).status_code == 409
    sold = client.get(f"/api/admin/courses/{cid}", headers=admin).json()["sold"]
    r = client.post(f"/api/admin/orders/{o['id']}/confirm", json={"note": "FT1"}, headers=admin)
    assert r.status_code == 200 and r.json()["status"] == "paid"
    assert client.get(f"/api/admin/courses/{cid}", headers=admin).json()["sold"] == sold
    assert client.post(f"/api/admin/orders/{o['id']}/confirm", json={"note": "FT2"}, headers=admin).status_code == 400
    assert client.get("/api/admin/enrollments", params={"user_id": uid}, headers=admin).json()["total"] == 1
