"""Đánh giá khóa học (phía người học). Chỉ người đã ghi danh mới đánh giá; một người một đánh giá, sửa được.
Điểm trung bình chỉ hiển thị khi có đủ MIN_REVIEWS đánh giá để một người không kéo lệch."""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import schemas
from ..database import get_db
from ..models import Course, Enrollment, Review, User
from ..ratelimit import rate_limit
from ..security import get_current_user_optional, require_verified

router = APIRouter(prefix="/api/courses", tags=["reviews"])

MIN_REVIEWS = 3


def rating_summaries(db: Session, course_ids: list[int] | None = None) -> dict[int, schemas.RatingSummary]:
    """course_id → tóm tắt (chỉ đánh giá không bị ẩn). Một query cho nhiều khóa."""
    q = db.query(Review.course_id, Review.rating, func.count(Review.id)).filter(Review.hidden.is_(False))
    if course_ids is not None:
        q = q.filter(Review.course_id.in_(course_ids))
    out: dict[int, schemas.RatingSummary] = {}
    for cid, rating, n in q.group_by(Review.course_id, Review.rating).all():
        s = out.setdefault(cid, schemas.RatingSummary())
        s.distribution[rating] = s.distribution.get(rating, 0) + n
        s.count += n
    for s in out.values():
        total = sum(r * n for r, n in s.distribution.items())
        s.average = round(total / s.count, 1) if s.count >= MIN_REVIEWS else None
    return out


def _course(db: Session, slug: str) -> Course:
    course = db.query(Course).filter(Course.slug == slug).first()
    if not course:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy khóa học")
    return course


def _out(r: Review, viewer: User | None) -> schemas.ReviewOut:
    name = r.user.full_name if r.user.is_active else "Người dùng đã xoá"
    return schemas.ReviewOut(id=r.id, rating=r.rating, comment=r.comment, created_at=r.created_at, updated_at=r.updated_at,
                             user_name=name, user_initial=(name.strip()[:1] or "?").upper(), mine=bool(viewer and r.user_id == viewer.id))


@router.get("/{slug}/reviews", response_model=schemas.ReviewList)
def list_reviews(slug: str, limit: int = Query(10, ge=1, le=50), offset: int = Query(0, ge=0),
                 db: Session = Depends(get_db), user: User | None = Depends(get_current_user_optional)):
    course = _course(db, slug)
    q = db.query(Review).filter(Review.course_id == course.id, Review.hidden.is_(False))
    total = q.count()
    # có nhận xét lên trước, rồi mới nhất
    items = q.order_by((Review.comment != "").desc(), Review.updated_at.desc()).offset(offset).limit(limit).all()
    mine = db.query(Review).filter_by(course_id=course.id, user_id=user.id).first() if user else None
    can = bool(user and user.email_verified and db.query(Enrollment).filter_by(user_id=user.id, course_id=course.id).first())
    return schemas.ReviewList(summary=rating_summaries(db, [course.id]).get(course.id, schemas.RatingSummary()), total=total,
                              items=[_out(r, user) for r in items], mine=_out(mine, user) if mine else None, can_review=can)


@router.put("/{slug}/reviews/me", response_model=schemas.ReviewOut, dependencies=[rate_limit("review", 20, 3600)])
def upsert_review(slug: str, payload: schemas.ReviewIn, db: Session = Depends(get_db), user: User = Depends(require_verified)):
    """Tạo hoặc sửa đánh giá của tôi. Cần đã ghi danh. Sửa đánh giá đang bị ẩn → vẫn bị ẩn cho tới khi admin gỡ."""
    course = _course(db, slug)
    if not db.query(Enrollment).filter_by(user_id=user.id, course_id=course.id).first():
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Bạn cần ghi danh khóa học trước khi đánh giá")
    r = db.query(Review).filter_by(user_id=user.id, course_id=course.id).first()
    if r:
        r.rating, r.comment, r.updated_at = payload.rating, payload.comment, datetime.utcnow()
    else:
        r = Review(user_id=user.id, course_id=course.id, rating=payload.rating, comment=payload.comment)
        db.add(r)
    db.commit()
    db.refresh(r)
    return _out(r, user)


@router.delete("/{slug}/reviews/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_my_review(slug: str, db: Session = Depends(get_db), user: User = Depends(require_verified)):
    course = _course(db, slug)
    r = db.query(Review).filter_by(user_id=user.id, course_id=course.id).first()
    if not r:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bạn chưa đánh giá khóa học này")
    db.delete(r)
    db.commit()
