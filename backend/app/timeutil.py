"""Giờ Việt Nam cho báo cáo và file xuất. DB lưu thời điểm UTC dạng naive (datetime.utcnow()).

Việt Nam không có giờ mùa hè nên dùng offset cố định +07:00, không cần gói tzdata (image slim / Windows thiếu)."""
from datetime import date, datetime, timedelta, timezone

VN_TZ = timezone(timedelta(hours=7), "Asia/Ho_Chi_Minh")
_OFFSET = timedelta(hours=7)


def to_vn(d: datetime) -> datetime:
    """UTC naive (như trong DB) → giờ Việt Nam naive."""
    return d + _OFFSET


def vn_today(now_utc: datetime | None = None) -> date:
    return to_vn(now_utc or datetime.utcnow()).date()


def vn_day_start_utc(day: date) -> datetime:
    """00:00 giờ Việt Nam của `day`, đổi về UTC naive để so với cột trong DB."""
    return datetime.combine(day, datetime.min.time()) - _OFFSET
