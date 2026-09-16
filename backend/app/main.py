from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings
from .database import Base, engine, migrate
from .routers import admin, auth, courses, orders, stats
from .seed import seed_if_empty


@asynccontextmanager
async def lifespan(app: FastAPI):
    migrate()
    Base.metadata.create_all(bind=engine)
    seed_if_empty()
    yield


app = FastAPI(
    title="LearnHub API",
    version="0.2.0",
    description="Backend cho nền tảng khóa học LearnHub — auth JWT, khóa học, CRUD admin.",
    lifespan=lifespan,
)

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
app.include_router(admin.router)
app.include_router(stats.router)
app.include_router(orders.router)


@app.get("/api/health", tags=["meta"])
def health():
    return {"status": "ok"}
