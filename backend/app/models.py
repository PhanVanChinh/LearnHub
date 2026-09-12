from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(255))
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default="user")  # user | admin
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # Token JWT phát hành trước thời điểm này bị coi là hết hạn (đăng xuất mọi thiết bị sau khi đổi/đặt lại mật khẩu)
    password_changed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    enrollments: Mapped[list["Enrollment"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    verifications: Mapped[list["EmailVerification"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    password_resets: Mapped[list["PasswordReset"]] = relationship(back_populates="user", cascade="all, delete-orphan")

    @property
    def email_verified(self) -> bool:
        return self.email_verified_at is not None
    progress: Mapped[list["LessonProgress"]] = relationship(back_populates="user", cascade="all, delete-orphan")


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
