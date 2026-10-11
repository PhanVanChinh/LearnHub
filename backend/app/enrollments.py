"""Ghi danh an toàn khi có request đồng thời.

Mẫu cũ "query rồi insert" bị race: hai request (double-click duyệt đơn, hai admin, ghi danh miễn phí bấm 2 lần) cùng qua
bước kiểm tra → request thứ hai vỡ UniqueConstraint(user_id, course_id) thành lỗi 500, và `course.sold += 1` kiểu
đọc-sửa-ghi có thể mất đếm. Ở đây: insert trong SAVEPOINT, trùng thì bỏ qua; bộ đếm cộng bằng biểu thức SQL (atomic)."""
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .models import Course, Enrollment


def ensure_enrollment(db: Session, user_id: int, course_id: int) -> bool:
    """Tạo Enrollment nếu chưa có. Trả True khi vừa tạo (và đã cộng `sold`), False khi đã tồn tại. Không commit."""
    if db.query(Enrollment.id).filter_by(user_id=user_id, course_id=course_id).first():
        return False
    try:
        with db.begin_nested():  # SAVEPOINT: trùng do request khác chen vào chỉ huỷ phần này, transaction ngoài còn nguyên
            db.add(Enrollment(user_id=user_id, course_id=course_id))
            db.flush()
    except IntegrityError:
        return False
    db.query(Course).filter(Course.id == course_id).update({Course.sold: Course.sold + 1}, synchronize_session=False)
    return True


def bump_views(db: Session, course_id: int) -> None:
    """views = views + 1 ngay trong SQL — nhiều request cùng lúc không mất lượt."""
    db.query(Course).filter(Course.id == course_id).update({Course.views: Course.views + 1}, synchronize_session=False)
