"""Báo cáo doanh thu theo ngày / khóa và xuất CSV trong trang quản trị."""
import csv
import io
from datetime import datetime

from tests.test_delete_safety import _admin, _paid_order
from tests.test_orders import _buyer


def test_revenue_report(client):
    admin = _admin(client)
    _, course, order = _paid_order(client, admin, "rev1@example.com")
    _paid_order(client, admin, "rev2@example.com")  # cùng khóa (lấy khóa trả phí đầu tiên)
    r = client.get("/api/admin/stats/revenue", params={"days": 7}, headers=admin)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["days"] == 7 and len(d["by_day"]) == 7 and d["by_day"][-1]["date"] == datetime.utcnow().date().isoformat()
    assert d["orders"] >= 2 and d["total"] >= 2 * order["amount"]
    today = d["by_day"][-1]
    assert today["orders"] >= 2 and today["revenue"] >= 2 * order["amount"]
    top = d["by_course"][0]
    assert top["slug"] == course["slug"] and top["orders"] >= 2 and top["revenue"] == top["orders"] * course["price"]
    assert client.get("/api/admin/stats/revenue", params={"days": 0}, headers=admin).status_code == 422
    assert client.get("/api/admin/stats/revenue").status_code == 401


def _parse(resp):
    assert resp.status_code == 200 and resp.headers["content-type"].startswith("text/csv")
    assert "attachment; filename=" in resp.headers["content-disposition"]
    text = resp.content.decode("utf-8")
    assert text.startswith("\ufeff")  # BOM cho Excel
    return list(csv.reader(io.StringIO(text.lstrip("\ufeff"))))


def test_export_csv(client):
    admin = _admin(client)
    h, course, order = _paid_order(client, admin, "csv@example.com")
    rows = _parse(client.get("/api/admin/export/orders.csv", headers=admin))
    assert rows[0][:3] == ["ma_don", "email", "ho_ten"]
    mine = next(r for r in rows[1:] if r[0] == order["code"])
    assert mine[1] == "csv@example.com" and mine[3] == course["slug"] and mine[6] == "paid" and mine[10] == "admin@example.com"
    only_paid = _parse(client.get("/api/admin/export/orders.csv", params={"status": "paid"}, headers=admin))
    assert all(r[6] == "paid" for r in only_paid[1:])

    users = _parse(client.get("/api/admin/export/users.csv", headers=admin))
    me = next(r for r in users[1:] if r[1] == "csv@example.com")
    assert me[3] == "user" and me[4] == "1" and me[7] == "1"

    ens = _parse(client.get("/api/admin/export/enrollments.csv", headers=admin))
    assert any(r[1] == "csv@example.com" and r[3] == course["slug"] for r in ens[1:])

    # không phải admin → 403
    user = _buyer(client, "csv-user@example.com")
    assert client.get("/api/admin/export/users.csv", headers=user).status_code == 403
