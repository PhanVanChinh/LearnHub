"""Index tổ hợp cho truy vấn lịch sử trắc nghiệm có trên DB (kể cả DB cũ qua migrate)."""
from sqlalchemy import inspect

from app.database import engine, migrate


def test_quiz_attempts_composite_index(client):
    migrate()  # chạy lại vô hại
    idx = {i["name"]: i["column_names"] for i in inspect(engine).get_indexes("quiz_attempts")}
    assert idx.get("ix_quiz_attempts_user_course_lesson") == ["user_id", "course_id", "lesson_id"]
