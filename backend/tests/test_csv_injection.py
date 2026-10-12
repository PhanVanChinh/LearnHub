"""Export CSV: ô do người dùng nhập bắt đầu bằng = + - @ không được Excel chạy như công thức."""
import csv
import io

from app.routers.admin import _csv_cell
from tests.test_delete_safety import _admin
from tests.test_orders import _paid_course
from tests.test_api import verify


def test_csv_cell_neutralizes_formula_prefixes():
    assert _csv_cell("=HYPERLINK(\"http://x\")") == "'=HYPERLINK(\"http://x\")"
    assert _csv_cell("+1") == "'+1" and _csv_cell("-2+3") == "'-2+3" and _csv_cell("@SUM(A1)") == "'@SUM(A1)"
    assert _csv_cell("Nguyễn Văn A") == "Nguyễn Văn A" and _csv_cell(15000) == 15000 and _csv_cell(None) == ""


def test_export_users_escapes_malicious_name(client):
    admin = _admin(client)
    email = "csvinj@example.com"
    r = client.post("/api/auth/register", json={"email": email, "full_name": "=cmd|' /C calc'!A0", "password": "MatKhau2024"})
    assert r.status_code == 201, r.text
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    verify(client, r.json()["access_token"], email)
    # ghi chú đơn hàng do admin nhập cũng được bảo vệ
    o = client.post("/api/orders", json={"course_slug": _paid_course(client)["slug"]}, headers=h).json()
    client.post(f"/api/admin/orders/{o['id']}/confirm", json={"note": "+HYPERLINK(\"http://evil\")"}, headers=admin)

    text = client.get("/api/admin/export/users.csv", headers=admin).content.decode("utf-8").lstrip("\ufeff")
    row = next(r for r in csv.reader(io.StringIO(text)) if r[1] == email)
    assert row[2].startswith("'=")
    text = client.get("/api/admin/export/orders.csv", headers=admin).content.decode("utf-8").lstrip("\ufeff")
    row = next(r for r in csv.reader(io.StringIO(text)) if r[0] == o["code"])
    assert row[2].startswith("'=") and row[11].startswith("'+")
