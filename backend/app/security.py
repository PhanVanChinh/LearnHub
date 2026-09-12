from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
import bcrypt
from sqlalchemy.orm import Session

from .config import settings
from .database import get_db
from .models import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token", auto_error=False)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except ValueError:
        return False


def _token_version(user: User) -> int:
    """Phiên bản token (ms). Đổi mật khẩu / đăng xuất mọi thiết bị → phiên bản đổi → token cũ bị từ chối."""
    mark = user.token_invalid_before
    return int(mark.replace(tzinfo=timezone.utc).timestamp() * 1000) if mark else 0


def _encode(user: User, kind: str, lifetime: timedelta) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": str(user.id), "typ": kind, "pv": _token_version(user), "iat": int(now.timestamp()), "exp": now + lifetime}
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def create_access_token(user: User) -> str:
    return _encode(user, "access", timedelta(minutes=settings.access_token_expire_minutes))


def create_refresh_token(user: User) -> str:
    return _encode(user, "refresh", timedelta(days=settings.refresh_token_expire_days))


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
