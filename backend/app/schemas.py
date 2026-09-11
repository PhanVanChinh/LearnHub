from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# ---- Auth ----
class UserCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=6, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    full_name: str
    role: str
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6, max_length=128)


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
    password: str | None = Field(None, min_length=6, max_length=128)
    role: str | None = Field(None, pattern=r"^(user|admin)$")
    is_active: bool | None = None


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


class AdminStats(BaseModel):
    users: int
    admins: int
    courses: int
    free_courses: int
    paid_courses: int
    enrollments: int
    total_views: int
    total_sold: int
    revenue: int = Field(description="Tổng price × sold của các khóa trả phí")
