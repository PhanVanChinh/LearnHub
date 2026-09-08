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


class CourseDetail(CourseOut):
    description: str
    includes: list[str]
    lessons: list[Lesson]
    enrolled: bool = False


class CategoryCount(BaseModel):
    key: str
    label: str
    count: int
