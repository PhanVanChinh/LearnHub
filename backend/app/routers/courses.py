from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import String, or_
from sqlalchemy.orm import Session

from .. import schemas
from ..database import get_db
from ..models import Course, Enrollment, User
from ..security import get_current_user, get_current_user_optional

router = APIRouter(prefix="/api/courses", tags=["courses"])

CATEGORY_LABELS = {
    "all": "Tất cả", "ai-check": "AI Check", "pdf": "PDF", "quiz": "Trắc nghiệm",
    "free": "Miễn phí", "source": "Source code", "video": "Video",
}


@router.get("", response_model=list[schemas.CourseOut])
def list_courses(
    category: str | None = Query(None, description="all | ai-check | pdf | quiz | free | source | video"),
    q: str | None = Query(None, description="Từ khoá tìm trong tiêu đề / mô tả ngắn"),
    featured: bool | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    query = db.query(Course)
    if category and category != "all":
        # tags lưu JSON; SQLite/Postgres đều hỗ trợ LIKE trên chuỗi JSON cho nhu cầu đơn giản này
        query = query.filter(Course.tags.cast(String).like(f'%"{category}"%'))
    if q:
        kw = f"%{q.strip()}%"
        query = query.filter(or_(Course.title.ilike(kw), Course.short.ilike(kw)))
    if featured is not None:
        query = query.filter(Course.featured == featured)
    return query.order_by(Course.id).offset(offset).limit(limit).all()


@router.get("/categories", response_model=list[schemas.CategoryCount])
def categories(db: Session = Depends(get_db)):
    courses = db.query(Course.tags).all()
    counts = {k: 0 for k in CATEGORY_LABELS}
    counts["all"] = len(courses)
    for (tags,) in courses:
        for t in tags or []:
            if t in counts:
                counts[t] += 1
    return [schemas.CategoryCount(key=k, label=v, count=counts[k]) for k, v in CATEGORY_LABELS.items()]


@router.get("/{slug}", response_model=schemas.CourseDetail)
def get_course(slug: str, db: Session = Depends(get_db), user: User | None = Depends(get_current_user_optional)):
    course = db.query(Course).filter(Course.slug == slug).first()
    if not course:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy khóa học")
    course.views += 1
    db.commit()
    return _course_detail(course, db, user)


def _is_enrolled(db: Session, user: User | None, course: Course) -> bool:
    return bool(user) and db.query(Enrollment).filter_by(user_id=user.id, course_id=course.id).first() is not None


def _course_detail(course: Course, db: Session, user: User | None) -> schemas.CourseDetail:
    """Ẩn video ID của bài không free với người chưa ghi danh (chỉ để lại cờ has_video)."""
    out = schemas.CourseDetail.model_validate(course)
    out.enrolled = _is_enrolled(db, user, course)
    for lesson in out.lessons:
        lesson.has_video = bool(lesson.video)
        if not lesson.free and not out.enrolled:
            lesson.video = None
    return out


@router.get("/{slug}/lessons/{index}/video", response_model=schemas.LessonVideo)
def lesson_video(slug: str, index: int, db: Session = Depends(get_db), user: User | None = Depends(get_current_user_optional)):
    """Trả YouTube ID của một bài học. Bài free: ai cũng lấy được. Bài khác: cần đăng nhập (401) và đã ghi danh (403)."""
    course = db.query(Course).filter(Course.slug == slug).first()
    if not course:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy khóa học")
    if index < 0 or index >= len(course.lessons or []):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy bài học")
    lesson = course.lessons[index]
    if not lesson.get("free"):
        if user is None:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Bạn cần đăng nhập để xem bài này", headers={"WWW-Authenticate": "Bearer"})
        if not _is_enrolled(db, user, course):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Bạn chưa ghi danh khóa học này")
    return schemas.LessonVideo(index=index, title=lesson["title"], video=lesson.get("video"))


@router.post("/{slug}/enroll", response_model=schemas.CourseDetail, status_code=status.HTTP_201_CREATED)
def enroll(slug: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Ghi danh khóa học miễn phí. Khóa học trả phí sẽ đi qua luồng đơn hàng (chưa làm)."""
    course = db.query(Course).filter(Course.slug == slug).first()
    if not course:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy khóa học")
    if course.price > 0:
        raise HTTPException(status.HTTP_402_PAYMENT_REQUIRED, "Khóa học trả phí — cần thanh toán trước")
    if not db.query(Enrollment).filter_by(user_id=user.id, course_id=course.id).first():
        db.add(Enrollment(user_id=user.id, course_id=course.id))
        course.sold += 1
        db.commit()
    return _course_detail(course, db, user)


@router.get("/me/enrolled", response_model=list[schemas.CourseOut], include_in_schema=True)
def my_courses(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return [e.course for e in user.enrollments]
