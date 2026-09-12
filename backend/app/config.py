from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    secret_key: str = "dev-secret-change-me"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24
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

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
