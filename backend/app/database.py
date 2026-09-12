from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import settings

connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def migrate() -> None:
    """Thêm cột mới vào bảng đã tồn tại. Chỉ thêm, không xoá/đổi kiểu — đủ cho dự án nhỏ, không cần Alembic."""
    from sqlalchemy import inspect, text

    insp = inspect(engine)
    if "users" in insp.get_table_names():
        cols = {c["name"] for c in insp.get_columns("users")}
        with engine.begin() as conn:
            if "email_verified_at" not in cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN email_verified_at DATETIME"))
                # Tài khoản có từ trước quy tắc xác thực → coi như đã xác thực để không bị khoá đột ngột
                conn.execute(text("UPDATE users SET email_verified_at = created_at WHERE email_verified_at IS NULL"))
            if "password_changed_at" not in cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN password_changed_at DATETIME"))
            if "sessions_revoked_at" not in cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN sessions_revoked_at DATETIME"))
            if "failed_login_attempts" not in cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER NOT NULL DEFAULT 0"))
            if "locked_until" not in cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN locked_until DATETIME"))
            if "last_login_at" not in cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN last_login_at DATETIME"))
