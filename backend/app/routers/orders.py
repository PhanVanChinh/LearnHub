"""Đơn hàng khóa học trả phí (phía người mua).

Luồng: tạo đơn → nhận mã đơn + QR chuyển khoản → chuyển tiền với nội dung = mã đơn → admin xác nhận (routers/admin.py)
→ Enrollment được tạo, người mua vào học. Đơn chờ quá ORDER_EXPIRE_HOURS tự chuyển expired khi được đọc.
"""
import secrets
from datetime import datetime, timedelta
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import mailer, schemas
from ..config import settings
from ..database import get_db
from ..models import Course, Enrollment, Order, User
from ..ratelimit import rate_limit
from ..security import get_current_user, require_verified

router = APIRouter(prefix="/api/orders", tags=["orders"])

PENDING, PAID, CANCELLED, EXPIRED = "pending", "paid", "cancelled", "expired"
_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # bỏ I O 0 1 để đọc/nhập không nhầm


def new_code(db: Session) -> str:
    while True:
        code = "LH" + "".join(secrets.choice(_ALPHABET) for _ in range(6))
        if not db.query(Order.id).filter_by(code=code).first():
            return code


def expire_stale(db: Session, orders: list[Order]) -> None:
    """Đánh dấu expired các đơn chờ đã quá hạn (lazy — không cần cron)."""
    now = datetime.utcnow()
    changed = False
    for o in orders:
        if o.status == PENDING and o.expires_at < now:
            o.status = EXPIRED
            changed = True
    if changed:
        db.commit()


def payment_info(order: Order) -> schemas.PaymentInfo | None:
    if order.status != PENDING:
        return None
    qr = None
    if settings.bank_bin and settings.bank_account_number:
        qr = (f"https://img.vietqr.io/image/{settings.bank_bin}-{settings.bank_account_number}-compact2.png"
              f"?amount={order.amount}&addInfo={quote(order.code)}&accountName={quote(settings.bank_account_name)}")
    return schemas.PaymentInfo(bank_name=settings.bank_name, bank_bin=settings.bank_bin, account_number=settings.bank_account_number,
                               account_name=settings.bank_account_name, amount=order.amount, content=order.code, qr_url=qr)


def order_out(order: Order, detail: bool = False) -> schemas.OrderOut:
    cls = schemas.OrderDetail if detail else schemas.OrderOut
    out = cls.model_validate(order)
    out.course_slug, out.course_title = order.course.slug, order.course.title
    out.course_emoji, out.course_color = order.course.emoji, order.course.color
    if detail:
        out.payment = payment_info(order)
    return out


def notify_created(order: Order) -> None:
    """Mail hướng dẫn cho người mua + mail báo admin. Lỗi gửi mail không làm hỏng việc tạo đơn."""
    pay = payment_info(order)
    bank = pay.model_dump() if pay else {}
    fe = settings.frontend_url.rstrip("/")
    subject, html = mailer.order_created_email(order.user.full_name, order.code, order.course.title, order.amount, bank,
                                               settings.order_expire_hours, f"{fe}/checkout?order={order.code}")
    mailer.send_email(order.user.email, subject, html)
    to_admin = (settings.order_notify_email or settings.admin_email).strip().lower()
    if to_admin and to_admin != order.user.email:
        subject, html = mailer.order_admin_notify_email(order.code, order.user.email, order.course.title, order.amount, f"{fe}/admin")
        mailer.send_email(to_admin, subject, html)


def notify_paid(order: Order) -> None:
    fe = settings.frontend_url.rstrip("/")
    subject, html = mailer.order_paid_email(order.user.full_name, order.code, order.course.title, f"{fe}/learn/{order.course.slug}")
    mailer.send_email(order.user.email, subject, html)


def _my_order(db: Session, user: User, code: str) -> Order:
    order = db.query(Order).filter_by(code=code.upper(), user_id=user.id).first()
    if not order:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy đơn hàng")
    expire_stale(db, [order])
    return order


@router.post("", response_model=schemas.OrderDetail, status_code=status.HTTP_201_CREATED, dependencies=[rate_limit("order", 10, 600)])
def create_order(payload: schemas.OrderCreate, db: Session = Depends(get_db), user: User = Depends(require_verified)):
    """Tạo đơn cho khóa trả phí. Đã có đơn chờ cho cùng khóa → trả lại đơn đó (không tạo trùng)."""
    course = db.query(Course).filter(Course.slug == payload.course_slug).first()
    if not course:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy khóa học")
    if course.price <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Khóa học miễn phí — hãy ghi danh trực tiếp")
    if db.query(Enrollment).filter_by(user_id=user.id, course_id=course.id).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "Bạn đã có quyền truy cập khóa học này")
    pending = db.query(Order).filter_by(user_id=user.id, course_id=course.id, status=PENDING).all()
    expire_stale(db, pending)
    existing = next((o for o in pending if o.status == PENDING), None)
    if existing:
        return order_out(existing, detail=True)
    order = Order(code=new_code(db), user_id=user.id, course_id=course.id, amount=course.price,
                  expires_at=datetime.utcnow() + timedelta(hours=settings.order_expire_hours))
    db.add(order)
    db.commit()
    db.refresh(order)
    notify_created(order)
    return order_out(order, detail=True)


@router.get("/me", response_model=list[schemas.OrderOut])
def my_orders(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    orders = db.query(Order).filter_by(user_id=user.id).order_by(Order.created_at.desc()).all()
    expire_stale(db, orders)
    return [order_out(o) for o in orders]


@router.get("/{code}", response_model=schemas.OrderDetail)
def get_order(code: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Chi tiết đơn của tôi kèm hướng dẫn chuyển khoản (khi còn chờ). Frontend poll endpoint này để biết đã được duyệt chưa."""
    return order_out(_my_order(db, user, code), detail=True)


@router.post("/{code}/cancel", response_model=schemas.OrderDetail)
def cancel_order(code: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    order = _my_order(db, user, code)
    if order.status != PENDING:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Chỉ huỷ được đơn đang chờ thanh toán")
    order.status = CANCELLED
    db.commit()
    db.refresh(order)
    return order_out(order, detail=True)
