"""CRUD dành cho admin: khóa học, người dùng, ghi danh, thống kê.

Mọi endpoint yêu cầu Bearer token của tài khoản có role = "admin" (xem security.require_admin).
"""
import logging
from datetime import datetime

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from sqlalchemy import String, func, or_
from sqlalchemy.orm import Session

from .. import audit, schemas, storage
from ..config import settings
from ..database import get_db
from ..models import AuditLog, ContactMessage, Course, Enrollment, Order, User
from ..ratelimit import rate_limit
from ..security import hash_password, require_admin
from .orders import CANCELLED, EXPIRED, PAID, PENDING, expire_stale, notify_paid, order_out

log = logging.getLogger("learnhub.admin")

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


# ---------- xuất bản (rebuild frontend tĩnh) ----------
PUBLISH_EVENT = "publish-courses"


def _publish_status() -> schemas.PublishStatus:
    repo = settings.github_repo.strip()
    return schemas.PublishStatus(
        configured=bool(settings.github_token and repo and "/" in repo), repo=repo,
        actions_url=f"https://github.com/{repo}/actions/workflows/{settings.github_workflow_file}",
        site_url=settings.frontend_url,
    )


@router.get("/publish", response_model=schemas.PublishStatus)
def publish_status():
    """Frontend đọc để biết nút Xuất bản có dùng được không."""
    return _publish_status()


@router.post("/publish", response_model=schemas.PublishResult, dependencies=[rate_limit("publish", 3, 600)])
def publish(request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    """Website công khai được build tĩnh từ DB. Sau khi sửa khóa học, bấm Xuất bản để GitHub Actions build lại
    (repository_dispatch). Người dùng đã mở trang vẫn thấy bản mới qua API; nút này để bản tĩnh (SEO, khóa mới) đuổi kịp."""
    st = _publish_status()
    if not st.configured:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Chưa cấu hình GITHUB_TOKEN / GITHUB_REPO trên backend")
    try:
        r = httpx.post(
            f"https://api.github.com/repos/{st.repo}/dispatches",
            headers={"Authorization": f"Bearer {settings.github_token}", "Accept": "application/vnd.github+json",
                     "X-GitHub-Api-Version": "2022-11-28"},
            json={"event_type": PUBLISH_EVENT, "client_payload": {"source": "learnhub-admin"}},
            timeout=10,
        )
    except httpx.HTTPError as e:
        log.error("GitHub dispatch lỗi mạng: %s", e)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Không kết nối được GitHub, thử lại sau")
    if r.status_code != 204:
        log.error("GitHub dispatch %s: %s", r.status_code, r.text[:300])
        msg = {401: "GitHub token không hợp lệ hoặc hết hạn", 403: "Token thiếu quyền Contents: write trên repo",
               404: "Không tìm thấy repo (kiểm tra GITHUB_REPO và quyền token)"}.get(r.status_code, f"GitHub trả {r.status_code}")
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, msg)
    audit.record(db, request, admin, "site.publish", "site", summary=f"Kích hoạt build lại site ({st.repo})")
    return schemas.PublishResult(**st.model_dump(), detail="Đã kích hoạt build. Site tĩnh cập nhật sau khoảng 2 phút.")


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
    revenue = db.query(func.coalesce(func.sum(Order.amount), 0)).filter(Order.status == PAID).scalar() or 0
    paid_orders = db.query(func.count(Order.id)).filter(Order.status == PAID).scalar() or 0
    expire_stale(db, db.query(Order).filter(Order.status == PENDING).all())
    pending_orders = db.query(func.count(Order.id)).filter(Order.status == PENDING).scalar() or 0
    new_contacts = db.query(func.count(ContactMessage.id)).filter(ContactMessage.status == "new").scalar() or 0
    return schemas.AdminStats(
        users=users, admins=admins, courses=courses, free_courses=free_courses,
        paid_courses=courses - free_courses, enrollments=enrollments,
        total_views=total_views, total_sold=total_sold, revenue=revenue,
        paid_orders=paid_orders, pending_orders=pending_orders, new_contacts=new_contacts,
    )


# ---------- uploads (tài liệu bài học) ----------
@router.get("/uploads/status")
def uploads_status():
    return {"enabled": storage.enabled(), "max_mb": settings.upload_max_mb, "allowed": sorted(set(storage.ALLOWED_TYPES.values()))}


@router.post("/uploads", response_model=schemas.UploadOut, status_code=status.HTTP_201_CREATED)
async def upload_file(request: Request, file: UploadFile = File(...), course_slug: str = Form(...),
                      db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    """Tải file lên S3, trả `key` để admin gắn vào lesson.attachments khi lưu khóa học."""
    if not storage.enabled():
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Chưa cấu hình lưu trữ file (S3_*). Hiện chỉ đính kèm được link ngoài")
    ctype = (file.content_type or "").split(";")[0].strip().lower()
    if ctype not in storage.ALLOWED_TYPES:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, f"Không hỗ trợ loại file {ctype or 'không rõ'}. Cho phép: PDF, Word, PowerPoint, Excel, ZIP, TXT, ảnh")
    data = await file.read()
    if len(data) > settings.upload_max_mb * 1024 * 1024:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, f"File tối đa {settings.upload_max_mb} MB")
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "File rỗng")
    name = (file.filename or "tai-lieu").strip()[:200]
    key = storage.make_key(course_slug, name)
    storage.put(key, data, ctype)
    audit.record(db, request, admin, "upload.create", "upload", key, f"Tải lên «{name}» ({len(data) // 1024} KB) cho /{course_slug}")
    return schemas.UploadOut(key=key, name=name, size=len(data), content_type=ctype)


@router.delete("/uploads", status_code=status.HTTP_204_NO_CONTENT)
def delete_upload(key: str, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    """Xoá file trên S3 (chỉ key trong thư mục courses/). Không tự gỡ khỏi lesson.attachments — admin lưu lại khóa học."""
    if not key.startswith("courses/") or ".." in key:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Key không hợp lệ")
    storage.delete(key)
    audit.record(db, request, admin, "upload.delete", "upload", key, f"Xoá file {key}")


# ---------- contact ----------
@router.get("/contacts", response_model=schemas.PaginatedContacts)
def list_contacts(
    status_: str | None = Query(None, alias="status", description="new | replied"),
    q: str | None = Query(None, description="Tìm theo tên, email, chủ đề, nội dung"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    query = db.query(ContactMessage)
    if status_:
        query = query.filter(ContactMessage.status == status_)
    if q:
        kw = f"%{q.strip()}%"
        query = query.filter(or_(ContactMessage.name.ilike(kw), ContactMessage.email.ilike(kw),
                                 ContactMessage.subject.ilike(kw), ContactMessage.message.ilike(kw)))
    total = query.count()
    items = query.order_by((ContactMessage.status == "new").desc(), ContactMessage.id.desc()).offset(offset).limit(limit).all()
    return schemas.PaginatedContacts(total=total, limit=limit, offset=offset, items=items)


@router.post("/contacts/{msg_id}/replied", response_model=schemas.ContactOut)
def mark_contact_replied(msg_id: int, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    """Admin trả lời qua email xong → đánh dấu. Bấm lại → quay về 'new' (đánh dấu nhầm)."""
    m = db.get(ContactMessage, msg_id)
    if not m:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy tin nhắn")
    if m.status == "new":
        m.status, m.replied_at = "replied", datetime.utcnow()
    else:
        m.status, m.replied_at = "new", None
    db.commit()
    db.refresh(m)
    audit.record(db, request, admin, "contact.replied" if m.status == "replied" else "contact.unreplied", "contact", m.id,
                 f"{'Đánh dấu đã trả lời' if m.status == 'replied' else 'Bỏ đánh dấu trả lời'} tin nhắn của {m.email}")
    return m


@router.delete("/contacts/{msg_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_contact(msg_id: int, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    m = db.get(ContactMessage, msg_id)
    if not m:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy tin nhắn")
    summary = f"Xoá tin nhắn #{m.id} của {m.email}"
    db.delete(m)
    db.commit()
    audit.record(db, request, admin, "contact.delete", "contact", msg_id, summary)


# ---------- orders ----------
def _admin_order_out(o: Order) -> schemas.AdminOrderOut:
    base = order_out(o).model_dump()
    return schemas.AdminOrderOut(**base, user_id=o.user_id, user_email=o.user.email, user_name=o.user.full_name, note=o.note,
                                 confirmed_by_email=o.confirmed_by.email if o.confirmed_by else None)


def _get_order(db: Session, order_id: int) -> Order:
    o = db.get(Order, order_id)
    if not o:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy đơn hàng")
    expire_stale(db, [o])
    return o


@router.get("/orders", response_model=schemas.PaginatedOrders)
def list_orders(
    status_: str | None = Query(None, alias="status", description="pending | paid | cancelled | expired"),
    q: str | None = Query(None, description="Tìm theo mã đơn hoặc email người mua"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    expire_stale(db, db.query(Order).filter(Order.status == PENDING).all())
    query = db.query(Order).join(Order.user)
    if status_:
        query = query.filter(Order.status == status_)
    if q:
        kw = f"%{q.strip()}%"
        query = query.filter(or_(Order.code.ilike(kw), User.email.ilike(kw)))
    total = query.count()
    # đơn chờ lên đầu, rồi mới nhất trước
    items = query.order_by((Order.status == PENDING).desc(), Order.id.desc()).offset(offset).limit(limit).all()
    return schemas.PaginatedOrders(total=total, limit=limit, offset=offset, items=[_admin_order_out(o) for o in items])


@router.post("/orders/{order_id}/confirm", response_model=schemas.AdminOrderOut)
def confirm_order(order_id: int, payload: schemas.OrderAction, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    """Đã nhận tiền → đơn paid + cấp quyền học (tạo Enrollment). Cho phép duyệt cả đơn đã hết hạn (tiền về muộn)."""
    o = _get_order(db, order_id)
    if o.status not in (PENDING, EXPIRED):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Đơn đang ở trạng thái '{o.status}', không duyệt được")
    o.status, o.paid_at, o.confirmed_by_id, o.note = PAID, datetime.utcnow(), admin.id, payload.note or o.note
    if not db.query(Enrollment).filter_by(user_id=o.user_id, course_id=o.course_id).first():
        db.add(Enrollment(user_id=o.user_id, course_id=o.course_id))
        o.course.sold += 1
    db.commit()
    db.refresh(o)
    audit.record(db, request, admin, "order.confirm", "order", o.id, f"Xác nhận đơn {o.code} · {o.user.email} · {o.amount:,}đ".replace(",", "."),
                 {"code": o.code, "amount": o.amount, "course": o.course.slug, "note": payload.note})
    notify_paid(o)
    return _admin_order_out(o)


@router.post("/orders/{order_id}/cancel", response_model=schemas.AdminOrderOut)
def admin_cancel_order(order_id: int, payload: schemas.OrderAction, request: Request, db: Session = Depends(get_db),
                       admin: User = Depends(require_admin)):
    o = _get_order(db, order_id)
    if o.status != PENDING:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Chỉ huỷ được đơn đang chờ thanh toán")
    o.status, o.note = CANCELLED, payload.note or o.note
    db.commit()
    db.refresh(o)
    audit.record(db, request, admin, "order.cancel", "order", o.id, f"Huỷ đơn {o.code} · {o.user.email}", {"code": o.code, "note": payload.note})
    return _admin_order_out(o)


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
def create_course(payload: schemas.CourseCreate, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    _ensure_slug_free(db, payload.slug)
    data = payload.model_dump()
    _normalize_tags(data)
    course = Course(**data)
    db.add(course)
    db.commit()
    db.refresh(course)
    audit.record(db, request, admin, "course.create", "course", course.id, f"Tạo khóa học «{course.title}» (/{course.slug})",
                 {"slug": course.slug, "price": course.price, "lessons": len(course.lessons or [])})
    return _course_out(course, 0)


@router.get("/courses/{course_id}", response_model=schemas.AdminCourseOut)
def get_course(course_id: int, db: Session = Depends(get_db)):
    return _course_out(_get_course(db, course_id))


@router.patch("/courses/{course_id}", response_model=schemas.AdminCourseOut)
@router.put("/courses/{course_id}", response_model=schemas.AdminCourseOut, include_in_schema=False)
def update_course(course_id: int, payload: schemas.CourseUpdate, request: Request, db: Session = Depends(get_db),
                  admin: User = Depends(require_admin)):
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
    changed = {k: {"from": getattr(course, k), "to": v} for k, v in data.items() if k in ("price", "title", "slug", "featured", "category")}
    for k, v in data.items():
        setattr(course, k, v)
    db.commit()
    db.refresh(course)
    audit.record(db, request, admin, "course.update", "course", course.id, f"Sửa khóa học «{course.title}»: {', '.join(data.keys())}",
                 {"fields": sorted(data.keys()), "changed": changed})
    return _course_out(course)


@router.delete("/courses/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_course(course_id: int, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    course = _get_course(db, course_id)
    summary = f"Xoá khóa học «{course.title}» (/{course.slug}), {len(course.enrollments)} ghi danh"
    db.delete(course)  # cascade xoá enrollments
    db.commit()
    audit.record(db, request, admin, "course.delete", "course", course_id, summary)


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
def create_user(payload: schemas.AdminUserCreate, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    email = payload.email.lower()
    _ensure_email_free(db, email)
    user = User(email=email, full_name=payload.full_name.strip(), role=payload.role,
                is_active=payload.is_active, hashed_password=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    audit.record(db, request, admin, "user.create", "user", user.id, f"Tạo người dùng {user.email} (role {user.role})")
    return _user_out(user, 0)


@router.get("/users/{user_id}", response_model=schemas.AdminUserOut)
def get_user(user_id: int, db: Session = Depends(get_db)):
    return _user_out(_get_user(db, user_id))


@router.patch("/users/{user_id}", response_model=schemas.AdminUserOut)
def update_user(user_id: int, payload: schemas.AdminUserUpdate, request: Request,
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
    fields = sorted(data.keys())  # ghi tên trường, không ghi giá trị mật khẩu
    if "password" in data:
        user.hashed_password = hash_password(data.pop("password"))
    changed = {k: {"from": getattr(user, k), "to": v} for k, v in data.items() if k in ("role", "is_active", "email")}
    for k, v in data.items():
        setattr(user, k, v)
    db.commit()
    db.refresh(user)
    audit.record(db, request, me, "user.update", "user", user.id, f"Sửa người dùng {user.email}: {', '.join(fields)}", {"fields": fields, "changed": changed})
    return _user_out(user)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, request: Request, db: Session = Depends(get_db), me: User = Depends(require_admin)):
    user = _get_user(db, user_id)
    if user.id == me.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Không thể xoá tài khoản của chính mình")
    summary = f"Xoá người dùng {user.email} ({len(user.enrollments)} ghi danh, {len(user.orders)} đơn)"
    db.delete(user)  # cascade xoá enrollments
    db.commit()
    audit.record(db, request, me, "user.delete", "user", user_id, summary)


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
def create_enrollment(payload: schemas.AdminEnrollmentCreate, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
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
    audit.record(db, request, admin, "enrollment.create", "enrollment", e.id, f"Cấp quyền «{course.title}» cho {user.email}",
                 {"user": user.email, "course": course.slug})
    return _enrollment_out(e)


@router.delete("/enrollments/{enrollment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_enrollment(enrollment_id: int, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    e = db.get(Enrollment, enrollment_id)
    if not e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy ghi danh")
    summary = f"Thu hồi quyền «{e.course.title}» của {e.user.email}"
    if e.course.sold > 0:
        e.course.sold -= 1
    db.delete(e)
    db.commit()
    audit.record(db, request, admin, "enrollment.delete", "enrollment", enrollment_id, summary)


# ---------- audit log ----------
@router.get("/audit", response_model=schemas.PaginatedAudit)
def list_audit(
    action: str | None = Query(None, description="Lọc theo action hoặc tiền tố, vd 'order' hoặc 'order.confirm'"),
    actor: str | None = Query(None, description="Email admin thực hiện"),
    q: str | None = Query(None, description="Tìm trong tóm tắt"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    query = db.query(AuditLog)
    if action:
        query = query.filter(AuditLog.action.like(f"{action.strip()}%"))
    if actor:
        query = query.filter(AuditLog.actor_email.ilike(f"%{actor.strip()}%"))
    if q:
        query = query.filter(AuditLog.summary.ilike(f"%{q.strip()}%"))
    total = query.count()
    items = query.order_by(AuditLog.id.desc()).offset(offset).limit(limit).all()
    return schemas.PaginatedAudit(total=total, limit=limit, offset=offset, items=items)
