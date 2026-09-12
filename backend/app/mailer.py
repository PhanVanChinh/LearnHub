"""Gửi email qua Resend (HTTP API). Không có RESEND_API_KEY → in ra log (chế độ dev), không gửi thật.

Đổi nhà cung cấp sau này chỉ cần thêm một hàm _send_xxx và nhánh trong send_email.
"""
import logging

import httpx

from .config import settings

log = logging.getLogger("learnhub.mail")

# Chế độ console lưu lại các mail đã "gửi" để dev/test đọc mã OTP
console_outbox: list[dict] = []


def provider() -> str:
    if settings.mail_provider != "auto":
        return settings.mail_provider
    return "resend" if settings.resend_api_key else "console"


def send_email(to: str, subject: str, html: str) -> bool:
    if provider() == "resend":
        return _send_resend(to, subject, html)
    console_outbox.append({"to": to, "subject": subject, "html": html})
    log.warning("[MAIL console] to=%s subject=%s\n%s", to, subject, _strip_tags(html))
    return True


def _send_resend(to: str, subject: str, html: str) -> bool:
    try:
        r = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            json={"from": settings.mail_from, "to": [to], "subject": subject, "html": html},
            timeout=10,
        )
        if r.status_code >= 400:
            log.error("Resend %s: %s", r.status_code, r.text[:300])
            return False
        return True
    except httpx.HTTPError as e:
        log.error("Resend lỗi kết nối: %s", e)
        return False


def _strip_tags(html: str) -> str:
    import re
    return re.sub(r"<[^>]+>", " ", html).replace("  ", " ").strip()


# ---------- templates ----------
def _layout(title: str, body: str) -> str:
    return f"""<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0f172a">
<div style="max-width:520px;margin:32px auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:32px">
  <div style="font-weight:800;font-size:20px;color:#1d4ed8">LearnHub</div>
  <h1 style="font-size:20px;margin:20px 0 8px">{title}</h1>
  {body}
  <p style="color:#64748b;font-size:12px;margin-top:28px">Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email.</p>
</div></body></html>"""


def verification_email(name: str, code: str, minutes: int) -> tuple[str, str]:
    subject = f"{code} là mã xác thực LearnHub của bạn"
    body = f"""<p>Chào {name},</p>
<p>Nhập mã sau để xác thực email. Mã có hiệu lực trong <b>{minutes} phút</b>.</p>
<div style="font-size:36px;letter-spacing:10px;font-weight:800;text-align:center;background:#eff6ff;color:#1d4ed8;border-radius:12px;padding:16px;margin:20px 0">{code}</div>"""
    return subject, _layout("Xác thực email", body)
