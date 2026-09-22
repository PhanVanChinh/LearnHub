"""Khôi phục DB từ bản backup. GHI ĐÈ toàn bộ dữ liệu hiện có.

    python restore_db.py --list                       # liệt kê backup trên S3
    python restore_db.py backups/learnhub-2026....gz  # key S3
    python restore_db.py ./file.json.gz               # file local
    thêm --yes để bỏ bước xác nhận (script tự động)
"""
import argparse
import os
import sys

from app.backup import download, list_backups, restore
from app.database import Base, SessionLocal, engine, migrate
from app.observability import setup_logging

setup_logging()
ap = argparse.ArgumentParser()
ap.add_argument("source", nargs="?", help="key S3 (backups/...) hoặc đường dẫn file")
ap.add_argument("--list", action="store_true")
ap.add_argument("--yes", action="store_true")
args = ap.parse_args()

if args.list:
    for k in list_backups():
        print(k)
    sys.exit(0)
if not args.source:
    ap.error("cần nguồn backup hoặc --list")
blob = open(args.source, "rb").read() if os.path.exists(args.source) else download(args.source)
if not args.yes:
    ans = input(f"GHI ĐÈ toàn bộ DB hiện tại bằng {args.source}? gõ 'restore' để tiếp tục: ")
    if ans.strip() != "restore":
        sys.exit("Đã huỷ")
migrate()
Base.metadata.create_all(bind=engine)
db = SessionLocal()
try:
    counts = restore(db, blob)
finally:
    db.close()
print("Khôi phục xong:", ", ".join(f"{k}={v}" for k, v in counts.items() if v))
