"""Kiểm tra cấu hình khi khởi động. APP_ENV=production → cấu hình mặc định nguy hiểm làm backend TỪ CHỐI chạy,
thay vì chạy với secret 'dev-secret-change-me' và admin/admin123 mà không ai nhận ra.
Dev: chỉ ghi cảnh báo."""
import logging

from sqlalchemy.orm import Session

from .config import settings
from .models import User
from .security import verify_password

log = logging.getLogger("learnhub.startup")

DEFAULT_SECRET = "dev-secret-change-me"
DEFAULT_ADMIN_PASSWORD = "admin123"


def find_problems(db: Session | None = None) -> tuple[list[str], list[str]]:
    """Trả (errors, warnings). errors chặn khởi động ở production."""
    errors: list[str] = []
    warnings: list[str] = []
    if settings.secret_key == DEFAULT_SECRET or len(settings.secret_key) < 32:
        errors.append("SECRET_KEY còn mặc định hoặc quá ngắn (< 32 ký tự). Tạo: python3 -c \"import secrets;print(secrets.token_urlsafe(48))\"")
    if settings.admin_password == DEFAULT_ADMIN_PASSWORD:
        errors.append("ADMIN_PASSWORD còn mặc định 'admin123'")
    if settings.is_sqlite:
        errors.append("DATABASE_URL là SQLite: dữ liệu sẽ mất khi redeploy. Dùng Postgres")
    if db is not None:
        weak = [u.email for u in db.query(User).filter(User.role == "admin", User.is_active.is_(True)).all()
                if u.hashed_password and verify_password(DEFAULT_ADMIN_PASSWORD, u.hashed_password)]
        if weak:
            errors.append(f"Tài khoản admin đang dùng mật khẩu mặc định 'admin123': {', '.join(weak)} — đổi trong trang Tài khoản")
    origins = settings.cors_origin_list
    if not origins or all("localhost" in o or "127.0.0.1" in o for o in origins):
        warnings.append("CORS_ORIGINS chỉ có localhost — frontend thật sẽ bị chặn")
    if "localhost" in settings.frontend_url:
        warnings.append("FRONTEND_URL là localhost — link trong email (đặt lại mật khẩu, đơn hàng) sẽ sai")
    if not settings.trust_proxy_headers:
        warnings.append("TRUST_PROXY_HEADERS=false — sau proxy (Render/Railway) rate limit sẽ tính mọi khách là một IP")
    if not settings.resend_api_key:
        warnings.append("RESEND_API_KEY trống — email OTP/đơn hàng chỉ in ra log, người dùng không nhận được")
    return errors, warnings


def run_startup_checks(db: Session | None = None) -> None:
    errors, warnings = find_problems(db)
    for w in warnings:
        log.warning("Cấu hình: %s", w)
    if settings.is_production:
        if errors:
            msg = "Từ chối khởi động ở APP_ENV=production vì cấu hình không an toàn:\n  - " + "\n  - ".join(errors)
            log.critical(msg)
            raise RuntimeError(msg)
        log.info("Kiểm tra cấu hình production: OK")
    elif errors:
        for e in errors:
            log.warning("Cấu hình (chỉ cảnh báo vì APP_ENV=%s): %s", settings.app_env, e)
