# LearnHub API (FastAPI)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                   # sửa SECRET_KEY
uvicorn app.main:app --reload --port 8000
```

Swagger UI: http://localhost:8000/docs — nút **Authorize** dùng email/mật khẩu.
Lần chạy đầu tự tạo `learnhub.db` (SQLite), nạp 22 khóa học từ `app/seed_data.json` và tài khoản admin `admin@example.com / admin123`.

## Endpoints

| Method | Path | Auth | Mô tả |
|---|---|---|---|
| POST | /api/auth/register | – | Đăng ký → trả JWT + user |
| POST | /api/auth/login | – | Đăng nhập → JWT + user |
| GET | /api/auth/me | Bearer | Thông tin tài khoản hiện tại |
| POST | /api/auth/change-password | Bearer | Đổi mật khẩu |
| GET | /api/courses?category=&q=&featured=&limit=&offset= | – | Danh sách khóa học (lọc, tìm) |
| GET | /api/courses/categories | – | Số khóa học theo danh mục |
| GET | /api/courses/{slug} | tuỳ chọn | Chi tiết (kèm `enrolled` nếu đã đăng nhập) |
| POST | /api/courses/{slug}/enroll | Bearer | Ghi danh khóa miễn phí (khóa trả phí → 402) |
| GET | /api/courses/me/enrolled | Bearer | Khóa học của tôi |
| GET | /api/health | – | Health check |

## Cấu trúc

```
app/
  main.py        FastAPI app, CORS, lifespan (tạo bảng + seed)
  config.py      Settings đọc từ .env
  database.py    SQLAlchemy engine/session
  models.py      User, Course, Enrollment
  schemas.py     Pydantic request/response
  security.py    bcrypt + JWT, dependencies get_current_user / require_admin
  seed.py        Nạp seed_data.json + admin
  routers/       auth.py, courses.py
tests/test_api.py  pytest (chạy: python -m pytest)
```

## Đổi sang PostgreSQL

`pip install psycopg[binary]` rồi đặt `DATABASE_URL=postgresql+psycopg://user:pass@host/db` trong `.env`. Không cần sửa code.

## Việc chưa làm (để mở rộng)

Đơn hàng/thanh toán cho khóa trả phí, CRUD khóa học cho admin (đã có `require_admin` sẵn), endpoint AI check, refresh token / đăng nhập Google.
