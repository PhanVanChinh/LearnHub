from datetime import datetime

import re

from pydantic import BaseModel, ConfigDict, EmailStr, Field, ValidationInfo, field_validator

from .passwords import MAX_LENGTH, validate_password


# ---- Auth ----
def _clean_name(v: str) -> str:
    """Bỏ khoảng trắng thừa: '  Nguyễn   Văn  A ' → 'Nguyễn Văn A'."""
    v = re.sub(r"\s+", " ", v).strip()
    if not v:
        raise ValueError("Họ và tên không được để trống")
    return v


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=1, max_length=255)
    password: str = Field(max_length=MAX_LENGTH)
    accept_terms: bool = Field(True, description="Đồng ý điều khoản & chính sách bảo mật")
    captcha_token: str | None = Field(None, description="Token Cloudflare Turnstile (bắt buộc khi server bật captcha)")

    @field_validator("email")
    @classmethod
    def _norm_email(cls, v: str) -> str:
        return v.strip().lower()

    @field_validator("full_name")
    @classmethod
    def _norm_name(cls, v: str) -> str:
        return _clean_name(v)

    @field_validator("accept_terms")
    @classmethod
    def _must_accept(cls, v: bool) -> bool:
        if not v:
            raise ValueError("Bạn cần đồng ý điều khoản sử dụng")
        return v

    @field_validator("password")
    @classmethod
    def _check_password(cls, v: str, info: ValidationInfo) -> str:
        # email được khai báo trước nên đã có trong info.data (nếu hợp lệ) → lỗi gắn đúng trường "password"
        return validate_password(v, info.data.get("email"))


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    full_name: str
    role: str
    email_verified: bool = False
    avatar_url: str | None = None
    has_google: bool = Field(False, description="Đã liên kết tài khoản Google")
    has_password: bool = Field(True, description="False → tài khoản Google chưa đặt mật khẩu")
    created_at: datetime
    last_login_at: datetime | None = None
    password_changed_at: datetime | None = None
    sessions_revoked_at: datetime | None = Field(None, description="Lần cuối bấm 'đăng xuất mọi thiết bị'")


class UserUpdate(BaseModel):
    """Người dùng tự sửa hồ sơ. Email không đổi được ở đây (cần luồng xác thực riêng)."""

    full_name: str = Field(min_length=1, max_length=255)

    @field_validator("full_name")
    @classmethod
    def _norm_name(cls, v: str) -> str:
        return _clean_name(v)


class ForgotPasswordIn(BaseModel):
    email: EmailStr
    captcha_token: str | None = None


class ResetPasswordIn(BaseModel):
    token: str = Field(min_length=20, max_length=200)
    new_password: str = Field(max_length=MAX_LENGTH)

    @field_validator("new_password")
    @classmethod
    def _check(cls, v: str) -> str:
        return validate_password(v)


class Message(BaseModel):
    detail: str


class VerifyEmailIn(BaseModel):
    code: str = Field(pattern=r"^\d{6}$", description="Mã OTP 6 chữ số")


class VerificationStatus(BaseModel):
    email_verified: bool
    sent: bool = Field(False, description="Đã gửi mã mới trong lần gọi này")
    cooldown_seconds: int = Field(0, description="Số giây còn phải chờ trước khi gửi lại")
    mail_provider: str


class Token(BaseModel):
    access_token: str
    refresh_token: str | None = None
    token_type: str = "bearer"
    user: UserOut


class RefreshIn(BaseModel):
    refresh_token: str


class AuthConfig(BaseModel):
    captcha_enabled: bool
    mail_provider: str
    access_token_minutes: int
    google_client_id: str = Field("", description="Rỗng → ẩn nút Google")


class GoogleLoginIn(BaseModel):
    credential: str = Field(min_length=20, description="ID token từ Google Identity Services")


class PasswordSet(BaseModel):
    """Đặt mật khẩu lần đầu cho tài khoản Google (không cần mật khẩu hiện tại)."""

    new_password: str = Field(max_length=MAX_LENGTH)

    @field_validator("new_password")
    @classmethod
    def _check(cls, v: str) -> str:
        return validate_password(v)


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(max_length=MAX_LENGTH)

    @field_validator("new_password")
    @classmethod
    def _check(cls, v: str) -> str:
        return validate_password(v)


# ---- Courses ----
class Lesson(BaseModel):
    title: str
    duration: str
    free: bool = False
    video: str | None = Field(None, pattern=r"^[A-Za-z0-9_-]{11}$", description="YouTube video ID")


class CourseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    title: str
    category: str
    tags: list[str]
    price: int
    views: int
    sold: int
    color: str
    emoji: str
    short: str
    featured: bool


class LessonOut(Lesson):
    """Bài học trả cho public: `video` chỉ có khi bài free hoặc người xem đã ghi danh; `has_video` luôn có."""

    has_video: bool = False


class CourseDetail(CourseOut):
    description: str
    includes: list[str]
    lessons: list[LessonOut]
    enrolled: bool = False


class CoursePublic(CourseOut):
    """Bản công khai đầy đủ của một khóa (không cần đăng nhập): video chỉ giữ ở bài free.
    Frontend dùng lúc build tĩnh (generateStaticParams + nội dung) nên tuyệt đối không lộ video bài trả phí."""

    description: str
    includes: list[str]
    lessons: list[LessonOut]


class LessonVideo(BaseModel):
    index: int
    title: str
    video: str | None = Field(None, description="YouTube ID; None nếu bài chưa có video")


class Progress(BaseModel):
    completed: list[int] = Field(default_factory=list, description="Chỉ số các bài đã hoàn thành")
    total: int
    percent: int
    next_index: int | None = Field(None, description="Bài chưa học đầu tiên; None nếu đã xong hết")


class EnrolledCourseOut(CourseOut):
    progress: Progress


class CategoryCount(BaseModel):
    key: str
    label: str
    count: int


# ---- Admin: courses ----
class CourseBase(BaseModel):
    slug: str = Field(min_length=1, max_length=255, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$",
                      description="Chữ thường, số và dấu gạch ngang")
    title: str = Field(min_length=1, max_length=500)
    category: str = Field(min_length=1, max_length=50)
    tags: list[str] = []
    price: int = Field(0, ge=0)
    color: str = Field("from-brand-500 to-brand-700", max_length=100)
    emoji: str = Field("📘", max_length=10)
    short: str = ""
    description: str = ""
    includes: list[str] = []
    lessons: list[Lesson] = []
    featured: bool = False


class CourseCreate(CourseBase):
    views: int = Field(0, ge=0)
    sold: int = Field(0, ge=0)


class CourseUpdate(BaseModel):
    """Cập nhật từng phần — chỉ trường nào gửi lên mới được thay đổi."""

    slug: str | None = Field(None, min_length=1, max_length=255, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    title: str | None = Field(None, min_length=1, max_length=500)
    category: str | None = Field(None, min_length=1, max_length=50)
    tags: list[str] | None = None
    price: int | None = Field(None, ge=0)
    views: int | None = Field(None, ge=0)
    sold: int | None = Field(None, ge=0)
    color: str | None = Field(None, max_length=100)
    emoji: str | None = Field(None, max_length=10)
    short: str | None = None
    description: str | None = None
    includes: list[str] | None = None
    lessons: list[Lesson] | None = None
    featured: bool | None = None


class AdminCourseOut(CourseOut):
    description: str
    includes: list[str]
    lessons: list[Lesson]
    enrollment_count: int = 0


# ---- Admin: users ----
class AdminUserOut(UserOut):
    is_active: bool
    enrollment_count: int = 0


class AdminUserCreate(UserCreate):
    role: str = Field("user", pattern=r"^(user|admin)$")
    is_active: bool = True


class AdminUserUpdate(BaseModel):
    full_name: str | None = Field(None, min_length=1, max_length=255)
    email: EmailStr | None = None
    password: str | None = Field(None, max_length=MAX_LENGTH)
    role: str | None = Field(None, pattern=r"^(user|admin)$")
    is_active: bool | None = None

    @field_validator("password")
    @classmethod
    def _check(cls, v: str | None) -> str | None:
        return validate_password(v) if v is not None else v

    @field_validator("full_name")
    @classmethod
    def _norm_name(cls, v: str | None) -> str | None:
        return _clean_name(v) if v is not None else v


# ---- Admin: enrollments & stats ----
class AdminEnrollmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    course_id: int
    created_at: datetime
    user_email: str
    course_slug: str
    course_title: str


class AdminEnrollmentCreate(BaseModel):
    user_id: int
    course_id: int


class Paginated(BaseModel):
    total: int
    limit: int
    offset: int


class PaginatedCourses(Paginated):
    items: list[AdminCourseOut]


class PaginatedUsers(Paginated):
    items: list[AdminUserOut]


class PaginatedEnrollments(Paginated):
    items: list[AdminEnrollmentOut]


# ---- Public stats ----
class PublicStats(BaseModel):
    courses: int
    lessons: int
    videos: int
    students: int = Field(description="Số người đã ghi danh ít nhất một khóa")
    enrollments: int
    views: int


class CourseStats(BaseModel):
    slug: str
    views: int
    students: int = Field(description="Số ghi danh của khóa (miễn phí + đã mua)")


class AdminStats(BaseModel):
    users: int
    admins: int
    courses: int
    free_courses: int
    paid_courses: int
    enrollments: int
    total_views: int
    total_sold: int
    revenue: int = Field(description="Ước tính: tổng price × sold (sold = số ghi danh) của các khóa trả phí; chưa có đơn hàng thật")
