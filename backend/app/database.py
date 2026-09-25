from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import settings

if settings.is_sqlite:
    engine = create_engine(settings.sqlalchemy_url, connect_args={"check_same_thread": False})
else:
    # pool_pre_ping: kết nối chết (Postgres restart, idle timeout trên Render/Neon) được thay tự động thay vì ném lỗi
    engine = create_engine(settings.sqlalchemy_url, pool_pre_ping=True, pool_size=5, max_overflow=10, pool_recycle=1800)
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
    DT = "DATETIME" if settings.is_sqlite else "TIMESTAMP"  # Postgres không có kiểu DATETIME
    if "courses" in insp.get_table_names():
        cols = {c["name"] for c in insp.get_columns("courses")}
        if "cover" not in cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE courses ADD COLUMN cover VARCHAR(1000) NOT NULL DEFAULT ''"))
    if "users" in insp.get_table_names():
        cols = {c["name"] for c in insp.get_columns("users")}
        with engine.begin() as conn:
            if "email_verified_at" not in cols:
                conn.execute(text(f"ALTER TABLE users ADD COLUMN email_verified_at {DT}"))
                # Tài khoản có từ trước quy tắc xác thực → coi như đã xác thực để không bị khoá đột ngột
                conn.execute(text("UPDATE users SET email_verified_at = created_at WHERE email_verified_at IS NULL"))
            if "password_changed_at" not in cols:
                conn.execute(text(f"ALTER TABLE users ADD COLUMN password_changed_at {DT}"))
            if "sessions_revoked_at" not in cols:
                conn.execute(text(f"ALTER TABLE users ADD COLUMN sessions_revoked_at {DT}"))
            if "failed_login_attempts" not in cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER NOT NULL DEFAULT 0"))
            if "locked_until" not in cols:
                conn.execute(text(f"ALTER TABLE users ADD COLUMN locked_until {DT}"))
            if "last_login_at" not in cols:
                conn.execute(text(f"ALTER TABLE users ADD COLUMN last_login_at {DT}"))
            if "google_sub" not in cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN google_sub VARCHAR(64)"))
                conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_google_sub ON users (google_sub)"))
            if "avatar_url" not in cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500)"))
            if "deleted_at" not in cols:
                conn.execute(text(f"ALTER TABLE users ADD COLUMN deleted_at {DT}"))
