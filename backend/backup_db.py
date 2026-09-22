"""Backup DB hàng ngày. Render cron / GitHub Actions / crontab gọi:  python backup_db.py
Ghi lên S3 (bucket của tài liệu, thư mục backups/), giữ BACKUP_KEEP bản. --out <file> để ghi file local thay S3."""
import argparse
import logging
import sys

from app.backup import dump, upload_and_rotate
from app.database import SessionLocal
from app.observability import setup_logging

setup_logging()
ap = argparse.ArgumentParser()
ap.add_argument("--out", help="ghi ra file .json.gz thay vì S3")
args = ap.parse_args()

db = SessionLocal()
try:
    blob = dump(db)
finally:
    db.close()
if args.out:
    with open(args.out, "wb") as f:
        f.write(blob)
    print(f"Đã ghi {args.out} ({len(blob) // 1024} KB)")
else:
    try:
        print("Đã backup lên S3:", upload_and_rotate(blob))
    except RuntimeError as e:
        sys.exit(str(e))
