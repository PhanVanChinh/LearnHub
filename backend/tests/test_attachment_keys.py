"""Key S3 của tài liệu phải đúng mẫu do upload cấp: không gắn được object khác trong bucket (vd backups/) vào bài học."""
import pytest
from fastapi import HTTPException

from app import storage
from app.storage import is_attachment_key

GOOD = "courses/lap-trinh-c/0123456789ab-slide-c1.pdf"
BAD = ["backups/learnhub-20260101-000000.json.gz", "courses/../backups/x.json", "covers/lap-trinh-c/0123456789ab-a.png",
       "courses/Lap_Trinh/0123456789ab-a.pdf", "courses/lap-trinh-c/short-a.pdf", "courses/lap-trinh-c/0123456789ab-", ""]


def test_key_pattern():
    assert is_attachment_key(GOOD)
    for k in BAD:
        assert not is_attachment_key(k), k


def test_schema_rejects_foreign_key(client):
    admin = {"Authorization": f"Bearer {client.post('/api/auth/login', json={'email': 'admin@example.com', 'password': 'admin123'}).json()['access_token']}"}
    body = {"slug": "khoa-key", "title": "x", "category": "pdf", "price": 0, "short": "s", "description": "d", "includes": []}
    bad = {**body, "lessons": [{"title": "a", "duration": "1:00", "free": True,
                                "attachments": [{"name": "Dump", "kind": "file", "key": BAD[0], "size": 1, "content_type": "application/gzip"}]}]}
    assert client.post("/api/admin/courses", json=bad, headers=admin).status_code == 422
    good = {**body, "lessons": [{"title": "a", "duration": "1:00", "free": True,
                                 "attachments": [{"name": "Slide", "kind": "file", "key": GOOD, "size": 1, "content_type": "application/pdf"}]}]}
    assert client.post("/api/admin/courses", json=good, headers=admin).status_code == 201
    assert client.delete("/api/admin/uploads", params={"key": BAD[0]}, headers=admin).status_code == 400


def test_presigned_refuses_foreign_key(monkeypatch):
    monkeypatch.setattr(storage, "enabled", lambda: True)
    with pytest.raises(HTTPException) as ei:
        storage.presigned_get(BAD[0], "x.json")
    assert ei.value.status_code == 404
