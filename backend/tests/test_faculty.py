"""Trường khoa (faculty) của khóa học: seed có đủ, admin chỉ đặt được giá trị hợp lệ, backfill cho DB cũ."""
from app.database import SessionLocal
from app.models import Course
from app.schemas import FACULTIES
from app.seed import backfill_faculty


def _admin(client):
    r = client.post("/api/auth/login", json={"email": "admin@example.com", "password": "admin123"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_seed_courses_have_faculty(client):
    rows = client.get("/api/courses").json()
    assert rows and all(c["faculty"] in FACULTIES for c in rows)
    assert {c["faculty"] for c in rows} >= {"cntt", "co-ban", "dai-cuong", "chung"}


def test_admin_sets_faculty(client):
    admin = _admin(client)
    body = {"slug": "khoa-khoa", "title": "x", "category": "pdf", "price": 0, "short": "s", "description": "d", "includes": [], "lessons": []}
    assert client.post("/api/admin/courses", json={**body, "faculty": "bay-gio-khong-co"}, headers=admin).status_code == 422
    r = client.post("/api/admin/courses", json={**body, "faculty": "kinh-te"}, headers=admin)
    assert r.status_code == 201 and r.json()["faculty"] == "kinh-te"
    cid = r.json()["id"]
    assert client.patch(f"/api/admin/courses/{cid}", json={"faculty": ""}, headers=admin).json()["faculty"] == ""
    assert client.patch(f"/api/admin/courses/{cid}", json={"faculty": "cntt"}, headers=admin).json()["faculty"] == "cntt"
    assert next(c for c in client.get("/api/courses/export").json() if c["slug"] == "khoa-khoa")["faculty"] == "cntt"


def test_backfill_faculty_from_seed(client):
    db = SessionLocal()
    try:
        c = db.query(Course).filter_by(slug="pdf-slide-lap-trinh-c").first()
        c.faculty = ""
        db.commit()
        assert backfill_faculty(db) == 1
        assert db.query(Course).filter_by(slug="pdf-slide-lap-trinh-c").first().faculty == "cntt"
        assert backfill_faculty(db) == 0
    finally:
        db.close()
