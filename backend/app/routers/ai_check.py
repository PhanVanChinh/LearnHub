"""AI Check: yêu cầu đăng nhập + xác thực email, giới hạn lượt mỗi ngày theo tài khoản, lưu lịch sử điểm."""
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import ai_check, schemas
from ..config import settings
from ..database import get_db
from ..models import AiCheckRun, User
from ..ratelimit import rate_limit
from ..security import get_current_user_optional, require_verified

router = APIRouter(prefix="/api/ai-check", tags=["ai-check"])


def _used_today(db: Session, user: User) -> int:
    since = datetime.utcnow() - timedelta(hours=24)
    return db.query(func.count(AiCheckRun.id)).filter(AiCheckRun.user_id == user.id, AiCheckRun.created_at >= since).scalar() or 0


def _status(db: Session, user: User | None) -> schemas.AiCheckStatus:
    used = _used_today(db, user) if user else 0
    return schemas.AiCheckStatus(enabled=ai_check.enabled(), daily_limit=settings.ai_check_daily_limit, used_today=used,
                                 remaining=max(0, settings.ai_check_daily_limit - used), max_chars=settings.ai_check_max_chars,
                                 min_words=settings.ai_check_min_words, model=settings.ai_check_model if ai_check.enabled() else "")


@router.get("/status", response_model=schemas.AiCheckStatus)
def ai_check_status(db: Session = Depends(get_db), user: User | None = Depends(get_current_user_optional)):
    """Frontend đọc để biết có dùng được không và còn bao nhiêu lượt (lượt tính theo 24 giờ gần nhất)."""
    return _status(db, user)


@router.post("", response_model=schemas.AiCheckOut, dependencies=[rate_limit("ai-check", 10, 3600)])
def run_ai_check(payload: schemas.AiCheckIn, db: Session = Depends(get_db), user: User = Depends(require_verified)):
    from fastapi import HTTPException, status

    if not ai_check.enabled():
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "AI Check chưa được cấu hình trên hệ thống (thiếu ANTHROPIC_API_KEY)")
    text = payload.text.strip()
    if len(text) > settings.ai_check_max_chars:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Văn bản tối đa {settings.ai_check_max_chars:,} ký tự, hãy kiểm tra theo từng phần".replace(",", "."))
    if len(text.split()) < settings.ai_check_min_words:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Cần ít nhất {settings.ai_check_min_words} từ để phân tích có ý nghĩa")
    st = _status(db, user)
    if st.remaining <= 0:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, f"Bạn đã dùng hết {st.daily_limit} lượt trong 24 giờ. Thử lại sau")
    result = ai_check.analyze(text)
    db.add(AiCheckRun(user_id=user.id, chars=len(text), words=len(text.split()), ai_score=result.ai_score, confidence=result.confidence))
    db.commit()
    st = _status(db, user)
    return schemas.AiCheckOut(**result.model_dump(), words=len(text.split()), remaining=st.remaining, daily_limit=st.daily_limit, model=st.model)
