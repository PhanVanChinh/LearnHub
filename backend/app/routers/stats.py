"""Số liệu công khai, tính trực tiếp từ DB — thay cho các con số cố định trên trang chủ / thẻ khóa học."""
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import schemas
from ..database import get_db
from ..models import Course, Enrollment
from .reviews import rating_summaries

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("", response_model=schemas.PublicStats)
def public_stats(db: Session = Depends(get_db)):
    courses = db.query(Course).filter(Course.hidden.is_(False)).all()
    lessons = sum(len(c.lessons or []) for c in courses)
    videos = sum(1 for c in courses for l in (c.lessons or []) if l.get("video"))
    return schemas.PublicStats(
        courses=len(courses), lessons=lessons, videos=videos,
        students=db.query(func.count(func.distinct(Enrollment.user_id))).scalar() or 0,
        enrollments=db.query(func.count(Enrollment.id)).scalar() or 0,
        views=sum(c.views for c in courses),
    )


@router.get("/courses", response_model=list[schemas.CourseStats])
def course_stats(db: Session = Depends(get_db)):
    """Một dòng mỗi khóa: lượt xem và số học viên (số ghi danh). Frontend gọi một lần cho cả danh sách thẻ."""
    counts = dict(db.query(Enrollment.course_id, func.count(Enrollment.id)).group_by(Enrollment.course_id).all())
    ratings = rating_summaries(db)
    return [schemas.CourseStats(slug=c.slug, views=c.views, students=counts.get(c.id, 0), rating=ratings.get(c.id, schemas.RatingSummary()))
            for c in db.query(Course.id, Course.slug, Course.views).filter(Course.hidden.is_(False)).all()]
