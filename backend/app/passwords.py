"""Quy tắc mật khẩu dùng chung cho đăng ký, đổi mật khẩu, admin tạo/sửa user.

Frontend có bản sao logic ở lib/password.ts để hiển thị tức thời; backend luôn là nơi quyết định cuối.
"""
import re

MIN_LENGTH = 8
MAX_LENGTH = 128

# Danh sách ngắn các mật khẩu quá phổ biến (so khớp không phân biệt hoa thường)
COMMON_PASSWORDS = {
    "12345678", "123456789", "1234567890", "password", "password1", "password123", "qwerty123", "qwertyuiop",
    "11111111", "00000000", "abcd1234", "abc12345", "iloveyou", "admin123", "admin1234", "letmein1", "welcome1",
    "matkhau1", "matkhau123", "phenikaa1", "phenikaa123", "learnhub1", "learnhub123", "a12345678", "1q2w3e4r",
}


def password_issues(password: str, email: str | None = None) -> list[str]:
    """Trả về danh sách lỗi (rỗng = hợp lệ)."""
    issues: list[str] = []
    if len(password) < MIN_LENGTH:
        issues.append(f"Mật khẩu phải có ít nhất {MIN_LENGTH} ký tự")
    if len(password) > MAX_LENGTH:
        issues.append(f"Mật khẩu tối đa {MAX_LENGTH} ký tự")
    if not re.search(r"[A-Za-z]", password):
        issues.append("Mật khẩu phải có ít nhất một chữ cái")
    if not re.search(r"\d", password):
        issues.append("Mật khẩu phải có ít nhất một chữ số")
    if password.strip() != password:
        issues.append("Mật khẩu không được bắt đầu/kết thúc bằng khoảng trắng")
    if password.lower() in COMMON_PASSWORDS:
        issues.append("Mật khẩu này quá phổ biến, hãy chọn mật khẩu khác")
    if email:
        local = email.split("@")[0].lower()
        if len(local) >= 4 and local in password.lower():
            issues.append("Mật khẩu không được chứa tên đăng nhập/email")
    return issues


def validate_password(password: str, email: str | None = None) -> str:
    """Dùng trong Pydantic validator: ném ValueError với thông báo đầu tiên."""
    issues = password_issues(password, email)
    if issues:
        raise ValueError(issues[0])
    return password
