from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    secret_key: str = "dev-secret-change-me"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60  # access token ngắn; gia hạn bằng refresh token
    refresh_token_expire_days: int = 30
    database_url: str = "sqlite:///./learnhub.db"
    cors_origins: str = "http://localhost:3000"
    # Tài khoản admin được tạo lần chạy đầu (chỉ khi DB chưa có user nào)
    admin_email: str = "admin@example.com"
    admin_password: str = "admin123"

    # Gửi email: có RESEND_API_KEY → gửi thật qua Resend; không có → in mã ra log (dev)
    mail_provider: str = "auto"  # auto | resend | console
    resend_api_key: str = ""
    mail_from: str = "LearnHub <onboarding@resend.dev>"  # đổi sang domain riêng khi đã xác minh trên Resend
    otp_expire_minutes: int = 10
    otp_max_attempts: int = 5
    otp_resend_cooldown_seconds: int = 60
    # Link đặt lại mật khẩu trỏ về frontend: {frontend_url}/reset-password?token=...
    frontend_url: str = "http://localhost:3000"
    reset_token_expire_minutes: int = 30

    # Chống lạm dụng
    rate_limit_enabled: bool = True
    trust_proxy_headers: bool = False  # True khi deploy sau proxy (Render/Railway) để đọc X-Forwarded-For
    login_max_failures: int = 5
    login_lockout_minutes: int = 15
    turnstile_secret_key: str = ""  # bỏ trống → không yêu cầu captcha

    # Thanh toán chuyển khoản / QR (VietQR). Người mua chuyển đúng số tiền với nội dung = mã đơn; admin xác nhận trong /admin.
    bank_bin: str = ""  # mã ngân hàng cho VietQR, vd 970436 (Vietcombank), 970422 (MB), 970407 (Techcombank). Trống → không hiện QR
    bank_account_number: str = ""
    bank_account_name: str = ""
    bank_name: str = ""  # tên hiển thị, vd "Vietcombank"
    order_expire_hours: int = 24  # đơn chờ quá hạn → expired
    order_notify_email: str = ""  # nhận mail "có đơn mới" để đi đối soát; trống → dùng ADMIN_EMAIL

    # Lưu file tài liệu bài học (S3 tương thích: Cloudflare R2 / Backblaze B2 / MinIO). Trống → chỉ đính kèm link ngoài.
    s3_endpoint_url: str = ""  # R2: https://<account_id>.r2.cloudflarestorage.com
    s3_bucket: str = ""
    s3_access_key_id: str = ""
    s3_secret_access_key: str = ""
    s3_region: str = "auto"
    s3_link_expire_seconds: int = 600  # link tải có hạn 10 phút
    upload_max_mb: int = 50

    # AI Check (gọi Claude). Trống ANTHROPIC_API_KEY → tính năng báo "chưa cấu hình", không trả kết quả giả.
    anthropic_api_key: str = ""
    ai_check_model: str = "claude-opus-5"
    ai_check_daily_limit: int = 5  # lượt / tài khoản / 24 giờ
    ai_check_max_chars: int = 15000
    ai_check_min_words: int = 80

    # Nút "Xuất bản" trong admin: kích hoạt GitHub Actions build lại frontend tĩnh (repository_dispatch).
    # Token fine-grained có quyền Contents: Read and write trên repo. Bỏ trống → nút báo chưa cấu hình.
    github_token: str = ""
    github_repo: str = "PhanVanChinh/LearnHub"  # owner/repo
    github_workflow_file: str = "deploy-pages.yml"

    # Đăng nhập Google (Google Identity Services): chỉ cần Client ID, bỏ trống → ẩn nút Google
    google_client_id: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
