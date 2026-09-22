"""Logging có cấu trúc + request ID + Sentry.

- Mỗi request có X-Request-ID (nhận từ proxy nếu có, không thì sinh mới), trả lại trong header và gắn vào mọi dòng log
  của request đó (contextvar). Lỗi 500 trả "Mã tra cứu: <id>" để người dùng báo lại, admin grep log / tìm trong Sentry.
- LOG_FORMAT=json (production) → mỗi dòng một JSON object, dễ đưa vào Render Logs / Loki / Datadog. Dev: dạng chữ.
- SENTRY_DSN → gửi lỗi chưa bắt + log ERROR lên Sentry. Trống → không làm gì.
"""
import json
import logging
import sys
import time
import uuid
from contextvars import ContextVar

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from .config import settings

request_id_var: ContextVar[str] = ContextVar("request_id", default="-")
log = logging.getLogger("learnhub.http")


class RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_var.get()
        return True


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        data = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S"), "level": record.levelname, "logger": record.name,
            "msg": record.getMessage(), "request_id": getattr(record, "request_id", "-"),
        }
        for k in ("method", "path", "status", "ms", "ip", "user_id"):
            if hasattr(record, k):
                data[k] = getattr(record, k)
        if record.exc_info:
            data["exc"] = self.formatException(record.exc_info)
        return json.dumps(data, ensure_ascii=False)


def setup_logging() -> None:
    root = logging.getLogger()
    root.handlers.clear()
    handler = logging.StreamHandler(sys.stdout)
    handler.addFilter(RequestIdFilter())
    if settings.log_format.lower() == "json":
        handler.setFormatter(JsonFormatter())
    else:
        handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)-7s [%(request_id)s] %(name)s: %(message)s", "%H:%M:%S"))
    root.addHandler(handler)
    root.setLevel(settings.log_level.upper())
    # uvicorn có access log riêng → tắt để không log đôi; log của ta có request_id, thời gian xử lý, user
    logging.getLogger("uvicorn.access").disabled = True
    for name in ("uvicorn", "uvicorn.error"):
        logging.getLogger(name).handlers.clear()
        logging.getLogger(name).propagate = True


def setup_sentry() -> bool:
    if not settings.sentry_dsn:
        return False
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.logging import LoggingIntegration
    from sentry_sdk.integrations.starlette import StarletteIntegration

    sentry_sdk.init(
        dsn=settings.sentry_dsn, environment=settings.app_env, release=settings.app_version or None,
        send_default_pii=False,  # không gửi IP/email người dùng lên Sentry
        traces_sample_rate=settings.sentry_traces_sample_rate,
        integrations=[StarletteIntegration(), FastApiIntegration(), LoggingIntegration(level=logging.INFO, event_level=logging.ERROR)],
    )
    logging.getLogger("learnhub").info("Sentry đã bật (env=%s)", settings.app_env)
    return True


def install(app: FastAPI) -> None:
    """Middleware request-id + access log, handler 500. Gọi một lần sau khi tạo app."""
    from .ratelimit import client_ip

    @app.middleware("http")
    async def request_context(request: Request, call_next):
        rid = request.headers.get("x-request-id") or uuid.uuid4().hex[:12]
        token = request_id_var.set(rid)
        start = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:  # noqa: BLE001 — đã log + Sentry, trả 500 có mã tra cứu
            ms = round((time.perf_counter() - start) * 1000)
            log.exception("Lỗi chưa bắt", extra={"method": request.method, "path": request.url.path, "status": 500, "ms": ms, "ip": client_ip(request)})
            response = JSONResponse(status_code=500, content={"detail": f"Lỗi hệ thống, hãy thử lại. Mã tra cứu: {rid}", "request_id": rid})
        else:
            ms = round((time.perf_counter() - start) * 1000)
            if request.url.path != "/api/health":  # health check gọi liên tục, không log
                level = logging.WARNING if response.status_code >= 500 else logging.INFO
                log.log(level, "%s %s → %s (%d ms)", request.method, request.url.path, response.status_code, ms,
                        extra={"method": request.method, "path": request.url.path, "status": response.status_code, "ms": ms, "ip": client_ip(request)})
        finally:
            request_id_var.reset(token)
        response.headers["X-Request-ID"] = rid
        return response
