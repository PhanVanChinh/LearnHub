"""Gửi email qua Resend (HTTP API). Không có RESEND_API_KEY → in ra log (chế độ dev), không gửi thật.

Đổi nhà cung cấp sau này chỉ cần thêm một hàm _send_xxx và nhánh trong send_email.
"""
import html as _html
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


def reset_password_email(name: str, link: str, minutes: int) -> tuple[str, str]:
    subject = "Đặt lại mật khẩu LearnHub"
    body = f"""<p>Chào {name},</p>
<p>Bấm nút dưới để đặt lại mật khẩu. Link có hiệu lực trong <b>{minutes} phút</b> và chỉ dùng được một lần.</p>
<p style="text-align:center;margin:24px 0"><a href="{link}" style="background:#1d4ed8;color:#fff;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:10px;display:inline-block">Đặt lại mật khẩu</a></p>
<p style="color:#64748b;font-size:13px">Hoặc dán link này vào trình duyệt:<br><a href="{link}" style="color:#1d4ed8;word-break:break-all">{link}</a></p>"""
    return subject, _layout("Đặt lại mật khẩu", body)


def _btn(link: str, label: str) -> str:
    return (f'<p style="text-align:center;margin:24px 0"><a href="{link}" style="background:#1d4ed8;color:#fff;text-decoration:none;'
            f'font-weight:700;padding:12px 24px;border-radius:10px;display:inline-block">{label}</a></p>')


def _vnd(n: int) -> str:
    return f"{n:,}".replace(",", ".") + "đ"


def order_created_email(name: str, code: str, course_title: str, amount: int, bank: dict, expire_hours: int, link: str) -> tuple[str, str]:
    """Gửi người mua ngay khi tạo đơn: hướng dẫn chuyển khoản + link mở lại đơn."""
    subject = f"Đơn {code} — hướng dẫn thanh toán {course_title}"
    rows = "".join(f'<tr><td style="padding:6px 0;color:#64748b">{k}</td><td style="padding:6px 0;text-align:right;font-weight:600">{v}</td></tr>'
                   for k, v in [("Ngân hàng", bank.get("bank_name")), ("Số tài khoản", bank.get("account_number")),
                                ("Chủ tài khoản", bank.get("account_name")), ("Số tiền", _vnd(amount)),
                                ("Nội dung chuyển khoản", f'<span style="font-family:monospace;color:#1d4ed8">{code}</span>')] if v)
    body = f"""<p>Chào {name},</p>
<p>Bạn vừa đặt mua <b>{course_title}</b>. Để hoàn tất, hãy chuyển khoản theo thông tin dưới đây trong <b>{expire_hours} giờ</b>.</p>
<table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:12px;padding:8px 16px;margin:16px 0">{rows}</table>
<p style="color:#b45309;font-size:13px">Nhập đúng nội dung <b>{code}</b> để chúng tôi đối soát nhanh. Khóa học tự mở khi được xác nhận (thường dưới 30 phút trong giờ làm việc).</p>
{_btn(link, "Mở đơn hàng & mã QR")}"""
    return subject, _layout("Hướng dẫn thanh toán", body)


def order_paid_email(name: str, code: str, course_title: str, learn_link: str) -> tuple[str, str]:
    """Gửi người mua khi admin xác nhận đã nhận tiền."""
    subject = f"Đã xác nhận thanh toán — {course_title}"
    body = f"""<p>Chào {name},</p>
<p>Đơn <b>{code}</b> đã được xác nhận. Khóa học <b>{course_title}</b> đã mở trong tài khoản của bạn, học được trên mọi thiết bị.</p>
{_btn(learn_link, "Vào học ngay")}
<p style="color:#64748b;font-size:13px">Cảm ơn bạn đã tin tưởng LearnHub. Cần hỗ trợ, hãy trả lời email này.</p>"""
    return subject, _layout("Thanh toán thành công 🎉", body)


def order_admin_notify_email(code: str, buyer_email: str, course_title: str, amount: int, admin_link: str) -> tuple[str, str]:
    """Báo admin có đơn mới cần đối soát."""
    subject = f"[LearnHub] Đơn mới {code} — {_vnd(amount)}"
    body = f"""<p><b>{buyer_email}</b> vừa đặt <b>{course_title}</b>, số tiền <b>{_vnd(amount)}</b>.</p>
<p>Kiểm tra giao dịch có nội dung <span style="font-family:monospace;color:#1d4ed8">{code}</span> trong app ngân hàng rồi bấm "Đã nhận tiền".</p>
{_btn(admin_link, "Mở trang duyệt đơn")}"""
    return subject, _layout("Có đơn hàng mới", body)


def _quote(text: str) -> str:
    safe = _html.escape(text).replace("\n", "<br>")
    return f'<blockquote style="margin:12px 0;padding:12px 16px;background:#f8fafc;border-left:4px solid #cbd5e1;border-radius:8px;white-space:pre-wrap">{safe}</blockquote>'


def contact_admin_email(msg_id: int, name: str, email: str, subject: str, message: str, admin_link: str) -> tuple[str, str]:
    """Báo admin có tin nhắn liên hệ mới. Trả lời trực tiếp email này sẽ tới người gửi (reply-to)."""
    subj = f"[LearnHub] Liên hệ #{msg_id}: {subject or '(không có chủ đề)'}"
    body = f"""<p><b>{_html.escape(name)}</b> &lt;{_html.escape(email)}&gt; vừa gửi tin nhắn:</p>
{_quote(message)}
<p style="color:#64748b;font-size:13px">Trả lời: gửi email tới <a href="mailto:{_html.escape(email)}">{_html.escape(email)}</a>, sau đó đánh dấu "đã trả lời" trong trang quản trị.</p>
{_btn(admin_link, "Mở trang quản trị")}"""
    return subj, _layout("Tin nhắn liên hệ mới", body)


def contact_ack_email(name: str, subject: str, message: str) -> tuple[str, str]:
    """Xác nhận cho người gửi: đã nhận, sẽ phản hồi trong 24 giờ làm việc."""
    subj = "LearnHub đã nhận tin nhắn của bạn"
    body = f"""<p>Chào {_html.escape(name)},</p>
<p>Chúng tôi đã nhận tin nhắn{f" về <b>{_html.escape(subject)}</b>" if subject else ""} và sẽ phản hồi qua email này trong <b>24 giờ làm việc</b>.</p>
<p style="color:#64748b;font-size:13px">Nội dung bạn đã gửi:</p>
{_quote(message)}"""
    return subj, _layout("Đã nhận tin nhắn", body)
