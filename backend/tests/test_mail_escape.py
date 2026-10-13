"""Template email escape dữ liệu người dùng: tên chứa HTML không thành link/thẻ thật trong mail."""
from app import mailer

EVIL = '<a href="https://evil.example">Nhận quà</a>'


def test_templates_escape_user_values():
    bank = {"bank_name": "VCB", "account_number": "1", "account_name": "<b>X</b>"}
    rendered = [
        mailer.verification_email(EVIL, "123456", 10),
        mailer.reset_password_email(EVIL, "https://learnhub.test/reset?t=a&b=1", 30),
        mailer.order_created_email(EVIL, "LHABC123", EVIL, 15000, bank, 24, "https://learnhub.test/checkout?order=LHABC123"),
        mailer.order_paid_email(EVIL, "LHABC123", EVIL, "https://learnhub.test/learn/x"),
        mailer.order_cancelled_email(EVIL, "LHABC123", EVIL, EVIL, "https://learnhub.test/checkout?course=x"),
        mailer.order_admin_notify_email("LHABC123", EVIL, EVIL, 15000, "https://learnhub.test/admin"),
    ]
    for subject, html in rendered:
        assert "evil.example\">Nhận quà</a>" not in html, subject
        assert "&lt;a href=" in html, subject
    # link hợp lệ không bị escape hai lần
    _, reset = rendered[1]
    assert 'href="https://learnhub.test/reset?t=a&amp;b=1"' in reset and "&amp;amp;" not in reset
    # tiêu đề mail là text thuần → giữ nguyên tên khóa
    assert rendered[3][0].endswith(EVIL)
