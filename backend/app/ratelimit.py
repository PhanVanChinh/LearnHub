"""Giới hạn tần suất theo IP, lưu trong bộ nhớ tiến trình (đủ cho 1 instance; nhiều instance thì đổi sang Redis).

Dùng: `dependencies=[Depends(rate_limit("login", 10, 60))]` → tối đa 10 request / 60 giây / IP cho khóa "login".
"""
import time
from collections import deque

from fastapi import Depends, HTTPException, Request, status

from .config import settings

_buckets: dict[str, deque[float]] = {}
_expires: dict[str, float] = {}  # key → thời điểm bucket chắc chắn rỗng (lần gọi cuối + window)
_SWEEP_EVERY = 60.0
_next_sweep = 0.0


def _sweep(now: float) -> None:
    """Mỗi phút dọn bucket đã hết hạn: quét từ nhiều IP (mỗi IP vài request rồi thôi) không để dict phình vô hạn."""
    global _next_sweep
    if now < _next_sweep:
        return
    _next_sweep = now + _SWEEP_EVERY
    for key in [k for k, exp in _expires.items() if exp <= now]:
        _buckets.pop(key, None)
        _expires.pop(key, None)


def client_ip(request: Request) -> str:
    """IP thật của khách khi chạy sau proxy (Render/Railway).

    Proxy NỐI THÊM IP nó thấy vào cuối X-Forwarded-For, còn phần đầu là do khách tự gửi (giả được).
    Lấy phần tử CUỐI → khách gửi "X-Forwarded-For: 1.2.3.4" vẫn bị tính theo IP thật, không vượt được rate limit.
    (Chỉ đúng với một lớp proxy tin cậy ngay trước backend — đúng với Render/Railway/nginx đơn.)"""
    if settings.trust_proxy_headers:
        xff = request.headers.get("x-forwarded-for")
        if xff:
            last = xff.rsplit(",", 1)[-1].strip()
            if last:
                return last
    return request.client.host if request.client else "unknown"


def hit(key: str, limit: int, window: int) -> int:
    """Ghi nhận 1 lần gọi. Trả về 0 nếu còn hạn, ngược lại trả số giây phải chờ."""
    now = time.monotonic()
    _sweep(now)
    q = _buckets.get(key)
    if q is None:
        q = _buckets[key] = deque()
    while q and now - q[0] >= window:
        q.popleft()
    if len(q) >= limit:
        return int(window - (now - q[0])) + 1
    q.append(now)
    _expires[key] = now + window
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
    global _next_sweep
    _buckets.clear()
    _expires.clear()
    _next_sweep = 0.0
