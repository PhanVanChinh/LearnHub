"""Nạp bộ đề trắc nghiệm mẫu vào DB đang có (chỉ điền vào bài chưa có đề).

    cd backend && python seed_quizzes.py            # điền bài chưa có
    cd backend && python seed_quizzes.py --overwrite  # thay cả đề đã có bằng đề mẫu
"""
import sys

from app.database import SessionLocal
from app.seed import apply_seed_quizzes

db = SessionLocal()
try:
    n = apply_seed_quizzes(db, overwrite="--overwrite" in sys.argv)
    print(f"Đã cập nhật trắc nghiệm cho {n} bài học")
finally:
    db.close()
