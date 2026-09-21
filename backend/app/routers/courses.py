from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import String, Text, cast, or_
from sqlalchemy.orm import Session

from .. import schemas, storage
from ..database import get_db
from ..models import Course, Enrollment, LessonProgress, QuizAttempt, User
from ..security import get_current_user, get_current_user_optional, require_verified

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
        # tags lưu JSON. Postgres: json không so sánh/cast trực tiếp được → ép sang text; SQLite: cast String.
        from ..config import settings
        tags_text = cast(Course.tags, String) if settings.is_sqlite else Course.tags.cast(Text)
        query = query.filter(tags_text.like(f'%"{category}"%'))
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


@router.get("/export", response_model=list[schemas.CoursePublic])
def export_courses(db: Session = Depends(get_db)):
    """Toàn bộ khóa học ở dạng công khai, không phân trang. Frontend gọi lúc build tĩnh (CI) và khi cần đồng bộ danh sách.
    Video bài không free bị ẩn (chỉ còn has_video) — dữ liệu này nằm trong bundle công khai."""
    return [_course_public(c) for c in db.query(Course).order_by(Course.id).all()]


def _mark_lesson_flags(out_lessons: list[schemas.LessonOut], raw_lessons: list[dict]) -> None:
    """Điền has_video / has_quiz / quiz_count từ dữ liệu gốc (LessonOut không chứa quiz nên không lộ đáp án)."""
    for lesson, raw in zip(out_lessons, raw_lessons or []):
        lesson.has_video = bool(lesson.video)
        quiz = raw.get("quiz") or {}
        lesson.quiz_count = len(quiz.get("questions") or [])
        lesson.has_quiz = lesson.quiz_count > 0
        lesson.attachments = [schemas.AttachmentOut(name=a.get("name", "Tài liệu"), kind=a.get("kind", "file"),
                                                    size=a.get("size", 0), content_type=a.get("content_type", ""))
                              for a in (raw.get("attachments") or [])]


def _course_public(course: Course) -> schemas.CoursePublic:
    out = schemas.CoursePublic.model_validate(course)
    _mark_lesson_flags(out.lessons, course.lessons)
    for lesson in out.lessons:
        if not lesson.free:
            lesson.video = None
    return out


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
    _mark_lesson_flags(out.lessons, course.lessons)
    for lesson in out.lessons:
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
        if not user.email_verified:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Bạn cần xác thực email trước khi xem bài này")
        if not _is_enrolled(db, user, course):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Bạn chưa ghi danh khóa học này")
    return schemas.LessonVideo(index=index, title=lesson["title"], video=lesson.get("video"))


# ---------- tài liệu đính kèm ----------
@router.get("/{slug}/lessons/{index}/attachments/{pos}/download", response_model=schemas.AttachmentLink)
def attachment_link(slug: str, index: int, pos: int, db: Session = Depends(get_db), user: User | None = Depends(get_current_user_optional)):
    """Link tải tài liệu. Cùng luật với video: bài free công khai; bài khác cần đăng nhập, xác thực, đã ghi danh.
    File S3 → URL ký có hạn (không tái sử dụng được lâu); link ngoài → trả thẳng URL."""
    _, lesson = _lesson_for_access(slug, index, db, user)
    atts = lesson.get("attachments") or []
    if pos < 0 or pos >= len(atts):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy tài liệu")
    a = atts[pos]
    if a.get("kind") == "link":
        return schemas.AttachmentLink(name=a["name"], url=a["url"], expires_in=None)
    from ..config import settings
    return schemas.AttachmentLink(name=a["name"], url=storage.presigned_get(a["key"], a["name"]), expires_in=settings.s3_link_expire_seconds)


# ---------- trắc nghiệm ----------
def _lesson_for_access(slug: str, index: int, db: Session, user: User | None) -> tuple[Course, dict]:
    """Cùng luật với video: bài free → ai cũng vào; bài khác → 401 chưa đăng nhập, 403 chưa xác thực / chưa ghi danh."""
    course = db.query(Course).filter(Course.slug == slug).first()
    if not course:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy khóa học")
    if index < 0 or index >= len(course.lessons or []):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy bài học")
    lesson = course.lessons[index]
    if not lesson.get("free"):
        if user is None:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Bạn cần đăng nhập để làm bài này", headers={"WWW-Authenticate": "Bearer"})
        if not user.email_verified:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Bạn cần xác thực email trước khi làm bài")
        if not _is_enrolled(db, user, course):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Bạn chưa ghi danh khóa học này")
    return course, lesson


def _quiz_of(lesson: dict) -> schemas.Quiz:
    quiz = lesson.get("quiz")
    if not quiz or not quiz.get("questions"):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bài học này không có trắc nghiệm")
    return schemas.Quiz.model_validate(quiz)


@router.get("/{slug}/lessons/{index}/quiz", response_model=schemas.QuizPublic)
def get_quiz(slug: str, index: int, db: Session = Depends(get_db), user: User | None = Depends(get_current_user_optional)):
    """Đề trắc nghiệm KHÔNG kèm đáp án. Đáp án và giải thích chỉ trả về sau khi nộp."""
    _, lesson = _lesson_for_access(slug, index, db, user)
    quiz = _quiz_of(lesson)
    return schemas.QuizPublic(index=index, title=lesson["title"], pass_percent=quiz.pass_percent, total=len(quiz.questions),
                              questions=[schemas.QuizQuestionPublic(q=q.q, options=q.options) for q in quiz.questions])


@router.post("/{slug}/lessons/{index}/quiz/submit", response_model=schemas.QuizResult)
def submit_quiz(slug: str, index: int, payload: schemas.QuizSubmitIn, db: Session = Depends(get_db),
                user: User | None = Depends(get_current_user_optional)):
    """Chấm điểm. Đăng nhập → lưu lần làm; đạt và đã ghi danh → đánh dấu bài hoàn thành."""
    course, lesson = _lesson_for_access(slug, index, db, user)
    quiz = _quiz_of(lesson)
    if len(payload.answers) != len(quiz.questions):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Cần đúng {len(quiz.questions)} câu trả lời")
    results = []
    for i, (q, chosen) in enumerate(zip(quiz.questions, payload.answers)):
        if chosen is not None and not (0 <= chosen < len(q.options)):
            chosen = None
        results.append(schemas.QuizAnswerResult(index=i, chosen=chosen, answer=q.answer, correct=chosen == q.answer, explain=q.explain))
    score = sum(r.correct for r in results)
    total = len(results)
    percent = round(score * 100 / total)
    passed = percent >= quiz.pass_percent
    out = schemas.QuizResult(score=score, total=total, percent=percent, pass_percent=quiz.pass_percent, passed=passed, results=results)
    if user is not None:
        db.add(QuizAttempt(user_id=user.id, course_id=course.id, lesson_index=index, score=score, total=total, percent=percent, passed=passed))
        out.saved = True
        if passed and user.email_verified and _is_enrolled(db, user, course):
            if not db.query(LessonProgress).filter_by(user_id=user.id, course_id=course.id, lesson_index=index).first():
                db.add(LessonProgress(user_id=user.id, course_id=course.id, lesson_index=index))
            out.lesson_completed = True
        db.commit()
    return out


@router.get("/{slug}/lessons/{index}/quiz/attempts", response_model=schemas.QuizAttempts)
def quiz_attempts(slug: str, index: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Lịch sử làm bài của tôi: số lần, lần tốt nhất, lần gần nhất."""
    course, _ = _lesson_for_access(slug, index, db, user)
    rows = db.query(QuizAttempt).filter_by(user_id=user.id, course_id=course.id, lesson_index=index).order_by(QuizAttempt.id).all()
    return schemas.QuizAttempts(count=len(rows), best=max(rows, key=lambda r: (r.percent, r.id)) if rows else None,
                                last=rows[-1] if rows else None)


@router.post("/{slug}/enroll", response_model=schemas.CourseDetail, status_code=status.HTTP_201_CREATED)
def enroll(slug: str, db: Session = Depends(get_db), user: User = Depends(require_verified)):
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


def _progress(db: Session, user: User, course: Course) -> schemas.Progress:
    total = len(course.lessons or [])
    done = sorted(
        r.lesson_index for r in db.query(LessonProgress).filter_by(user_id=user.id, course_id=course.id).all()
        if r.lesson_index < total
    )
    next_index = next((i for i in range(total) if i not in done), None)
    return schemas.Progress(completed=done, total=total, percent=round(len(done) * 100 / total) if total else 0, next_index=next_index)


def _require_enrolled(db: Session, user: User, slug: str) -> Course:
    course = db.query(Course).filter(Course.slug == slug).first()
    if not course:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy khóa học")
    if not _is_enrolled(db, user, course):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Bạn chưa ghi danh khóa học này")
    return course


@router.get("/me/enrolled", response_model=list[schemas.EnrolledCourseOut])
def my_courses(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    out = []
    for e in user.enrollments:
        out.append(schemas.EnrolledCourseOut(**schemas.CourseOut.model_validate(e.course).model_dump(),
                                             progress=_progress(db, user, e.course)))
    return out


@router.get("/{slug}/progress", response_model=schemas.Progress)
def get_progress(slug: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _progress(db, user, _require_enrolled(db, user, slug))


@router.put("/{slug}/lessons/{index}/complete", response_model=schemas.Progress)
def complete_lesson(slug: str, index: int, db: Session = Depends(get_db), user: User = Depends(require_verified)):
    """Đánh dấu bài đã hoàn thành (idempotent)."""
    course = _require_enrolled(db, user, slug)
    if index < 0 or index >= len(course.lessons or []):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy bài học")
    if not db.query(LessonProgress).filter_by(user_id=user.id, course_id=course.id, lesson_index=index).first():
        db.add(LessonProgress(user_id=user.id, course_id=course.id, lesson_index=index))
        db.commit()
    return _progress(db, user, course)


@router.delete("/{slug}/lessons/{index}/complete", response_model=schemas.Progress)
def uncomplete_lesson(slug: str, index: int, db: Session = Depends(get_db), user: User = Depends(require_verified)):
    """Bỏ đánh dấu hoàn thành."""
    course = _require_enrolled(db, user, slug)
    row = db.query(LessonProgress).filter_by(user_id=user.id, course_id=course.id, lesson_index=index).first()
    if row:
        db.delete(row)
        db.commit()
    return _progress(db, user, course)
