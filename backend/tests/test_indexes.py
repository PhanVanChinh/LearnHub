"""Index tổ hợp cho truy vấn lịch sử trắc nghiệm có trên DB (kể cả DB cũ qua migrate)."""
from datetime import datetime, timedelta

from sqlalchemy import inspect, text

from app.database import SessionLocal
from app.models import Course, Order, User

from app.database import engine, migrate


def test_quiz_attempts_composite_index(client):
    migrate()  # chạy lại vô hại
    idx = {i["name"]: i["column_names"] for i in inspect(engine).get_indexes("quiz_attempts")}
    assert idx.get("ix_quiz_attempts_user_course_lesson") == ["user_id", "course_id", "lesson_id"]


def test_orders_pending_unique_index(client):
    migrate()
    idx = {i["name"]: i for i in inspect(engine).get_indexes("orders")}
    i = idx.get("ux_orders_pending_user_course")
    assert i and i["column_names"] == ["user_id", "course_id"] and i["unique"]


def test_migrate_merges_duplicate_pending_orders_before_unique_index(client):
    """DB cũ chưa có index và lỡ có 2 đơn chờ trùng: migrate hủy đơn cũ, giữ đơn mới, rồi mới tạo index (không vỡ khi khởi động)."""
    with engine.begin() as conn:
        conn.execute(text("DROP INDEX IF EXISTS ux_orders_pending_user_course"))
    db = SessionLocal()
    try:
        user = db.query(User).filter_by(email="admin@example.com").one()
        course = db.query(Course).filter(Course.price > 0).first()
        exp = datetime.utcnow() + timedelta(hours=1)
        db.add(Order(code="LHDUP001", user_id=user.id, course_id=course.id, amount=1, expires_at=exp))
        db.add(Order(code="LHDUP002", user_id=user.id, course_id=course.id, amount=1, expires_at=exp))
        db.commit()
        migrate()
        db.expire_all()
        by_code = {o.code: o for o in db.query(Order).filter(Order.code.like("LHDUP%"))}
        assert by_code["LHDUP002"].status == "pending"
        assert by_code["LHDUP001"].status == "cancelled" and "gộp" in (by_code["LHDUP001"].note or "")
        assert "ux_orders_pending_user_course" in {i["name"] for i in inspect(engine).get_indexes("orders")}
        db.query(Order).filter(Order.code.like("LHDUP%")).delete(synchronize_session=False); db.commit()
    finally:
        db.close()
