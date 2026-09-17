"""Quyền của người dùng với dữ liệu cá nhân (Nghị định 13/2023): xuất dữ liệu, xoá tài khoản."""
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy import or_
from sqlalchemy.orm import Session

from .. import audit, schemas
from ..database import get_db
from ..models import AiCheckRun, ContactMessage, EmailVerification, Enrollment, LessonProgress, Order, PasswordReset, QuizAttempt, User
from ..ratelimit import rate_limit
from ..security import get_current_user, verify_password
from .orders import CANCELLED, PENDING

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


def anonymize_user(db: Session, user: User) -> None:
    """Xoá tài khoản theo yêu cầu người dùng.

    - Xoá hẳn: ghi danh, tiến độ, kết quả trắc nghiệm, lượt AI Check, mã OTP, token đặt lại mật khẩu.
    - Ẩn danh hoá (không xoá): hồ sơ và đơn hàng — chứng từ thanh toán phải lưu theo pháp luật kế toán;
      tin nhắn liên hệ giữ nội dung để phục vụ hỗ trợ nhưng bỏ tên/email.
    - Vô hiệu mọi token, khoá tài khoản, giải phóng email để có thể đăng ký lại.
    """
    now = datetime.utcnow()
    uid = user.id
    for model in (Enrollment, LessonProgress, QuizAttempt, AiCheckRun, EmailVerification, PasswordReset):
        db.query(model).filter(model.user_id == uid).delete(synchronize_session=False)
    db.query(Order).filter(Order.user_id == uid, Order.status == PENDING).update({"status": CANCELLED}, synchronize_session=False)
    db.query(ContactMessage).filter(ContactMessage.user_id == uid).update(
        {"name": "Người dùng đã xoá", "email": f"deleted-{uid}@users.deleted", "user_id": None}, synchronize_session=False)
    user.email = f"deleted-{uid}@users.deleted"
    user.full_name = "Người dùng đã xoá"
    user.hashed_password = ""
    user.google_sub = None
    user.avatar_url = None
    user.email_verified_at = None
    user.is_active = False
    user.sessions_revoked_at = now
    user.deleted_at = now
    db.commit()


@router.delete("", status_code=status.HTTP_204_NO_CONTENT, dependencies=[rate_limit("delete-account", 5, 3600)])
def delete_my_account(payload: schemas.AccountDeleteIn, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Tự xoá tài khoản: gõ đúng email + mật khẩu (nếu có). Admin phải được hạ quyền trước để không mất quyền quản trị."""
    if user.role == "admin":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Tài khoản quản trị không tự xoá được. Hãy nhờ admin khác hạ quyền trước")
    if payload.confirm.strip().lower() != user.email:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Email xác nhận không khớp")
    if user.has_password and not (payload.password and verify_password(payload.password, user.hashed_password)):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Mật khẩu không đúng")
    email, uid = user.email, user.id
    anonymize_user(db, user)
    # actor=None: hồ sơ đã ẩn danh; giữ email gốc trong summary để đối soát yêu cầu xoá dữ liệu
    audit.record(db, request, None, "account.delete", "account", uid, f"Người dùng {email} tự xoá tài khoản")


def purge_expired_tokens(db: Session) -> int:
    """Dọn mã OTP hết hạn quá 1 ngày và token đặt lại mật khẩu đã dùng / hết hạn quá 7 ngày (giảm dữ liệu lưu không cần thiết)."""
    now = datetime.utcnow()
    n = db.query(EmailVerification).filter(EmailVerification.expires_at < now - timedelta(days=1)).delete(synchronize_session=False)
    n += db.query(PasswordReset).filter(or_(PasswordReset.used_at.isnot(None), PasswordReset.expires_at < now - timedelta(days=7))).delete(synchronize_session=False)
    db.commit()
    return n
