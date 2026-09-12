"""Xác minh Google ID token (Google Identity Services) bằng khoá công khai của Google.

Frontend nhận `credential` (JWT RS256) từ nút Google rồi gửi lên; backend kiểm tra chữ ký, audience (client id),
issuer, hạn dùng và cờ email_verified. Không cần Client Secret.
"""
import logging
import time

import httpx
from fastapi import HTTPException, status
from jose import JWTError, jwt

from .config import settings

log = logging.getLogger("learnhub.google")
CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs"
ISSUERS = ("https://accounts.google.com", "accounts.google.com")

_certs: dict = {"keys": [], "fetched_at": 0.0}


def enabled() -> bool:
    return bool(settings.google_client_id)


def _keys() -> list[dict]:
    if time.time() - _certs["fetched_at"] > 3600 or not _certs["keys"]:
        r = httpx.get(CERTS_URL, timeout=10)
        r.raise_for_status()
        _certs.update(keys=r.json()["keys"], fetched_at=time.time())
    return _certs["keys"]


def verify_id_token(credential: str) -> dict:
    """Trả về claims {sub, email, email_verified, name, picture} hoặc ném HTTPException 401."""
    if not enabled():
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Đăng nhập Google chưa được cấu hình")
    try:
        kid = jwt.get_unverified_header(credential).get("kid")
        key = next((k for k in _keys() if k.get("kid") == kid), None)
        if key is None:  # khoá xoay vòng → tải lại một lần
            _certs["fetched_at"] = 0.0
            key = next((k for k in _keys() if k.get("kid") == kid), None)
        if key is None:
            raise JWTError("Không tìm thấy khoá ký")
        claims = jwt.decode(credential, key, algorithms=["RS256"], audience=settings.google_client_id, issuer=ISSUERS)
    except (JWTError, httpx.HTTPError, KeyError, ValueError) as e:
        log.warning("Google token không hợp lệ: %s", e)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Đăng nhập Google thất bại, hãy thử lại")
    if not claims.get("email") or claims.get("email_verified") not in (True, "true"):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Tài khoản Google chưa xác minh email")
    return claims
