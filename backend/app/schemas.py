from datetime import datetime

import re

from pydantic import BaseModel, ConfigDict, EmailStr, Field, ValidationInfo, field_validator, model_validator

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
class QuizQuestion(BaseModel):
    q: str = Field(min_length=1, max_length=1000)
    options: list[str] = Field(min_length=2, max_length=6)
    answer: int = Field(ge=0, description="Chỉ số đáp án đúng trong options")
    explain: str = Field("", max_length=2000)

    @model_validator(mode="after")
    def _check(self):
        self.options = [o.strip() for o in self.options]
        if any(not o for o in self.options):
            raise ValueError("Phương án trả lời không được để trống")
        if self.answer >= len(self.options):
            raise ValueError("Chỉ số đáp án đúng vượt quá số phương án")
        return self


class Quiz(BaseModel):
    pass_percent: int = Field(70, ge=0, le=100, description="Đạt từ % này → bài học được đánh dấu hoàn thành")
    questions: list[QuizQuestion] = Field(min_length=1, max_length=100)


class Attachment(BaseModel):
    """Tài liệu đính kèm bài học. kind=file → `key` trên S3 (không public); kind=link → `url` ngoài (Drive, Notion...)."""

    name: str = Field(min_length=1, max_length=200)
    kind: str = Field("file", pattern=r"^(file|link)$")
    key: str | None = Field(None, max_length=300)
    url: str | None = Field(None, max_length=1000)
    size: int = Field(0, ge=0, description="bytes, 0 nếu là link")
    content_type: str = Field("", max_length=100)

    @model_validator(mode="after")
    def _check(self):
        if self.kind == "file" and not self.key:
            raise ValueError("Tài liệu dạng file cần có key")
        if self.kind == "link" and not (self.url and self.url.startswith(("http://", "https://"))):
            raise ValueError("Link tài liệu phải bắt đầu bằng http:// hoặc https://")
        return self


class AttachmentOut(BaseModel):
    """Bản công khai: không lộ key S3 hay URL ngoài — tải qua /attachments/{i}/download sau khi kiểm tra quyền."""

    name: str
    kind: str
    size: int = 0
    content_type: str = ""


class AttachmentLink(BaseModel):
    name: str
    url: str
    expires_in: int | None = Field(None, description="Giây; None với link ngoài")


class UploadOut(BaseModel):
    key: str
    name: str
    size: int
    content_type: str


class LessonBase(BaseModel):
    title: str
    duration: str
    free: bool = False
    video: str | None = Field(None, pattern=r"^[A-Za-z0-9_-]{11}$", description="YouTube video ID")


class Lesson(LessonBase):
    """Bản đầy đủ (admin ghi vào DB). `quiz` chứa đáp án, `attachments` chứa key/URL → KHÔNG trả ra public; dùng LessonOut."""

    quiz: Quiz | None = None
    attachments: list[Attachment] = Field(default_factory=list, max_length=20)


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


class LessonOut(LessonBase):
    """Bài học trả cho public: `video` chỉ có khi bài free hoặc người xem đã ghi danh; `has_video` luôn có.
    Trắc nghiệm chỉ lộ cờ và số câu; đề lấy qua /lessons/{i}/quiz, đáp án chỉ biết sau khi nộp."""

    has_video: bool = False
    has_quiz: bool = False
    quiz_count: int = 0
    attachments: list[AttachmentOut] = Field(default_factory=list)


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


class QuizQuestionPublic(BaseModel):
    q: str
    options: list[str]


class QuizPublic(BaseModel):
    index: int
    title: str
    pass_percent: int
    total: int
    questions: list[QuizQuestionPublic]


class QuizSubmitIn(BaseModel):
    answers: list[int | None] = Field(description="Chỉ số phương án đã chọn theo từng câu; None = bỏ trống")


class QuizAnswerResult(BaseModel):
    index: int
    chosen: int | None
    answer: int
    correct: bool
    explain: str = ""


class QuizResult(BaseModel):
    score: int
    total: int
    percent: int
    pass_percent: int
    passed: bool
    results: list[QuizAnswerResult]
    saved: bool = Field(False, description="Đã lưu lần làm (cần đăng nhập)")
    lesson_completed: bool = Field(False, description="Đạt và đã ghi danh → bài được đánh dấu hoàn thành")


class QuizAttemptOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    score: int
    total: int
    percent: int
    passed: bool
    created_at: datetime


class QuizAttempts(BaseModel):
    count: int
    best: QuizAttemptOut | None = None
    last: QuizAttemptOut | None = None


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
    deleted_at: datetime | None = None


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


# ---- Account (dữ liệu cá nhân) ----
class AccountDeleteIn(BaseModel):
    confirm: str = Field(description="Gõ đúng email tài khoản để xác nhận")
    password: str | None = Field(None, description="Bắt buộc nếu tài khoản có mật khẩu")


# ---- AI Check ----
class AiCheckIn(BaseModel):
    text: str = Field(min_length=1, max_length=100_000)


class AiCheckStatus(BaseModel):
    enabled: bool
    daily_limit: int
    used_today: int
    remaining: int
    max_chars: int
    min_words: int
    model: str = ""


class AiCheckSegmentOut(BaseModel):
    text: str
    ai_likelihood: int
    reason: str


class AiCheckOut(BaseModel):
    ai_score: int
    confidence: str
    verdict: str
    signals: list[str]
    segments: list[AiCheckSegmentOut]
    suggestions: list[str]
    writing_feedback: str
    words: int
    remaining: int
    daily_limit: int
    model: str


# ---- Contact ----
class ContactIn(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    subject: str = Field("", max_length=255)
    message: str = Field(min_length=10, max_length=5000)
    captcha_token: str | None = None

    @field_validator("name")
    @classmethod
    def _norm_name(cls, v: str) -> str:
        return _clean_name(v)

    @field_validator("email")
    @classmethod
    def _norm_email(cls, v: str) -> str:
        return v.strip().lower()

    @field_validator("message", "subject")
    @classmethod
    def _strip(cls, v: str) -> str:
        return v.strip()


class ContactOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: EmailStr
    subject: str
    message: str
    user_id: int | None = None
    status: str
    created_at: datetime
    replied_at: datetime | None = None


class PaginatedContacts(Paginated):
    items: list[ContactOut]


# ---- Orders ----
class OrderCreate(BaseModel):
    course_slug: str = Field(min_length=1, max_length=255)


class PaymentInfo(BaseModel):
    """Hướng dẫn chuyển khoản cho một đơn. `qr_url` None khi backend chưa cấu hình ngân hàng."""

    bank_name: str
    bank_bin: str
    account_number: str
    account_name: str
    amount: int
    content: str = Field(description="Nội dung chuyển khoản = mã đơn")
    qr_url: str | None = None


class OrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    status: str
    amount: int
    payment_method: str
    created_at: datetime
    expires_at: datetime
    paid_at: datetime | None = None
    course_slug: str = ""
    course_title: str = ""
    course_emoji: str = ""
    course_color: str = ""


class OrderDetail(OrderOut):
    payment: PaymentInfo | None = Field(None, description="Chỉ có khi đơn đang chờ thanh toán")


# ---- Certificates ----
class CertificateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    code: str
    holder_name: str
    course_title: str
    course_slug: str = ""
    lessons: int
    issued_at: datetime
    valid: bool = True
    verify_url: str = ""


# ---- Reviews ----
class RatingSummary(BaseModel):
    count: int = 0
    average: float | None = Field(None, description="Trung bình 1 chữ số; None khi chưa đủ MIN_REVIEWS đánh giá")
    distribution: dict[int, int] = Field(default_factory=lambda: {5: 0, 4: 0, 3: 0, 2: 0, 1: 0})


class ReviewIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str = Field("", max_length=2000)

    @field_validator("comment")
    @classmethod
    def _strip(cls, v: str) -> str:
        return re.sub(r"\s+", " ", v).strip()


class ReviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    rating: int
    comment: str
    created_at: datetime
    updated_at: datetime
    user_name: str = ""
    user_initial: str = ""
    mine: bool = False


class ReviewList(BaseModel):
    summary: RatingSummary
    total: int
    items: list[ReviewOut]
    mine: ReviewOut | None = Field(None, description="Đánh giá của người đang xem (kể cả khi bị ẩn)")
    can_review: bool = Field(False, description="Đã ghi danh → được đánh giá")


class AdminReviewOut(ReviewOut):
    user_id: int
    user_email: str = ""
    course_slug: str = ""
    course_title: str = ""
    hidden: bool
    hidden_reason: str | None = None


class PaginatedReviews(Paginated):
    items: list[AdminReviewOut]


class ReviewHideIn(BaseModel):
    reason: str | None = Field(None, max_length=300)


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
    rating: RatingSummary = Field(default_factory=RatingSummary)


class AdminOrderOut(OrderOut):
    user_id: int
    user_email: str = ""
    user_name: str = ""
    note: str | None = None
    confirmed_by_email: str | None = None


class PaginatedOrders(Paginated):
    items: list[AdminOrderOut]


class OrderAction(BaseModel):
    note: str | None = Field(None, max_length=500, description="Ghi chú nội bộ, vd mã giao dịch ngân hàng")


class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    actor_id: int | None
    actor_email: str | None
    action: str
    target_type: str
    target_id: str | None
    summary: str
    detail: dict | None = None
    ip: str | None
    created_at: datetime


class PaginatedAudit(Paginated):
    items: list[AuditLogOut]


class PublishStatus(BaseModel):
    configured: bool = Field(description="Đã có GITHUB_TOKEN + GITHUB_REPO")
    repo: str
    actions_url: str = Field(description="Trang Actions để theo dõi build")
    site_url: str = Field(description="URL frontend sau khi build xong")


class PublishResult(PublishStatus):
    detail: str


class AdminStats(BaseModel):
    users: int
    admins: int
    courses: int
    free_courses: int
    paid_courses: int
    enrollments: int
    total_views: int
    total_sold: int
    revenue: int = Field(description="Doanh thu thật: tổng amount của đơn đã thanh toán")
    paid_orders: int = 0
    pending_orders: int = 0
    new_contacts: int = 0
