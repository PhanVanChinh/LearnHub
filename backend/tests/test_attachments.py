"""Tài liệu đính kèm: metadata công khai không lộ key/URL, link tải theo quyền, upload admin (giả lập S3)."""
import io
import json

from app import storage
from app.config import settings
from tests.test_api import verify

LESSONS = [
    {"title": "Bài mở", "duration": "05:00", "free": True, "attachments": [
        {"name": "Slide chương 1.pdf", "kind": "file", "key": "courses/att-test/abc-slide.pdf", "size": 12345, "content_type": "application/pdf"},
        {"name": "Tài liệu tham khảo", "kind": "link", "url": "https://drive.google.com/x"},
    ]},
    {"title": "Bài khoá", "duration": "05:00", "attachments": [
        {"name": "Đề mẫu.docx", "kind": "file", "key": "courses/att-test/def-de.docx", "size": 999, "content_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"},
    ]},
]
COURSE = {"slug": "att-test", "title": "Khóa tài liệu", "category": "pdf", "price": 0, "short": "s", "description": "d", "includes": [], "lessons": LESSONS}


def _admin(client):
    r = client.post("/api/auth/login", json={"email": "admin@example.com", "password": "admin123"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _fake_storage(monkeypatch, enabled=True):
    monkeypatch.setattr(storage, "enabled", lambda: enabled)
    monkeypatch.setattr(storage, "presigned_get", lambda key, name, expires=None: f"https://s3.example/{key}?sig=abc&name={name}")
    store = {}
    monkeypatch.setattr(storage, "put", lambda key, data, ct: store.__setitem__(key, (data, ct)))
    monkeypatch.setattr(storage, "delete", lambda key: store.pop(key, None))
    return store


def test_attachments_public_metadata_hidden_secrets(client, monkeypatch):
    _fake_storage(monkeypatch)
    admin = _admin(client)
    bad = {**COURSE, "slug": "att-bad", "lessons": [{"title": "x", "duration": "1:00", "attachments": [{"name": "n", "kind": "link", "url": "javascript:alert(1)"}]}]}
    assert client.post("/api/admin/courses", json=bad, headers=admin).status_code == 422
    assert client.post("/api/admin/courses", json=COURSE, headers=admin).status_code == 201

    for url in ("/api/courses/att-test", "/api/courses/export"):
        dump = json.dumps(client.get(url).json())
        assert "courses/att-test/abc" not in dump and "drive.google.com" not in dump, url
    d = client.get("/api/courses/att-test").json()
    assert [a["name"] for a in d["lessons"][0]["attachments"]] == ["Slide chương 1.pdf", "Tài liệu tham khảo"]
    assert d["lessons"][0]["attachments"][0] == {"name": "Slide chương 1.pdf", "kind": "file", "size": 12345, "content_type": "application/pdf"}

    # bài free: khách tải được; file → URL ký, link → URL ngoài
    r = client.get("/api/courses/att-test/lessons/0/attachments/0/download")
    assert r.status_code == 200 and r.json()["url"].startswith("https://s3.example/courses/att-test/abc") and r.json()["expires_in"] == settings.s3_link_expire_seconds
    r = client.get("/api/courses/att-test/lessons/0/attachments/1/download")
    assert r.json()["url"] == "https://drive.google.com/x" and r.json()["expires_in"] is None
    assert client.get("/api/courses/att-test/lessons/0/attachments/5/download").status_code == 404
    # bài khoá: 401 → 403 → 200 sau ghi danh
    assert client.get("/api/courses/att-test/lessons/1/attachments/0/download").status_code == 401
    r = client.post("/api/auth/register", json={"email": "att@example.com", "full_name": "A", "password": "MatKhau2024"})
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    verify(client, r.json()["access_token"], "att@example.com")
    assert client.get("/api/courses/att-test/lessons/1/attachments/0/download", headers=h).status_code == 403
    client.post("/api/courses/att-test/enroll", headers=h)
    assert client.get("/api/courses/att-test/lessons/1/attachments/0/download", headers=h).status_code == 200


def test_admin_upload(client, monkeypatch):
    store = _fake_storage(monkeypatch)
    admin = _admin(client)
    st = client.get("/api/admin/uploads/status", headers=admin).json()
    assert st["enabled"] is True and "pdf" in st["allowed"]

    files = {"file": ("Slide Chương 2 (bản cuối).pdf", io.BytesIO(b"%PDF-1.4 fake"), "application/pdf")}
    r = client.post("/api/admin/uploads", data={"course_slug": "att-test"}, files=files, headers=admin)
    assert r.status_code == 201, r.text
    up = r.json()
    assert up["key"].startswith("courses/att-test/") and up["key"].endswith("-Slide-Chuong-2-ban-cuoi.pdf") and up["size"] == 13
    assert up["name"] == "Slide Chương 2 (bản cuối).pdf" and up["key"] in store

    # loại file không cho phép / rỗng / quá lớn
    assert client.post("/api/admin/uploads", data={"course_slug": "att-test"}, files={"file": ("a.exe", io.BytesIO(b"MZ"), "application/x-msdownload")}, headers=admin).status_code == 415
    assert client.post("/api/admin/uploads", data={"course_slug": "att-test"}, files={"file": ("a.pdf", io.BytesIO(b""), "application/pdf")}, headers=admin).status_code == 400
    monkeypatch.setattr(settings, "upload_max_mb", 0)
    assert client.post("/api/admin/uploads", data={"course_slug": "att-test"}, files={"file": ("a.pdf", io.BytesIO(b"x"), "application/pdf")}, headers=admin).status_code == 413
    monkeypatch.setattr(settings, "upload_max_mb", 50)

    # người thường không upload; xoá cần key hợp lệ
    assert client.post("/api/admin/uploads", data={"course_slug": "att-test"}, files=files).status_code == 401
    assert client.delete("/api/admin/uploads", params={"key": "../etc/passwd"}, headers=admin).status_code == 400
    assert client.delete("/api/admin/uploads", params={"key": up["key"]}, headers=admin).status_code == 204
    assert up["key"] not in store
    assert client.get("/api/admin/audit", params={"action": "upload"}, headers=admin).json()["total"] == 2

    # chưa cấu hình S3 → 503 rõ ràng
    _fake_storage(monkeypatch, enabled=False)
    assert client.get("/api/admin/uploads/status", headers=admin).json()["enabled"] is False
    assert client.post("/api/admin/uploads", data={"course_slug": "att-test"}, files=files, headers=admin).status_code == 503


def test_course_cover(client, monkeypatch):
    """Ảnh bìa: lưu key, upload kind=cover vào covers/, phục vụ qua /api/media, chặn key ngoài covers/."""
    import io

    store = _fake_storage(monkeypatch)
    monkeypatch.setattr(storage, "get", lambda key: (store.get(key, (b"", ""))[0], store.get(key, (b"", "image/png"))[1]))
    admin = _admin(client)

    r = client.post("/api/admin/uploads", data={"course_slug": "att-test", "kind": "cover"},
                    files={"file": ("bia.png", io.BytesIO(b"\x89PNG fake"), "image/png")}, headers=admin)
    assert r.status_code == 201 and r.json()["key"].startswith("covers/att-test/")
    key = r.json()["key"]
    # kind=cover chỉ nhận ảnh
    assert client.post("/api/admin/uploads", data={"course_slug": "att-test", "kind": "cover"},
                       files={"file": ("a.pdf", io.BytesIO(b"%PDF"), "application/pdf")}, headers=admin).status_code == 415

    cid = next(c["id"] for c in client.get("/api/admin/courses", params={"q": "att-test"}, headers=admin).json()["items"])
    assert client.patch(f"/api/admin/courses/{cid}", json={"cover": key}, headers=admin).json()["cover"] == key
    assert client.get("/api/courses/att-test").json()["cover"] == key  # public thấy key để dựng URL
    r = client.get(f"/api/media/{key}")
    assert r.status_code == 200 and r.content == b"\x89PNG fake" and "max-age=86400" in r.headers["cache-control"]
    assert client.get("/api/media/courses/att-test/secret.pdf").status_code == 404  # chỉ phục vụ covers/
    assert client.get("/api/media/covers/../../etc/passwd").status_code == 404
