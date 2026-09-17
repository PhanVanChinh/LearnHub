"""Cập nhật tiêu đề / mô tả của một số khóa trong DB theo seed_data.json (khi sửa lời quảng cáo trong data/courses.ts).

    cd backend && python sync_seed_text.py slug-1 slug-2 ...

Chỉ ghi các slug được liệt kê, chỉ 3 trường title/short/description — không đụng giá, bài học, quiz.
"""
import json
import sys

from app.database import SessionLocal
from app.models import Course
from app.seed import SEED_FILE

slugs = sys.argv[1:]
if not slugs:
    sys.exit("Cần liệt kê slug. Ví dụ: python sync_seed_text.py ai-check-dao-van-khoa-luan")
seed = {c["slug"]: c for c in json.loads(SEED_FILE.read_text(encoding="utf-8"))}
db = SessionLocal()
try:
    n = 0
    for slug in slugs:
        src, course = seed.get(slug), db.query(Course).filter_by(slug=slug).first()
        if not src or not course:
            print(f"bỏ qua {slug}: không có trong seed hoặc DB"); continue
        course.title, course.short, course.description = src["title"], src["short"], src["description"]
        n += 1
    db.commit()
    print(f"Đã cập nhật {n} khóa")
finally:
    db.close()
