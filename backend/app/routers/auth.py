import hashlib
import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from .. import mailer, schemas
from ..config import settings
from ..database import get_db
from ..models import EmailVerification, PasswordReset, User
from ..security import create_access_token, get_current_user, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _issue(user: User) -> schemas.Token:
    return schemas.Token(access_token=create_access_token(user), user=schemas.UserOut.model_validate(user))


@router.post("/register", response_model=schemas.Token, status_code=status.HTTP_201_CREATED)
def register(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "Email đã được đăng ký")
    user = User(email=payload.email, full_name=payload.full_name, hashed_password=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    _send_verification(db, user)
    return _issue(user)


# ---------- xác thực email ----------
def _hash_code(code: str) -> str:
    return hashlib.sha256(f"{settings.secret_key}:{code}".encode()).hexdigest()


def _latest_code(db: Session, user: User) -> EmailVerification | None:
    return db.query(EmailVerification).filter_by(user_id=user.id).order_by(EmailVerification.created_at.desc()).first()


def _cooldown_left(db: Session, user: User) -> int:
    last = _latest_code(db, user)
    if not last:
        return 0
    left = settings.otp_resend_cooldown_seconds - int((datetime.utcnow() - last.created_at).total_seconds())
    return max(0, left)


def _send_verification(db: Session, user: User) -> bool:
    """Tạo mã 6 số mới (vô hiệu mã cũ), gửi email. Trả về True nếu gửi thành công."""
    db.query(EmailVerification).filter_by(user_id=user.id).delete()
    code = f"{secrets.randbelow(10**6):06d}"
    db.add(EmailVerification(user_id=user.id, code_hash=_hash_code(code),
                             expires_at=datetime.utcnow() + timedelta(minutes=settings.otp_expire_minutes)))
    db.commit()
    subject, html = mailer.verification_email(user.full_name, code, settings.otp_expire_minutes)
    return mailer.send_email(user.email, subject, html)


@router.get("/verification", response_model=schemas.VerificationStatus)
def verification_status(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return schemas.VerificationStatus(email_verified=user.email_verified, cooldown_seconds=_cooldown_left(db, user),
                                      mail_provider=mailer.provider())


@router.post("/verification/resend", response_model=schemas.VerificationStatus)
def resend_verification(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.email_verified:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Email đã được xác thực")
    left = _cooldown_left(db, user)
    if left > 0:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, f"Vui lòng chờ {left} giây trước khi gửi lại mã")
    sent = _send_verification(db, user)
    if not sent:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Không gửi được email, thử lại sau")
    return schemas.VerificationStatus(email_verified=False, sent=True, cooldown_seconds=settings.otp_resend_cooldown_seconds,
                                      mail_provider=mailer.provider())


@router.post("/verification/confirm", response_model=schemas.UserOut)
def confirm_verification(payload: schemas.VerifyEmailIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.email_verified:
        return user
    rec = _latest_code(db, user)
    if not rec or rec.expires_at < datetime.utcnow():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Mã đã hết hạn, hãy bấm gửi lại mã")
    if rec.attempts >= settings.otp_max_attempts:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Bạn đã nhập sai quá nhiều lần, hãy gửi lại mã mới")
    if rec.code_hash != _hash_code(payload.code):
        rec.attempts += 1
        db.commit()
        left = settings.otp_max_attempts - rec.attempts
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Mã không đúng (còn {left} lần thử)")
    user.email_verified_at = datetime.utcnow()
    db.query(EmailVerification).filter_by(user_id=user.id).delete()
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=schemas.Token)
def login(payload: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Email hoặc mật khẩu không đúng")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Tài khoản đã bị khoá")
    return _issue(user)


@router.post("/token", response_model=schemas.Token, include_in_schema=False)
def token(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """OAuth2 form endpoint để nút Authorize trong /docs hoạt động."""
    return login(schemas.UserLogin(email=form.username, password=form.password), db)


@router.get("/me", response_model=schemas.UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.post("/change-password", response_model=schemas.Token)
def change_password(payload: schemas.PasswordChange, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Đổi mật khẩu. Mọi token cũ bị vô hiệu; trả token mới cho phiên hiện tại."""
    if not verify_password(payload.current_password, user.hashed_password):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Mật khẩu hiện tại không đúng")
    _set_password(db, user, payload.new_password)
    return _issue(user)


# ---------- quên / đặt lại mật khẩu ----------
def _set_password(db: Session, user: User, new_password: str) -> None:
    user.hashed_password = hash_password(new_password)
    user.password_changed_at = datetime.utcnow()
    db.query(PasswordReset).filter_by(user_id=user.id, used_at=None).update({"used_at": datetime.utcnow()})
    db.commit()
    db.refresh(user)


GENERIC_FORGOT_MSG = "Nếu email tồn tại trong hệ thống, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu."


@router.post("/forgot-password", response_model=schemas.Message)
def forgot_password(payload: schemas.ForgotPasswordIn, db: Session = Depends(get_db)):
    """Luôn trả 200 với cùng một thông báo để không lộ email nào đã đăng ký."""
    user = db.query(User).filter(User.email == payload.email.strip().lower()).first()
    if user and user.is_active:
        recent = db.query(PasswordReset).filter_by(user_id=user.id, used_at=None).order_by(PasswordReset.created_at.desc()).first()
        if not recent or (datetime.utcnow() - recent.created_at).total_seconds() >= settings.otp_resend_cooldown_seconds:
            token = secrets.token_urlsafe(32)
            db.add(PasswordReset(user_id=user.id, token_hash=_hash_code(token),
                                 expires_at=datetime.utcnow() + timedelta(minutes=settings.reset_token_expire_minutes)))
            db.commit()
            link = f"{settings.frontend_url.rstrip('/')}/reset-password?token={token}"
            subject, html = mailer.reset_password_email(user.full_name, link, settings.reset_token_expire_minutes)
            mailer.send_email(user.email, subject, html)
    return schemas.Message(detail=GENERIC_FORGOT_MSG)


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
def reset_password(payload: schemas.ResetPasswordIn, db: Session = Depends(get_db)):
    rec = db.query(PasswordReset).filter_by(token_hash=_hash_code(payload.token)).first()
    if not rec or rec.used_at is not None or rec.expires_at < datetime.utcnow():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn")
    user = rec.user
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Tài khoản đã bị khoá")
    _set_password(db, user, payload.new_password)
    if not user.email_verified:  # nhận được mail = sở hữu email
        user.email_verified_at = datetime.utcnow()
        db.commit()
