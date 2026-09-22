"""Backup / restore toàn bộ DB bằng Python thuần (không cần pg_dump), chạy được trên SQLite lẫn Postgres.

Dump: mọi bảng → JSON (theo thứ tự FK) → gzip → S3 (backups/learnhub-YYYYmmdd-HHMMSS.json.gz) hoặc file local.
Giữ lại BACKUP_KEEP bản mới nhất trên S3. Restore: xoá dữ liệu hiện có rồi nạp lại theo đúng thứ tự FK.

    python backup_db.py                 # dump lên S3 (cần S3_*), hoặc --out file.json.gz
    python restore_db.py file.json.gz   # hoặc restore_db.py s3://<key> ; hỏi xác nhận trước khi ghi đè
"""
import gzip
import json
import logging
from datetime import date, datetime, timezone

from sqlalchemy import text
from sqlalchemy.orm import Session

from . import storage
from .config import settings
from .database import Base
from . import models  # noqa: F401 — đăng ký bảng vào Base.metadata khi chạy script độc lập (không import main)

log = logging.getLogger("learnhub.backup")
PREFIX = "backups/"


def _tables_in_fk_order() -> list:
    return list(Base.metadata.sorted_tables)  # cha trước con


def _encode(v):
    if isinstance(v, (datetime, date)):
        return {"__dt__": v.isoformat()}
    return v


def _decode(col, v):
    if isinstance(v, dict) and "__dt__" in v:
        return datetime.fromisoformat(v["__dt__"])
    return v


def dump(db: Session) -> bytes:
    """Toàn bộ DB → gzip(JSON)."""
    payload = {"version": 1, "created_at": datetime.now(timezone.utc).isoformat(), "database": "sqlite" if settings.is_sqlite else "postgres", "tables": {}}
    for t in _tables_in_fk_order():
        rows = db.execute(t.select()).mappings().all()
        payload["tables"][t.name] = [{k: _encode(v) for k, v in r.items()} for r in rows]
    log.info("Dump %d bảng, %d dòng", len(payload["tables"]), sum(len(r) for r in payload["tables"].values()))
    return gzip.compress(json.dumps(payload, ensure_ascii=False).encode("utf-8"))


def restore(db: Session, blob: bytes) -> dict[str, int]:
    """Ghi đè DB bằng bản dump. Trả số dòng theo bảng."""
    payload = json.loads(gzip.decompress(blob).decode("utf-8"))
    if payload.get("version") != 1:
        raise ValueError(f"Không hỗ trợ phiên bản dump {payload.get('version')}")
    tables = _tables_in_fk_order()
    db.rollback()  # bỏ transaction ngầm đang mở (autobegin) để bắt đầu sạch
    try:
        if settings.is_sqlite:
            db.execute(text("PRAGMA foreign_keys = OFF"))
        for t in reversed(tables):  # con trước cha
            db.execute(t.delete())
        counts = {}
        for t in tables:
            rows = payload["tables"].get(t.name, [])
            if rows:
                cols = {c.name: c for c in t.columns}
                db.execute(t.insert(), [{k: _decode(cols.get(k), v) for k, v in r.items() if k in cols} for r in rows])
            counts[t.name] = len(rows)
        if not settings.is_sqlite:
            # Postgres: đưa sequence id về đúng max(id) để insert mới không trùng khoá
            for t in tables:
                if "id" in t.columns:
                    db.execute(text(f"SELECT setval(pg_get_serial_sequence('{t.name}', 'id'), COALESCE((SELECT MAX(id) FROM {t.name}), 0) + 1, false)"))
        db.commit()
    except Exception:
        db.rollback()
        raise
    log.info("Restore xong: %s", counts)
    return counts


def backup_key(now: datetime | None = None) -> str:
    return f"{PREFIX}learnhub-{(now or datetime.now(timezone.utc)):%Y%m%d-%H%M%S}.json.gz"


def upload_and_rotate(blob: bytes, keep: int | None = None) -> str:
    """Đưa dump lên S3, xoá bản cũ vượt quá `keep`. Trả key vừa ghi."""
    if not storage.enabled():
        raise RuntimeError("Chưa cấu hình S3_* — không có nơi lưu backup. Dùng --out để ghi file local")
    key = backup_key()
    storage.put(key, blob, "application/gzip")
    keep = keep or settings.backup_keep
    old = sorted(list_backups())[:-keep] if keep > 0 else []
    for k in old:
        storage.delete(k)
    log.info("Backup %s (%d KB); giữ %d bản, xoá %d bản cũ", key, len(blob) // 1024, keep, len(old))
    return key


def list_backups() -> list[str]:
    client = storage._client()
    keys: list[str] = []
    token = None
    while True:
        kw = {"Bucket": settings.s3_bucket, "Prefix": PREFIX}
        if token:
            kw["ContinuationToken"] = token
        resp = client.list_objects_v2(**kw)
        keys += [o["Key"] for o in resp.get("Contents", [])]
        if not resp.get("IsTruncated"):
            return sorted(keys)
        token = resp.get("NextContinuationToken")


def download(key: str) -> bytes:
    return storage._client().get_object(Bucket=settings.s3_bucket, Key=key)["Body"].read()
