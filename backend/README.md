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

## Xác thực email

Đăng ký xong, backend gửi mã OTP 6 số. Chưa xác thực vẫn đăng nhập và xem bài miễn phí được, nhưng **không** ghi danh, xem bài trả phí hay lưu tiến độ (403).

- Chưa đặt `RESEND_API_KEY` → chế độ dev: mã in ra terminal backend, không gửi mail thật.
- Gửi thật: tạo key tại https://resend.com, đặt `RESEND_API_KEY=re_...` trong `.env`. Khi chưa xác minh domain, Resend chỉ cho gửi từ `onboarding@resend.dev` tới email đăng ký tài khoản Resend; có domain riêng thì đổi `MAIL_FROM`.
- Tài khoản tạo trước tính năng này được tự đánh dấu đã xác thực khi migrate (`database.migrate()`).

## Chống lạm dụng

- **Rate limit theo IP** (`app/ratelimit.py`, bộ nhớ tiến trình): đăng ký 5/giờ, đăng nhập 10/phút, gửi lại OTP 5/10 phút, quên mật khẩu 5/10 phút... Vượt → 429 kèm `Retry-After`. Deploy sau proxy đặt `TRUST_PROXY_HEADERS=true` để đọc IP từ `X-Forwarded-For`. Tắt khi test bằng `RATE_LIMIT_ENABLED=false`.
- **Khoá tạm**: sai mật khẩu 5 lần liên tiếp → khoá 15 phút (423). Đăng nhập đúng reset bộ đếm và ghi `last_login_at`.
- **Captcha Cloudflare Turnstile** ở đăng ký và quên mật khẩu: đặt `TURNSTILE_SECRET_KEY` (backend) và `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (frontend). Thiếu key → tự bỏ qua, tiện cho dev.
- **Token**: access token 60 phút, refresh token 30 ngày (`POST /api/auth/refresh`). Frontend tự gia hạn khi gặp 401. Đổi mật khẩu hoặc `logout-all` làm mọi token cũ hết hiệu lực (claim `pv`).

## Đăng nhập Google

Dùng Google Identity Services: nút Google trên frontend trả `credential` (ID token), backend xác minh chữ ký bằng khoá công khai của Google (`app/google_auth.py`), kiểm tra `aud` = `GOOGLE_CLIENT_ID`. Không cần Client Secret.

Tạo Client ID tại Google Cloud Console → APIs & Services → Credentials → OAuth client ID (Web application), thêm Authorized JavaScript origins `http://localhost:3000` và domain thật. Đặt `GOOGLE_CLIENT_ID` (backend) và `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (frontend). Thiếu → nút Google ẩn, endpoint trả 503.

Tài khoản tạo qua Google chưa có mật khẩu (`has_password=false`): đăng nhập bằng mật khẩu bị từ chối kèm gợi ý dùng Google. Đặt mật khẩu lần đầu tại trang Tài khoản (`POST /api/auth/set-password`) hoặc qua Quên mật khẩu. Tài khoản Google tạo trước bản này vẫn mang mật khẩu ngẫu nhiên nên chỉ đặt được qua Quên mật khẩu.

## Quên mật khẩu

`POST /api/auth/forgot-password` gửi email chứa link `{FRONTEND_URL}/reset-password?token=...` (đặt `FRONTEND_URL` trong `.env` khi deploy).
Đặt lại xong, `password_changed_at` được cập nhật nên mọi JWT phát hành trước đó bị từ chối (đăng xuất mọi thiết bị).

## Endpoints

| Method | Path | Auth | Mô tả |
|---|---|---|---|
| POST | /api/auth/register | – | Đăng ký → trả JWT + user. Mật khẩu ≥ 8 ký tự, có chữ và số, không phổ biến, không chứa tên email (xem `app/passwords.py`). Lỗi 422 trả `{detail, errors:[{field,msg}]}` |
| GET | /api/auth/config | – | Cấu hình auth cho frontend: `captcha_enabled`, `mail_provider`, hạn access token |
| POST | /api/auth/login | – | Đăng nhập → access token (60 phút) + refresh token (30 ngày) + user. Sai 5 lần → khoá 15 phút (423) |
| POST | /api/auth/refresh | – | Đổi refresh token lấy access token mới |
| POST | /api/auth/google | – | Đăng nhập/đăng ký bằng Google ID token (Google Identity Services). Email Google đã xác minh → bỏ qua OTP; tự liên kết với tài khoản cùng email |
| POST | /api/auth/logout-all | Bearer | Thu hồi mọi token trên mọi thiết bị, trả token mới cho thiết bị hiện tại |
| GET | /api/auth/me | Bearer | Thông tin tài khoản, kèm `email_verified`, `has_google`, `has_password`, `last_login_at`, `password_changed_at`, `sessions_revoked_at` (trang /account dùng) |
| GET | /api/auth/verification | Bearer | Trạng thái xác thực email, số giây chờ gửi lại, nhà cung cấp mail |
| POST | /api/auth/verification/resend | Bearer | Gửi lại mã OTP (cooldown 60s → 429) |
| POST | /api/auth/verification/confirm | Bearer | Xác nhận mã 6 số (hết hạn 10 phút, tối đa 5 lần sai) |
| PATCH | /api/auth/me | Bearer | Sửa hồ sơ (họ tên) |
| POST | /api/auth/change-password | Bearer | Đổi mật khẩu → trả token mới; mọi token cũ hết hiệu lực |
| POST | /api/auth/google/link | Bearer | Liên kết Google vào tài khoản hiện tại (409 nếu Google đó đã thuộc tài khoản khác) |
| DELETE | /api/auth/google | Bearer | Gỡ liên kết Google (400 nếu chưa đặt mật khẩu) |
| POST | /api/auth/set-password | Bearer | Đặt mật khẩu lần đầu cho tài khoản Google chưa có mật khẩu → trả token mới |
| POST | /api/auth/forgot-password | – | Gửi link đặt lại mật khẩu (luôn 200, không lộ email tồn tại; cooldown 60s) |
| POST | /api/auth/reset-password | – | Đặt mật khẩu mới bằng token trong link (30 phút, dùng 1 lần) → 204 |
| GET | /api/courses?category=&q=&featured=&limit=&offset= | – | Danh sách khóa học (lọc, tìm) |
| GET | /api/courses/categories | – | Số khóa học theo danh mục |
| GET | /api/courses/{slug} | tuỳ chọn | Chi tiết (kèm `enrolled`). Bài không free chỉ trả `has_video`, ẩn `video` nếu chưa ghi danh |
| GET | /api/courses/{slug}/lessons/{index}/video | tuỳ chọn | YouTube ID của bài học. Bài free: công khai. Bài khác: 401 chưa đăng nhập, 403 chưa ghi danh |
| POST | /api/courses/{slug}/enroll | Bearer | Ghi danh khóa miễn phí (khóa trả phí → 402) |
| GET | /api/courses/me/enrolled | Bearer | Khóa học của tôi, kèm `progress` (bài đã xong, %, bài kế tiếp) |
| GET | /api/courses/{slug}/progress | Bearer, đã ghi danh | Tiến độ học của tôi trong khóa |
| PUT | /api/courses/{slug}/lessons/{index}/complete | Bearer, đã ghi danh | Đánh dấu bài đã hoàn thành (idempotent) |
| DELETE | /api/courses/{slug}/lessons/{index}/complete | Bearer, đã ghi danh | Bỏ đánh dấu hoàn thành |
| GET | /api/stats | – | Số liệu công khai thật: khóa học, bài học, video, học viên (đã ghi danh ≥1 khóa), ghi danh, lượt xem |
| GET | /api/stats/courses | – | Mỗi khóa: `views`, `students` (số ghi danh) — thẻ khóa học dùng |
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
  models.py      User, Course, Enrollment, LessonProgress, EmailVerification, PasswordReset
  schemas.py     Pydantic request/response
  security.py    bcrypt + JWT, dependencies get_current_user / require_admin
  passwords.py   Quy tắc mật khẩu (dùng chung đăng ký / đổi mật khẩu / admin)
  mailer.py      Gửi email qua Resend hoặc in ra log (dev)
  ratelimit.py   Giới hạn tần suất theo IP
  captcha.py     Xác minh Cloudflare Turnstile
  google_auth.py Xác minh Google ID token
  seed.py        Nạp seed_data.json + admin (views/sold luôn bắt đầu từ 0)
  routers/       auth.py, courses.py, admin.py, stats.py
reset_counters.py  DB cũ có số giả từ seed → chạy `python reset_counters.py` để views=0, sold=số ghi danh
tests/           conftest.py, test_api.py, test_admin.py, test_abuse.py, test_google.py, test_account.py, test_stats.py (chạy: python -m pytest)
```

## Đổi sang PostgreSQL

`pip install psycopg[binary]` rồi đặt `DATABASE_URL=postgresql+psycopg://user:pass@host/db` trong `.env`. Không cần sửa code.

## Việc chưa làm (để mở rộng)

Đơn hàng/thanh toán cho khóa trả phí, endpoint AI check, tài liệu PDF đính kèm bài học.
