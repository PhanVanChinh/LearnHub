"""Cloudflare Turnstile. Không đặt TURNSTILE_SECRET_KEY → bỏ qua kiểm tra (dev/test)."""
import logging

import httpx
from fastapi import HTTPException, status

from .config import settings

log = logging.getLogger("learnhub.captcha")
VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


def enabled() -> bool:
    return bool(settings.turnstile_secret_key)


def verify_or_raise(token: str | None, ip: str | None = None) -> None:
    if not enabled():
        return
    if not token:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Vui lòng hoàn thành xác minh 'Tôi không phải robot'")
    try:
        r = httpx.post(VERIFY_URL, data={"secret": settings.turnstile_secret_key, "response": token, **({"remoteip": ip} if ip else {})}, timeout=10)
        ok = r.status_code == 200 and r.json().get("success") is True
    except (httpx.HTTPError, ValueError) as e:
        log.error("Turnstile lỗi: %s", e)
        ok = False
    if not ok:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Xác minh robot thất bại, hãy tải lại trang và thử lại")
