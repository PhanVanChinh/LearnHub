"""Báo cáo doanh thu gom theo ngày giờ Việt Nam: đơn duyệt 00:00–07:00 giờ VN không rơi sang hôm trước."""
from datetime import datetime, timedelta

from app.database import SessionLocal
from app.models import Order
from app.timeutil import vn_day_start_utc, vn_today
from tests.test_delete_safety import _admin, _paid_order


def test_early_morning_vn_order_counts_today(client):
    admin = _admin(client)
    _, _, order = _paid_order(client, admin, "tz@example.com")
    # đặt giờ thanh toán = 00:00:01 hôm nay giờ VN (tức 17:00:01 hôm qua theo UTC)
    db = SessionLocal()
    try:
        o = db.query(Order).filter_by(code=order["code"]).first()
        o.paid_at = vn_day_start_utc(vn_today()) + timedelta(seconds=1)
        assert o.paid_at.date() < (o.paid_at + timedelta(hours=7)).date()  # UTC và VN khác ngày
        db.commit()
    finally:
        db.close()
    d = client.get("/api/admin/stats/revenue", params={"days": 2}, headers=admin).json()
    assert d["by_day"][-1]["date"] == vn_today().isoformat()
    assert d["by_day"][-1]["orders"] >= 1 and d["by_day"][-1]["revenue"] >= order["amount"]


def test_vn_helpers():
    from app.timeutil import to_vn
    assert to_vn(datetime(2026, 10, 15, 18, 30)) == datetime(2026, 10, 16, 1, 30)
    assert vn_day_start_utc(datetime(2026, 10, 16).date()) == datetime(2026, 10, 15, 17, 0)
