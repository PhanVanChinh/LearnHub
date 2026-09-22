"""Backup/restore vòng tròn: dump → xoá → restore → dữ liệu và quan hệ giữ nguyên; xoay vòng bản cũ trên S3 (giả lập)."""
import gzip
import json

from app import backup, storage
from app.config import settings
from app.database import SessionLocal
from app.models import Course, Enrollment, Order, User
from tests.test_api import verify


def test_dump_restore_roundtrip(client):
    r = client.post("/api/auth/register", json={"email": "bk@example.com", "full_name": "Backup", "password": "MatKhau2024"})
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    verify(client, r.json()["access_token"], "bk@example.com")
    free = next(c for c in client.get("/api/courses").json() if c["price"] == 0)
    client.post(f"/api/courses/{free['slug']}/enroll", headers=h)
    paid = next(c for c in client.get("/api/courses").json() if c["price"] > 0 and c["category"] != "ai-check")
    code = client.post("/api/orders", json={"course_slug": paid["slug"]}, headers=h).json()["code"]

    db = SessionLocal()
    try:
        _roundtrip(client, db, h, code)
    finally:
        db.close()  # luôn đóng: session treo transaction sẽ khoá drop_all trên Postgres


def _roundtrip(client, db, h, code):
    blob = backup.dump(db)
    payload = json.loads(gzip.decompress(blob))
    assert payload["version"] == 1 and len(payload["tables"]["courses"]) >= 22 and payload["tables"]["users"]
    before = {"users": db.query(User).count(), "courses": db.query(Course).count(), "enroll": db.query(Enrollment).count(), "orders": db.query(Order).count()}

    # phá dữ liệu rồi khôi phục
    db.query(Enrollment).delete(); db.query(Order).delete(); db.commit()
    assert db.query(Enrollment).count() == 0
    counts = backup.restore(db, blob)
    assert counts["users"] == before["users"] and counts["courses"] == before["courses"]
    assert db.query(Enrollment).count() == before["enroll"] and db.query(Order).filter_by(code=code).first().user.email == "bk@example.com"
    db.commit()
    # hệ thống vẫn hoạt động bình thường sau restore (token cũ còn hiệu lực, tạo bản ghi mới không trùng id)
    assert client.get("/api/auth/me", headers=h).json()["email"] == "bk@example.com"
    assert client.post("/api/auth/register", json={"email": "after@example.com", "full_name": "A", "password": "MatKhau2024"}).status_code == 201


def test_upload_and_rotate(client, monkeypatch):
    store: dict[str, bytes] = {f"backups/learnhub-2026090{i}-020000.json.gz": b"x" for i in range(1, 6)}  # 5 bản cũ
    monkeypatch.setattr(storage, "enabled", lambda: True)
    monkeypatch.setattr(storage, "put", lambda k, d, ct: store.__setitem__(k, d))
    monkeypatch.setattr(storage, "delete", lambda k: store.pop(k, None))
    monkeypatch.setattr(backup, "list_backups", lambda: sorted(store))
    key = backup.upload_and_rotate(b"new-dump", keep=3)
    assert key.startswith("backups/learnhub-") and key.endswith(".json.gz") and store[key] == b"new-dump"
    assert len(store) == 3 and key in store and "backups/learnhub-20260901-020000.json.gz" not in store

    monkeypatch.setattr(storage, "enabled", lambda: False)
    import pytest
    with pytest.raises(RuntimeError):
        backup.upload_and_rotate(b"x")
