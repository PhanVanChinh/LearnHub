from contextlib import asynccontextmanager

import logging

from fastapi import Depends, FastAPI, Request
from pydantic import BaseModel, Field

from .ratelimit import rate_limit
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings
from . import observability

observability.setup_logging()
observability.setup_sentry()

from .database import Base, engine, migrate  # noqa: E402 — sau khi logging đã cấu hình
from .routers import account, admin, ai_check, auth, certificates, contact, courses, orders, reviews, stats
from .seed import seed_if_empty
from .routers.account import purge_expired_tokens
from .database import SessionLocal
from .startup_checks import find_problems, run_startup_checks
from . import ai_check as ai_check_svc
from . import captcha, google_auth, mailer, storage
from .security import require_admin
from sqlalchemy import text


@asynccontextmanager
async def lifespan(app: FastAPI):
    migrate()
    Base.metadata.create_all(bind=engine)
    seed_if_empty()
    db = SessionLocal()
    try:
        purge_expired_tokens(db)
        run_startup_checks(db)  # production: RuntimeError → tiến trình dừng, không chạy với cấu hình mặc định
    finally:
        db.close()
    yield


app = FastAPI(
    title="LearnHub API",
    version="0.2.0",
    description="Backend cho nền tảng khóa học LearnHub — auth JWT, khóa học, CRUD admin.",
    lifespan=lifespan,
)

observability.install(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FIELD_LABELS = {
    "email": "Email", "password": "Mật khẩu", "new_password": "Mật khẩu mới", "current_password": "Mật khẩu hiện tại",
    "full_name": "Họ và tên", "accept_terms": "Điều khoản", "slug": "Slug", "title": "Tiêu đề",
    "name": "Họ và tên", "subject": "Chủ đề", "message": "Nội dung",
}


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_: Request, exc: RequestValidationError):
    """Trả {detail: 'thông báo đầu tiên', errors: [{field, msg}]} thay cho cấu trúc mặc định khó đọc của Pydantic."""
    errors = []
    for e in exc.errors():
        field = str(e["loc"][-1]) if e.get("loc") else ""
        msg = e.get("msg", "Dữ liệu không hợp lệ")
        msg = msg.removeprefix("Value error, ").removeprefix("Assertion failed, ")
        if e.get("type") == "value_error" and "email" in field and "valid" in msg.lower():
            msg = "Email không hợp lệ"
        elif e.get("type") == "missing":
            msg = f"Thiếu trường {FIELD_LABELS.get(field, field)}"
        elif e.get("type", "").startswith("string_too_short"):
            msg = f"{FIELD_LABELS.get(field, field)} quá ngắn"
        elif e.get("type", "").startswith("string_too_long"):
            msg = f"{FIELD_LABELS.get(field, field)} quá dài"
        errors.append({"field": field, "msg": msg})
    detail = errors[0]["msg"] if errors else "Dữ liệu không hợp lệ"
    return JSONResponse(status_code=422, content={"detail": detail, "errors": errors})


app.include_router(auth.router)
app.include_router(courses.router)
app.include_router(courses.media_router)
app.include_router(admin.router)
app.include_router(stats.router)
app.include_router(orders.router)
app.include_router(contact.router)
app.include_router(ai_check.router)
app.include_router(account.router)
app.include_router(reviews.router)
app.include_router(certificates.router)


class ClientErrorIn(BaseModel):
    message: str = Field(max_length=1000)
    stack: str = Field("", max_length=4000)
    url: str = Field("", max_length=1000)
    user_agent: str = Field("", max_length=300)
    source: str = Field("window", max_length=50)


@app.post("/api/client-errors", status_code=204, tags=["meta"], dependencies=[rate_limit("client-error", 20, 600)])
def client_error(payload: ClientErrorIn):
    """Frontend gửi lỗi JS chưa bắt về đây → log ERROR (→ Sentry nếu bật). Không lưu DB."""
    logging.getLogger("learnhub.client").error("JS %s: %s | %s | %s\n%s", payload.source, payload.message, payload.url,
                                                payload.user_agent[:120], payload.stack[:2000])


@app.get("/api/health", tags=["meta"])
def health():
    """Docker/Render/uptime monitor gọi. Kiểm tra cả DB: DB chết → 503 để nền tảng khởi động lại / báo động."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as e:  # noqa: BLE001 — mọi lỗi DB đều là unhealthy
        return JSONResponse(status_code=503, content={"status": "error", "db": "down", "detail": str(e)[:200]})
    return {"status": "ok", "db": "ok", "env": settings.app_env}


@app.get("/api/health/config", tags=["meta"], dependencies=[Depends(require_admin)])
def health_config():
    """Admin: dịch vụ nào đã cấu hình, cấu hình nào còn thiếu/nguy hiểm. Không lộ giá trị bí mật."""
    db = SessionLocal()
    try:
        errors, warnings = find_problems(db)
    finally:
        db.close()
    return {
        "env": settings.app_env,
        "database": "sqlite" if settings.is_sqlite else "postgres",
        "services": {
            "mail": mailer.provider(), "google_login": google_auth.enabled(), "captcha": captcha.enabled(),
            "bank_qr": bool(settings.bank_bin and settings.bank_account_number), "file_storage": storage.enabled(),
            "ai_check": ai_check_svc.enabled(), "publish_button": bool(settings.github_token and settings.github_repo),
        },
        "errors": errors, "warnings": warnings,
    }
