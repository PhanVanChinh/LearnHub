"""Đưa bộ đếm về số thật cho DB đã nạp seed cũ (có views/sold giả).

    cd backend && python reset_counters.py

- views → 0 (không có cách khôi phục lượt xem thật trước đây)
- sold  → số ghi danh hiện có của khóa
"""
from sqlalchemy import func

from app.database import SessionLocal
from app.models import Course, Enrollment

db = SessionLocal()
try:
    counts = dict(db.query(Enrollment.course_id, func.count(Enrollment.id)).group_by(Enrollment.course_id).all())
    courses = db.query(Course).all()
    for c in courses:
        c.views = 0
        c.sold = counts.get(c.id, 0)
    db.commit()
    print(f"Đã reset {len(courses)} khóa học: views=0, sold=số ghi danh")
finally:
    db.close()
