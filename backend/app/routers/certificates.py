"""Chứng nhận hoàn thành khóa học. Cấp khi tiến độ 100% (idempotent). Mã công khai: ai cũng xác thực được."""
import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import schemas
from ..config import settings
from ..database import get_db
from ..models import Certificate, Course, User
from ..ratelimit import rate_limit
from ..security import get_current_user, require_verified
from .courses import _progress, _require_enrolled

router = APIRouter(tags=["certificates"])
_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def _code(db: Session) -> str:
    while True:
        code = "LH-CERT-" + "".join(secrets.choice(_ALPHABET) for _ in range(8))
        if not db.query(Certificate.id).filter_by(code=code).first():
            return code


def _out(c: Certificate) -> schemas.CertificateOut:
    return schemas.CertificateOut(code=c.code, holder_name=c.holder_name, course_title=c.course_title, course_slug=c.course.slug,
                                  lessons=c.lessons, issued_at=c.issued_at, valid=c.user.is_active,
                                  verify_url=f"{settings.frontend_url.rstrip('/')}/certificate?code={c.code}")


@router.post("/api/courses/{slug}/certificate", response_model=schemas.CertificateOut, dependencies=[rate_limit("cert", 20, 3600)])
def issue_certificate(slug: str, db: Session = Depends(get_db), user: User = Depends(require_verified)):
    """Cấp (hoặc trả lại) chứng nhận. Cần đã ghi danh và hoàn thành 100% bài học."""
    course = _require_enrolled(db, user, slug)
    existing = db.query(Certificate).filter_by(user_id=user.id, course_id=course.id).first()
    if existing:
        return _out(existing)
    p = _progress(db, user, course)
    if p.total == 0 or p.percent < 100:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Bạn cần hoàn thành tất cả bài học ({len(p.completed)}/{p.total}) để nhận chứng nhận")
    c = Certificate(code=_code(db), user_id=user.id, course_id=course.id, holder_name=user.full_name, course_title=course.title, lessons=p.total)
    db.add(c)
    db.commit()
    db.refresh(c)
    return _out(c)


@router.get("/api/certificates/me", response_model=list[schemas.CertificateOut])
def my_certificates(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return [_out(c) for c in db.query(Certificate).filter_by(user_id=user.id).order_by(Certificate.issued_at.desc()).all()]


@router.get("/api/certificates/{code}", response_model=schemas.CertificateOut, dependencies=[rate_limit("cert-verify", 60, 600)])
def verify_certificate(code: str, db: Session = Depends(get_db)):
    """Xác thực công khai theo mã. Không cần đăng nhập; chỉ lộ tên người nhận, khóa học, ngày cấp."""
    c = db.query(Certificate).filter_by(code=code.strip().upper()).first()
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mã chứng nhận không tồn tại")
    return _out(c)
