"""Dọn dữ liệu cũ: nhật ký > 1 năm, AI Check > 90 ngày, quiz giữ 20 lần gần nhất + lần tốt nhất."""
from datetime import datetime, timedelta

from app.database import SessionLocal
from app.models import AiCheckRun, AuditLog, Course, QuizAttempt, User
from app.retention import QUIZ_KEEP_PER_LESSON, purge_old_data


def test_purge_old_data(client):
    db = SessionLocal()
    try:
        now = datetime.utcnow()
        user = db.query(User).filter_by(email="admin@example.com").first()
        course = db.query(Course).first()
        db.add_all([
            AuditLog(actor_id=user.id, action="x.old", target_type="t", target_id="1", summary="cũ", created_at=now - timedelta(days=400)),
            AuditLog(actor_id=user.id, action="x.new", target_type="t", target_id="2", summary="mới", created_at=now - timedelta(days=10)),
            AiCheckRun(user_id=user.id, chars=1, words=1, ai_score=1, confidence="low", created_at=now - timedelta(days=100)),
            AiCheckRun(user_id=user.id, chars=1, words=1, ai_score=1, confidence="low", created_at=now - timedelta(days=1)),
        ])
        # 25 lần làm cùng bài; lần thứ 2 (cũ) đạt 100% → phải được giữ
        for i in range(25):
            db.add(QuizAttempt(user_id=user.id, course_id=course.id, lesson_index=0, lesson_id="retn0001",
                               score=1, total=1, percent=100 if i == 1 else 10, passed=i == 1))
        db.commit()

        out = purge_old_data(db, now)
        assert out["audit_logs"] >= 1 and out["ai_check_runs"] >= 1 and out["quiz_attempts"] == 25 - QUIZ_KEEP_PER_LESSON - 1
        assert db.query(AuditLog).filter_by(action="x.old").count() == 0 and db.query(AuditLog).filter_by(action="x.new").count() == 1
        left = db.query(QuizAttempt).filter_by(user_id=user.id, lesson_id="retn0001").all()
        assert len(left) == QUIZ_KEEP_PER_LESSON + 1 and max(a.percent for a in left) == 100
        assert purge_old_data(db, now)["quiz_attempts"] == 0  # chạy lại không xóa thêm
    finally:
        db.close()
