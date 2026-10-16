from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
import bcrypt
from sqlalchemy.orm import Session

from .config import settings
from .database import get_db
import secrets

from .models import RefreshToken, User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token", auto_error=False)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    if not hashed:  # tài khoản chưa đặt mật khẩu
        return False
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except ValueError:
        return False


def _token_version(user: User) -> int:
    """Phiên bản token (ms). Đổi mật khẩu / đăng xuất mọi thiết bị → phiên bản đổi → token cũ bị từ chối."""
    mark = user.token_invalid_before
    return int(mark.replace(tzinfo=timezone.utc).timestamp() * 1000) if mark else 0


def _encode(user: User, kind: str, lifetime: timedelta, extra: dict | None = None) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": str(user.id), "typ": kind, "pv": _token_version(user), "iat": int(now.timestamp()), "exp": now + lifetime, **(extra or {})}
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def _decode(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError:
        return None


def create_access_token(user: User) -> str:
    return _encode(user, "access", timedelta(minutes=settings.access_token_expire_minutes))


def create_refresh_token(user: User, db: Session, family: str | None = None) -> str:
    """Phát hành refresh token có `jti` và ghi vào bảng refresh_tokens (không commit — caller commit)."""
    lifetime = timedelta(days=settings.refresh_token_expire_days)
    jti, family = secrets.token_hex(16), family or secrets.token_hex(16)
    db.add(RefreshToken(jti=jti, family=family, user_id=user.id, expires_at=datetime.utcnow() + lifetime))
    return _encode(user, "refresh", lifetime, {"jti": jti, "fam": family})


def refresh_row(token: str, db: Session) -> RefreshToken | None:
    """Dòng refresh_tokens ứng với token (None với token cũ không có jti hoặc token hỏng)."""
    p = _decode(token)
    jti = p.get("jti") if p else None
    return db.query(RefreshToken).filter_by(jti=jti).first() if jti else None


def revoke_refresh(token: str, db: Session) -> bool:
    """Thu hồi đúng refresh token này (đăng xuất thiết bị). Không commit."""
    row = refresh_row(token, db)
    if row and row.revoked_at is None:
        row.revoked_at = datetime.utcnow()
        return True
    return False


def user_from_token(token: str, db: Session, kind: str = "access") -> User | None:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id = int(payload.get("sub"))
        pwd_version = int(payload.get("pv", 0))
        typ = payload.get("typ", "access")  # token cũ không có typ → coi là access
    except (JWTError, TypeError, ValueError):
        return None
    if typ != kind:
        return None
    if kind == "refresh" and payload.get("jti"):
        # Token mới: phải còn trong bảng và chưa bị thu hồi. Token cũ (trước khi có bảng, không jti) vẫn nhận tới khi hết hạn.
        row = db.query(RefreshToken).filter_by(jti=payload["jti"]).first()
        if not row or row.revoked_at is not None or row.user_id != user_id:
            return None
    user = db.get(User, user_id)
    if not user or not user.is_active or pwd_version != _token_version(user):
        return None
    return user


def get_current_user_optional(token: str | None = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User | None:
    return user_from_token(token, db) if token else None


def get_current_user(user: User | None = Depends(get_current_user_optional)) -> User:
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Bạn cần đăng nhập", headers={"WWW-Authenticate": "Bearer"})
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Chỉ admin mới có quyền này")
    return user


def require_verified(user: User = Depends(get_current_user)) -> User:
    """Chặn hành động quan trọng (ghi danh, xem bài trả phí, lưu tiến độ) khi chưa xác thực email."""
    if not user.email_verified:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Bạn cần xác thực email trước khi thực hiện thao tác này")
    return user
