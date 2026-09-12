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


def _pwd_version(user: User) -> int:
    """Phiên bản mật khẩu = mốc đổi mật khẩu gần nhất (ms). Đổi mật khẩu → mọi token mang phiên bản cũ bị từ chối."""
    return int(user.password_changed_at.replace(tzinfo=timezone.utc).timestamp() * 1000) if user.password_changed_at else 0


def create_access_token(user: User) -> str:
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {"sub": str(user.id), "pv": _pwd_version(user), "iat": int(now.timestamp()), "exp": expire}
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def get_current_user_optional(token: str | None = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User | None:
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id = int(payload.get("sub"))
        pwd_version = int(payload.get("pv", 0))
    except (JWTError, TypeError, ValueError):
        return None
    user = db.get(User, user_id)
    if not user or not user.is_active:
        return None
    if pwd_version != _pwd_version(user):  # token phát hành trước lần đổi mật khẩu gần nhất
        return None
    return user


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
