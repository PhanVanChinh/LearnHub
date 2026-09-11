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
| GET | /api/courses/{slug} | tuỳ chọn | Chi tiết (kèm `enrolled`). Bài không free chỉ trả `has_video`, ẩn `video` nếu chưa ghi danh |
| GET | /api/courses/{slug}/lessons/{index}/video | tuỳ chọn | YouTube ID của bài học. Bài free: công khai. Bài khác: 401 chưa đăng nhập, 403 chưa ghi danh |
| POST | /api/courses/{slug}/enroll | Bearer | Ghi danh khóa miễn phí (khóa trả phí → 402) |
| GET | /api/courses/me/enrolled | Bearer | Khóa học của tôi, kèm `progress` (bài đã xong, %, bài kế tiếp) |
| GET | /api/courses/{slug}/progress | Bearer, đã ghi danh | Tiến độ học của tôi trong khóa |
| PUT | /api/courses/{slug}/lessons/{index}/complete | Bearer, đã ghi danh | Đánh dấu bài đã hoàn thành (idempotent) |
| DELETE | /api/courses/{slug}/lessons/{index}/complete | Bearer, đã ghi danh | Bỏ đánh dấu hoàn thành |
| GET | /api/health | – | Health check |

### Admin (yêu cầu role `admin`, tài khoản mặc định `admin@example.com / admin123`)

| Method | Path | Mô tả |
|---|---|---|
| GET | /api/admin/stats | Thống kê: số user, khóa học, ghi danh, lượt xem, doanh thu |
| GET | /api/admin/courses?q=&category=&featured=&limit=&offset= | Danh sách khóa học (phân trang, kèm `enrollment_count`) |
| POST | /api/admin/courses | Tạo khóa học (slug phải duy nhất, dạng `a-b-c`) |
| GET | /api/admin/courses/{id} | Chi tiết khóa học |
| PATCH | /api/admin/courses/{id} | Cập nhật từng phần (chỉ gửi trường cần đổi) |
| DELETE | /api/admin/courses/{id} | Xoá khóa học (xoá luôn ghi danh liên quan) |
| GET | /api/admin/users?q=&role=&is_active=&limit=&offset= | Danh sách người dùng |
| POST | /api/admin/users | Tạo người dùng (có thể đặt `role`, `is_active`) |
| GET | /api/admin/users/{id} | Chi tiết người dùng |
| PATCH | /api/admin/users/{id} | Sửa tên/email/mật khẩu/role/khoá tài khoản |
| DELETE | /api/admin/users/{id} | Xoá người dùng |
| GET | /api/admin/enrollments?user_id=&course_id= | Danh sách ghi danh |
| POST | /api/admin/enrollments | Cấp quyền khóa học cho user (kể cả khóa trả phí) |
| DELETE | /api/admin/enrollments/{id} | Thu hồi ghi danh |

Mỗi phần tử `lessons` có dạng `{title, duration, free?, video?}`; `video` là YouTube video ID 11 ký tự (chỉ lưu ID, không lưu link).

Quy tắc: `tags` tự động chứa `category`, thêm `free` khi `price = 0` và gỡ `free` khi `price > 0`.
Admin không thể tự hạ quyền, tự khoá hoặc tự xoá tài khoản của chính mình.

## Cấu trúc

```
app/
  main.py        FastAPI app, CORS, lifespan (tạo bảng + seed)
  config.py      Settings đọc từ .env
  database.py    SQLAlchemy engine/session
  models.py      User, Course, Enrollment, LessonProgress
  schemas.py     Pydantic request/response
  security.py    bcrypt + JWT, dependencies get_current_user / require_admin
  seed.py        Nạp seed_data.json + admin
  routers/       auth.py, courses.py, admin.py
tests/           conftest.py, test_api.py, test_admin.py (chạy: python -m pytest)
```

## Đổi sang PostgreSQL

`pip install psycopg[binary]` rồi đặt `DATABASE_URL=postgresql+psycopg://user:pass@host/db` trong `.env`. Không cần sửa code.

## Việc chưa làm (để mở rộng)

Đơn hàng/thanh toán cho khóa trả phí, endpoint AI check, refresh token / đăng nhập Google.
