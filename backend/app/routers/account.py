"""Quyền của người dùng với dữ liệu cá nhân (Nghị định 13/2023): xuất dữ liệu, xoá tài khoản."""
from datetime import datetime

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ContactMessage, User
from ..ratelimit import rate_limit
from ..security import get_current_user

router = APIRouter(prefix="/api/account", tags=["account"])


def _iso(d: datetime | None) -> str | None:
    return d.isoformat() + "Z" if d else None


def export_user_data(db: Session, user: User) -> dict:
    """Toàn bộ dữ liệu hệ thống đang giữ về một người, dạng dễ đọc. Không gồm hash mật khẩu, token."""
    contacts = db.query(ContactMessage).filter(ContactMessage.user_id == user.id).order_by(ContactMessage.id).all()
    return {
        "exported_at": _iso(datetime.utcnow()),
        "note": "Dữ liệu LearnHub lưu về bạn. Mật khẩu chỉ lưu dạng băm và không xuất. Nội dung bạn gửi AI Check không được lưu.",
        "profile": {
            "id": user.id, "email": user.email, "full_name": user.full_name, "role": user.role,
            "email_verified_at": _iso(user.email_verified_at), "created_at": _iso(user.created_at),
            "last_login_at": _iso(user.last_login_at), "password_changed_at": _iso(user.password_changed_at),
            "google_linked": user.has_google, "avatar_url": user.avatar_url,
        },
        "enrollments": [
            {"course_slug": e.course.slug, "course_title": e.course.title, "enrolled_at": _iso(e.created_at)} for e in user.enrollments
        ],
        "lesson_progress": [
            {"course_slug": p.course.slug, "lesson_index": p.lesson_index,
             "lesson_title": (p.course.lessons[p.lesson_index]["title"] if p.lesson_index < len(p.course.lessons or []) else None),
             "completed_at": _iso(p.completed_at)} for p in user.progress
        ],
        "quiz_attempts": [
            {"course_slug": a.course.slug, "lesson_index": a.lesson_index, "score": a.score, "total": a.total,
             "percent": a.percent, "passed": a.passed, "at": _iso(a.created_at)} for a in user.quiz_attempts
        ],
        "orders": [
            {"code": o.code, "course_slug": o.course.slug, "course_title": o.course.title, "amount": o.amount, "status": o.status,
             "payment_method": o.payment_method, "created_at": _iso(o.created_at), "paid_at": _iso(o.paid_at)} for o in user.orders
        ],
        "ai_check_runs": [
            {"words": r.words, "chars": r.chars, "ai_score": r.ai_score, "confidence": r.confidence, "at": _iso(r.created_at)} for r in user.ai_checks
        ],
        "contact_messages": [
            {"subject": m.subject, "message": m.message, "status": m.status, "sent_at": _iso(m.created_at)} for m in contacts
        ],
    }


@router.get("/export", dependencies=[rate_limit("export", 5, 3600)])
def export_my_data(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Tải toàn bộ dữ liệu cá nhân (JSON). Header Content-Disposition để trình duyệt lưu thành file."""
    data = export_user_data(db, user)
    fname = f"learnhub-du-lieu-{user.id}-{datetime.utcnow():%Y%m%d}.json"
    return JSONResponse(data, headers={"Content-Disposition": f'attachment; filename="{fname}"'})
