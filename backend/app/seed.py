"""Nạp dữ liệu mẫu (khóa học + tài khoản admin) nếu DB trống.

seed_data.json được export từ frontend/data/courses.ts:
    node --experimental-strip-types scripts/export-courses.mts
"""
import json
from datetime import datetime
from pathlib import Path

from .config import settings
from .database import SessionLocal
from .models import Course, User
from .security import hash_password

SEED_FILE = Path(__file__).with_name("seed_data.json")


def seed_if_empty() -> None:
    db = SessionLocal()
    try:
        if db.query(Course).count() == 0 and SEED_FILE.exists():
            for c in json.loads(SEED_FILE.read_text(encoding="utf-8")):
                # views/sold không lấy từ file seed: bắt đầu từ 0 và tăng theo hành vi thật (xem trang, ghi danh)
                db.add(Course(**{k: c.get(k, False if k == "featured" else None) for k in (
                    "slug", "title", "category", "tags", "price", "color",
                    "emoji", "short", "description", "includes", "lessons", "featured")}))
        if db.query(User).count() == 0:
            db.add(User(email=settings.admin_email.lower(), full_name="Admin", role="admin",
                        hashed_password=hash_password(settings.admin_password), email_verified_at=datetime.utcnow()))
        db.commit()
    finally:
        db.close()
