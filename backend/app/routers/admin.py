"""CRUD dành cho admin: khóa học, người dùng, ghi danh, thống kê.

Mọi endpoint yêu cầu Bearer token của tài khoản có role = "admin" (xem security.require_admin).
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import String, func, or_
from sqlalchemy.orm import Session

from .. import schemas
from ..database import get_db
from ..models import Course, Enrollment, User
from ..security import hash_password, require_admin

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin)])


# ---------- helpers ----------
def _course_out(course: Course, count: int | None = None) -> schemas.AdminCourseOut:
    out = schemas.AdminCourseOut.model_validate(course)
    out.enrollment_count = len(course.enrollments) if count is None else count
    return out


def _user_out(user: User, count: int | None = None) -> schemas.AdminUserOut:
    out = schemas.AdminUserOut.model_validate(user)
    out.enrollment_count = len(user.enrollments) if count is None else count
    return out


def _enrollment_out(e: Enrollment) -> schemas.AdminEnrollmentOut:
    return schemas.AdminEnrollmentOut(
        id=e.id, user_id=e.user_id, course_id=e.course_id, created_at=e.created_at,
        user_email=e.user.email, course_slug=e.course.slug, course_title=e.course.title,
    )


def _get_course(db: Session, course_id: int) -> Course:
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy khóa học")
    return course


def _get_user(db: Session, user_id: int) -> User:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy người dùng")
    return user


def _ensure_slug_free(db: Session, slug: str, exclude_id: int | None = None) -> None:
    q = db.query(Course.id).filter(Course.slug == slug)
    if exclude_id is not None:
        q = q.filter(Course.id != exclude_id)
    if q.first():
        raise HTTPException(status.HTTP_409_CONFLICT, f"Slug '{slug}' đã tồn tại")


def _ensure_email_free(db: Session, email: str, exclude_id: int | None = None) -> None:
    q = db.query(User.id).filter(User.email == email)
    if exclude_id is not None:
        q = q.filter(User.id != exclude_id)
    if q.first():
        raise HTTPException(status.HTTP_409_CONFLICT, "Email đã được đăng ký")


def _normalize_tags(data: dict) -> None:
    """Đảm bảo tags luôn chứa category và 'free' khi price = 0 (giống quy ước frontend)."""
    if "tags" not in data and "category" not in data and "price" not in data:
        return
    tags = list(dict.fromkeys(data.get("tags") or []))
    cat = data.get("category")
    if cat and cat not in tags:
        tags.insert(0, cat)
    price = data.get("price")
    if price == 0 and "free" not in tags:
        tags.append("free")
    elif price and price > 0:
        tags = [t for t in tags if t != "free"]
    data["tags"] = tags


# ---------- stats ----------
@router.get("/stats", response_model=schemas.AdminStats)
def stats(db: Session = Depends(get_db)):
    users = db.query(func.count(User.id)).scalar() or 0
    admins = db.query(func.count(User.id)).filter(User.role == "admin").scalar() or 0
    courses = db.query(func.count(Course.id)).scalar() or 0
    free_courses = db.query(func.count(Course.id)).filter(Course.price == 0).scalar() or 0
    enrollments = db.query(func.count(Enrollment.id)).scalar() or 0
    total_views = db.query(func.coalesce(func.sum(Course.views), 0)).scalar() or 0
    total_sold = db.query(func.coalesce(func.sum(Course.sold), 0)).scalar() or 0
    revenue = db.query(func.coalesce(func.sum(Course.price * Course.sold), 0)).scalar() or 0
    return schemas.AdminStats(
        users=users, admins=admins, courses=courses, free_courses=free_courses,
        paid_courses=courses - free_courses, enrollments=enrollments,
        total_views=total_views, total_sold=total_sold, revenue=revenue,
    )


# ---------- courses ----------
@router.get("/courses", response_model=schemas.PaginatedCourses)
def list_courses(
    q: str | None = Query(None, description="Tìm theo tiêu đề / slug / mô tả ngắn"),
    category: str | None = None,
    featured: bool | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    query = db.query(Course)
    if q:
        kw = f"%{q.strip()}%"
        query = query.filter(or_(Course.title.ilike(kw), Course.slug.ilike(kw), Course.short.ilike(kw)))
    if category and category != "all":
        query = query.filter(Course.tags.cast(String).like(f'%"{category}"%'))
    if featured is not None:
        query = query.filter(Course.featured == featured)
    total = query.count()
    items = query.order_by(Course.id).offset(offset).limit(limit).all()
    return schemas.PaginatedCourses(total=total, limit=limit, offset=offset, items=[_course_out(c) for c in items])


@router.post("/courses", response_model=schemas.AdminCourseOut, status_code=status.HTTP_201_CREATED)
def create_course(payload: schemas.CourseCreate, db: Session = Depends(get_db)):
    _ensure_slug_free(db, payload.slug)
    data = payload.model_dump()
    _normalize_tags(data)
    course = Course(**data)
    db.add(course)
    db.commit()
    db.refresh(course)
    return _course_out(course, 0)


@router.get("/courses/{course_id}", response_model=schemas.AdminCourseOut)
def get_course(course_id: int, db: Session = Depends(get_db)):
    return _course_out(_get_course(db, course_id))


@router.patch("/courses/{course_id}", response_model=schemas.AdminCourseOut)
@router.put("/courses/{course_id}", response_model=schemas.AdminCourseOut, include_in_schema=False)
def update_course(course_id: int, payload: schemas.CourseUpdate, db: Session = Depends(get_db)):
    course = _get_course(db, course_id)
    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Không có trường nào để cập nhật")
    if "slug" in data and data["slug"] != course.slug:
        _ensure_slug_free(db, data["slug"], exclude_id=course.id)
    # Tính lại tags dựa trên giá trị mới hoặc giá trị hiện có
    merged = {"tags": data.get("tags", course.tags), "category": data.get("category", course.category),
              "price": data.get("price", course.price)}
    if any(k in data for k in ("tags", "category", "price")):
        _normalize_tags(merged)
        data["tags"] = merged["tags"]
    for k, v in data.items():
        setattr(course, k, v)
    db.commit()
    db.refresh(course)
    return _course_out(course)


@router.delete("/courses/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_course(course_id: int, db: Session = Depends(get_db)):
    course = _get_course(db, course_id)
    db.delete(course)  # cascade xoá enrollments
    db.commit()


# ---------- users ----------
@router.get("/users", response_model=schemas.PaginatedUsers)
def list_users(
    q: str | None = Query(None, description="Tìm theo email / họ tên"),
    role: str | None = Query(None, pattern=r"^(user|admin)$"),
    is_active: bool | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    query = db.query(User)
    if q:
        kw = f"%{q.strip()}%"
        query = query.filter(or_(User.email.ilike(kw), User.full_name.ilike(kw)))
    if role:
        query = query.filter(User.role == role)
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    total = query.count()
    items = query.order_by(User.id).offset(offset).limit(limit).all()
    return schemas.PaginatedUsers(total=total, limit=limit, offset=offset, items=[_user_out(u) for u in items])


@router.post("/users", response_model=schemas.AdminUserOut, status_code=status.HTTP_201_CREATED)
def create_user(payload: schemas.AdminUserCreate, db: Session = Depends(get_db)):
    email = payload.email.lower()
    _ensure_email_free(db, email)
    user = User(email=email, full_name=payload.full_name.strip(), role=payload.role,
                is_active=payload.is_active, hashed_password=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return _user_out(user, 0)


@router.get("/users/{user_id}", response_model=schemas.AdminUserOut)
def get_user(user_id: int, db: Session = Depends(get_db)):
    return _user_out(_get_user(db, user_id))


@router.patch("/users/{user_id}", response_model=schemas.AdminUserOut)
def update_user(user_id: int, payload: schemas.AdminUserUpdate,
                db: Session = Depends(get_db), me: User = Depends(require_admin)):
    user = _get_user(db, user_id)
    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Không có trường nào để cập nhật")
    if user.id == me.id:
        if data.get("role") == "user":
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Không thể tự hạ quyền admin của chính mình")
        if data.get("is_active") is False:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Không thể tự khoá tài khoản của chính mình")
    if "email" in data:
        data["email"] = data["email"].lower()
        if data["email"] != user.email:
            _ensure_email_free(db, data["email"], exclude_id=user.id)
    if "full_name" in data:
        data["full_name"] = data["full_name"].strip()
    if "password" in data:
        user.hashed_password = hash_password(data.pop("password"))
    for k, v in data.items():
        setattr(user, k, v)
    db.commit()
    db.refresh(user)
    return _user_out(user)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, db: Session = Depends(get_db), me: User = Depends(require_admin)):
    user = _get_user(db, user_id)
    if user.id == me.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Không thể xoá tài khoản của chính mình")
    db.delete(user)  # cascade xoá enrollments
    db.commit()


# ---------- enrollments ----------
@router.get("/enrollments", response_model=schemas.PaginatedEnrollments)
def list_enrollments(
    user_id: int | None = None,
    course_id: int | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    query = db.query(Enrollment)
    if user_id is not None:
        query = query.filter(Enrollment.user_id == user_id)
    if course_id is not None:
        query = query.filter(Enrollment.course_id == course_id)
    total = query.count()
    items = query.order_by(Enrollment.id.desc()).offset(offset).limit(limit).all()
    return schemas.PaginatedEnrollments(total=total, limit=limit, offset=offset, items=[_enrollment_out(e) for e in items])


@router.post("/enrollments", response_model=schemas.AdminEnrollmentOut, status_code=status.HTTP_201_CREATED)
def create_enrollment(payload: schemas.AdminEnrollmentCreate, db: Session = Depends(get_db)):
    """Admin cấp quyền truy cập khóa học cho người dùng (kể cả khóa trả phí — ví dụ sau khi nhận chuyển khoản)."""
    user = _get_user(db, payload.user_id)
    course = _get_course(db, payload.course_id)
    if db.query(Enrollment).filter_by(user_id=user.id, course_id=course.id).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "Người dùng đã ghi danh khóa học này")
    e = Enrollment(user_id=user.id, course_id=course.id)
    course.sold += 1
    db.add(e)
    db.commit()
    db.refresh(e)
    return _enrollment_out(e)


@router.delete("/enrollments/{enrollment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_enrollment(enrollment_id: int, db: Session = Depends(get_db)):
    e = db.get(Enrollment, enrollment_id)
    if not e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy ghi danh")
    if e.course.sold > 0:
        e.course.sold -= 1
    db.delete(e)
    db.commit()
