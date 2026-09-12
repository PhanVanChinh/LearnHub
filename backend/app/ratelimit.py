"""Giới hạn tần suất theo IP, lưu trong bộ nhớ tiến trình (đủ cho 1 instance; nhiều instance thì đổi sang Redis).

Dùng: `dependencies=[Depends(rate_limit("login", 10, 60))]` → tối đa 10 request / 60 giây / IP cho khoá "login".
"""
import time
from collections import defaultdict, deque

from fastapi import Depends, HTTPException, Request, status

from .config import settings

_buckets: dict[str, deque[float]] = defaultdict(deque)


def client_ip(request: Request) -> str:
    """IP thật của khách: ưu tiên X-Forwarded-For (khi chạy sau proxy như Render/Railway)."""
    if settings.trust_proxy_headers:
        xff = request.headers.get("x-forwarded-for")
        if xff:
            return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def hit(key: str, limit: int, window: int) -> int:
    """Ghi nhận 1 lần gọi. Trả về 0 nếu còn hạn, ngược lại trả số giây phải chờ."""
    now = time.monotonic()
    q = _buckets[key]
    while q and now - q[0] >= window:
        q.popleft()
    if len(q) >= limit:
        return int(window - (now - q[0])) + 1
    q.append(now)
    return 0


def rate_limit(name: str, limit: int, window_seconds: int):
    def dependency(request: Request):
        if not settings.rate_limit_enabled:
            return
        wait = hit(f"{name}:{client_ip(request)}", limit, window_seconds)
        if wait:
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                f"Bạn thao tác quá nhanh, vui lòng thử lại sau {wait} giây",
                headers={"Retry-After": str(wait)},
            )
    return Depends(dependency)


def reset() -> None:
    """Dùng trong test."""
    _buckets.clear()
