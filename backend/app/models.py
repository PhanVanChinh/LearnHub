from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(255))
    hashed_password: Mapped[str] = mapped_column(String(255))  # "" = chưa đặt mật khẩu (tài khoản chỉ đăng nhập Google)
    role: Mapped[str] = mapped_column(String(20), default="user")  # user | admin
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # Token JWT phát hành trước thời điểm này bị coi là hết hạn (đăng xuất mọi thiết bị sau khi đổi/đặt lại mật khẩu)
    password_changed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    sessions_revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)  # "đăng xuất mọi thiết bị"
    failed_login_attempts: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    google_sub: Mapped[str | None] = mapped_column(String(64), nullable=True, unique=True, index=True)  # id tài khoản Google đã liên kết
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    enrollments: Mapped[list["Enrollment"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    verifications: Mapped[list["EmailVerification"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    password_resets: Mapped[list["PasswordReset"]] = relationship(back_populates="user", cascade="all, delete-orphan")

    @property
    def email_verified(self) -> bool:
        return self.email_verified_at is not None

    @property
    def has_google(self) -> bool:
        return self.google_sub is not None

    @property
    def has_password(self) -> bool:
        """False với tài khoản tạo qua Google chưa đặt mật khẩu → không đăng nhập bằng mật khẩu được."""
        return bool(self.hashed_password)

    @property
    def token_invalid_before(self) -> datetime | None:
        """Token phát hành trước mốc này không còn hiệu lực (đổi mật khẩu hoặc thu hồi phiên)."""
        marks = [d for d in (self.password_changed_at, self.sessions_revoked_at) if d]
        return max(marks) if marks else None
    progress: Mapped[list["LessonProgress"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    orders: Mapped[list["Order"]] = relationship(back_populates="user", foreign_keys="Order.user_id", cascade="all, delete-orphan")
    quiz_attempts: Mapped[list["QuizAttempt"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(500))
    category: Mapped[str] = mapped_column(String(50), index=True)
    tags: Mapped[list] = mapped_column(JSON, default=list)
    price: Mapped[int] = mapped_column(Integer, default=0)
    views: Mapped[int] = mapped_column(Integer, default=0)
    sold: Mapped[int] = mapped_column(Integer, default=0)
    color: Mapped[str] = mapped_column(String(100), default="from-brand-500 to-brand-700")
    emoji: Mapped[str] = mapped_column(String(10), default="📘")
    short: Mapped[str] = mapped_column(Text, default="")
    description: Mapped[str] = mapped_column(Text, default="")
    includes: Mapped[list] = mapped_column(JSON, default=list)
    lessons: Mapped[list] = mapped_column(JSON, default=list)
    featured: Mapped[bool] = mapped_column(Boolean, default=False)

    enrollments: Mapped[list["Enrollment"]] = relationship(back_populates="course", cascade="all, delete-orphan")
    progress: Mapped[list["LessonProgress"]] = relationship(back_populates="course", cascade="all, delete-orphan")
    orders: Mapped[list["Order"]] = relationship(back_populates="course", cascade="all, delete-orphan")
    quiz_attempts: Mapped[list["QuizAttempt"]] = relationship(back_populates="course", cascade="all, delete-orphan")


class Enrollment(Base):
    """Người dùng đã ghi danh (miễn phí hoặc đã mua) khóa học."""

    __tablename__ = "enrollments"
    __table_args__ = (UniqueConstraint("user_id", "course_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped[User] = relationship(back_populates="enrollments")
    course: Mapped[Course] = relationship(back_populates="enrollments")


class Order(Base):
    """Đơn mua khóa học trả phí. Luồng: pending (chờ chuyển khoản) → paid (admin xác nhận, tự tạo Enrollment)
    hoặc cancelled (người mua / admin huỷ) / expired (quá hạn chưa thanh toán)."""

    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(20), unique=True, index=True)  # mã đơn = nội dung chuyển khoản, vd LH7K3M9P
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id"), index=True)
    amount: Mapped[int] = mapped_column(Integer)  # giá tại thời điểm đặt (VND)
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)  # pending | paid | cancelled | expired
    payment_method: Mapped[str] = mapped_column(String(30), default="bank_transfer")
    note: Mapped[str | None] = mapped_column(Text, nullable=True)  # ghi chú của admin khi duyệt/huỷ
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    confirmed_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    user: Mapped[User] = relationship(foreign_keys=[user_id], back_populates="orders")
    course: Mapped[Course] = relationship(back_populates="orders")
    confirmed_by: Mapped[User | None] = relationship(foreign_keys=[confirmed_by_id])


class QuizAttempt(Base):
    """Một lần nộp bài trắc nghiệm của người dùng (chỉ lưu khi đã đăng nhập)."""

    __tablename__ = "quiz_attempts"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id"), index=True)
    lesson_index: Mapped[int] = mapped_column(Integer)
    score: Mapped[int] = mapped_column(Integer)
    total: Mapped[int] = mapped_column(Integer)
    percent: Mapped[int] = mapped_column(Integer)
    passed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped[User] = relationship(back_populates="quiz_attempts")
    course: Mapped[Course] = relationship(back_populates="quiz_attempts")


class ContactMessage(Base):
    """Tin nhắn từ form Liên hệ. status: new → replied (admin đánh dấu sau khi trả lời qua email)."""

    __tablename__ = "contact_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    email: Mapped[str] = mapped_column(String(255), index=True)
    subject: Mapped[str] = mapped_column(String(255), default="")
    message: Mapped[str] = mapped_column(Text)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)  # nếu gửi khi đang đăng nhập
    status: Mapped[str] = mapped_column(String(20), default="new", index=True)  # new | replied
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    replied_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class LessonProgress(Base):
    """Bài học (theo chỉ số trong course.lessons) mà người dùng đã đánh dấu hoàn thành."""

    __tablename__ = "lesson_progress"
    __table_args__ = (UniqueConstraint("user_id", "course_id", "lesson_index"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id"), index=True)
    lesson_index: Mapped[int] = mapped_column(Integer)
    completed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped[User] = relationship(back_populates="progress")
    course: Mapped[Course] = relationship(back_populates="progress")


class EmailVerification(Base):
    """Mã OTP xác thực email (lưu hash, không lưu mã gốc)."""

    __tablename__ = "email_verifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    code_hash: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped[User] = relationship(back_populates="verifications")


class PasswordReset(Base):
    """Token đặt lại mật khẩu dùng một lần (lưu hash)."""

    __tablename__ = "password_resets"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped[User] = relationship(back_populates="password_resets")
