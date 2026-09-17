"""Form Liên hệ: lưu tin nhắn, báo admin qua email, gửi xác nhận cho người gửi.

Chống spam: rate limit theo IP + captcha Turnstile (khi server có TURNSTILE_SECRET_KEY).
Admin đọc / đánh dấu đã trả lời ở routers/admin.py.
"""
from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from .. import captcha, mailer, schemas
from ..config import settings
from ..database import get_db
from ..models import ContactMessage, User
from ..ratelimit import client_ip, rate_limit
from ..security import get_current_user_optional

router = APIRouter(prefix="/api/contact", tags=["contact"])


def notify_email() -> str:
    return (settings.order_notify_email or settings.admin_email).strip().lower()


@router.post("", response_model=schemas.Message, status_code=status.HTTP_201_CREATED, dependencies=[rate_limit("contact", 5, 3600)])
def send_contact(payload: schemas.ContactIn, request: Request, db: Session = Depends(get_db),
                 user: User | None = Depends(get_current_user_optional)):
    captcha.verify_or_raise(payload.captcha_token, client_ip(request))
    msg = ContactMessage(name=payload.name, email=payload.email, subject=payload.subject, message=payload.message,
                         user_id=user.id if user else None)
    db.add(msg)
    db.commit()
    db.refresh(msg)
    fe = settings.frontend_url.rstrip("/")
    subject, html = mailer.contact_admin_email(msg.id, msg.name, msg.email, msg.subject, msg.message, f"{fe}/admin")
    mailer.send_email(notify_email(), subject, html)
    subject, html = mailer.contact_ack_email(msg.name, msg.subject, msg.message)
    mailer.send_email(msg.email, subject, html)
    return schemas.Message(detail="Đã nhận tin nhắn của bạn. Chúng tôi sẽ phản hồi qua email trong 24 giờ làm việc.")
