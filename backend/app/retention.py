"""Dọn dữ liệu cũ để các bảng chỉ-thêm không phình vô hạn (DB và bản backup nhỏ, khởi động nhanh).

Chạy lúc khởi động (main.lifespan). Mỗi lần chỉ xóa một lô giới hạn để cold start trên Render free không bị chậm
khi có nhiều dữ liệu tồn; phần còn lại xóa ở lần khởi động sau."""
from datetime import datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from .models import AiCheckRun, AuditLog, QuizAttempt, RefreshToken

AUDIT_KEEP_DAYS = 365          # nhật ký quản trị: đủ cho đối soát một năm
AI_CHECK_KEEP_DAYS = 90        # lượt AI Check chỉ cần cho hạn mức 24 giờ + thống kê gần đây
QUIZ_KEEP_PER_LESSON = 20      # mỗi người / mỗi bài giữ 20 lần làm gần nhất (đủ cho "lần tốt nhất", "lần gần nhất")
BATCH = 5000


def _delete_ids(db: Session, model, ids: list[int]) -> int:
    if not ids:
        return 0
    return db.query(model).filter(model.id.in_(ids)).delete(synchronize_session=False)


def purge_old_data(db: Session, now: datetime | None = None) -> dict[str, int]:
    now = now or datetime.utcnow()
    out = {}
    ids = [r.id for r in db.query(AuditLog.id).filter(AuditLog.created_at < now - timedelta(days=AUDIT_KEEP_DAYS)).limit(BATCH)]
    out["audit_logs"] = _delete_ids(db, AuditLog, ids)
    ids = [r.id for r in db.query(AiCheckRun.id).filter(AiCheckRun.created_at < now - timedelta(days=AI_CHECK_KEEP_DAYS)).limit(BATCH)]
    out["ai_check_runs"] = _delete_ids(db, AiCheckRun, ids)
    ids = [r.id for r in db.query(RefreshToken.id).filter(RefreshToken.expires_at < now).limit(BATCH)]
    out["refresh_tokens"] = _delete_ids(db, RefreshToken, ids)

    # Lần làm trắc nghiệm: nhóm (user, course, lesson) có > N lần → xóa các lần cũ hơn N lần gần nhất.
    # Giữ lại lần điểm cao nhất dù cũ, để "lần tốt nhất" không đổi sau khi dọn.
    groups = (db.query(QuizAttempt.user_id, QuizAttempt.course_id, QuizAttempt.lesson_id)
              .group_by(QuizAttempt.user_id, QuizAttempt.course_id, QuizAttempt.lesson_id)
              .having(func.count(QuizAttempt.id) > QUIZ_KEEP_PER_LESSON).limit(500).all())
    removed = 0
    for uid, cid, lid in groups:
        rows = (db.query(QuizAttempt.id, QuizAttempt.percent)
                .filter(QuizAttempt.user_id == uid, QuizAttempt.course_id == cid, QuizAttempt.lesson_id.is_(lid) if lid is None else QuizAttempt.lesson_id == lid)
                .order_by(QuizAttempt.id.desc()).all())
        keep = {r.id for r in rows[:QUIZ_KEEP_PER_LESSON]}
        best = max(rows, key=lambda r: (r.percent, r.id))
        keep.add(best.id)
        removed += _delete_ids(db, QuizAttempt, [r.id for r in rows if r.id not in keep][:BATCH])
    out["quiz_attempts"] = removed
    db.commit()
    return out
