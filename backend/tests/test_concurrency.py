"""Ghi danh / duyệt đơn / đếm lượt xem an toàn khi có thao tác chen ngang."""
from datetime import datetime, timedelta

import pytest
from sqlalchemy.exc import IntegrityError

from app.database import SessionLocal
from app.enrollments import bump_views, ensure_enrollment
from app.models import Course, Enrollment, Order, User
from app.routers import orders as orders_router
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


def test_two_pending_orders_same_course_rejected_by_db(client):
    """Unique index có điều kiện: 2 đơn chờ cùng người cùng khóa bị DB từ chối; đơn đã hủy/hết hạn không tính."""
    db = SessionLocal()
    try:
        user = db.query(User).filter_by(email="admin@example.com").one()
        course = db.query(Course).filter(Course.price > 0).first()
        exp = datetime.utcnow() + timedelta(hours=1)
        db.add(Order(code="LHTEST01", user_id=user.id, course_id=course.id, amount=1, status="cancelled", expires_at=exp))
        db.add(Order(code="LHTEST02", user_id=user.id, course_id=course.id, amount=1, status="pending", expires_at=exp))
        db.commit()
        db.add(Order(code="LHTEST03", user_id=user.id, course_id=course.id, amount=1, status="pending", expires_at=exp))
        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()
        db.query(Order).filter(Order.code.like("LHTEST%")).delete(synchronize_session=False); db.commit()
    finally:
        db.close()


def test_create_order_race_returns_existing(client, monkeypatch):
    """Hai request tạo đơn chen nhau: request thua unique index nhận lại đơn của request thắng (201, cùng mã), không 500, chỉ 1 đơn chờ."""
    h = _buyer(client, "race2@example.com")
    course = _paid_course(client)
    uid = client.get("/api/auth/me", headers=h).json()["id"]
    real_new_code = orders_router.new_code

    def new_code_then_lose_race(db):
        code = real_new_code(db)
        other = SessionLocal()  # "request kia" commit đơn chờ trước khi request này kịp commit
        try:
            cid = other.query(Course).filter_by(slug=course["slug"]).one().id
            other.add(Order(code="LHRACE01", user_id=uid, course_id=cid, amount=course["price"], expires_at=datetime.utcnow() + timedelta(hours=1)))
            other.commit()
        finally:
            other.close()
        return code

    monkeypatch.setattr(orders_router, "new_code", new_code_then_lose_race)
    r = client.post("/api/orders", json={"course_slug": course["slug"]}, headers=h)
    assert r.status_code == 201, r.text
    assert r.json()["code"] == "LHRACE01"
    mine = client.get("/api/orders/me", headers=h).json()
    assert [o["code"] for o in mine] == ["LHRACE01"]
