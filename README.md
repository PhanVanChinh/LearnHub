# LearnHub — nền tảng khóa học online cho sinh viên

Website học tập online (video, PDF, trắc nghiệm, source code, AI check đạo văn).

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS — thư mục gốc.
- **Backend**: FastAPI + SQLAlchemy + SQLite, auth JWT — thư mục [`backend/`](backend/README.md).

## Chạy local (2 terminal)

```bash
# Terminal 1 — backend (http://localhost:8000, docs tại /docs)
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000

# Terminal 2 — frontend (http://localhost:3000)
npm install
cp .env.local.example .env.local      # NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

Tài khoản demo: `admin@example.com` / `admin123`. Đăng ký tài khoản mới ngay trên trang `/register`.

## Đã nối FE ↔ BE

Đăng ký / đăng nhập / đăng xuất (JWT lưu localStorage, `components/AuthProvider.tsx`), header hiển thị người dùng, nút **Bắt đầu học miễn phí** gọi API ghi danh, trang **/my-courses** liệt kê khóa đã ghi danh. Danh sách khóa học trên FE vẫn đọc từ `data/courses.ts` (static, SEO tốt); backend có sẵn `GET /api/courses` nếu muốn chuyển sang đọc động — đổi `data/courses.ts` bằng `fetch(\`${API_URL}/api/courses\`)` trong Server Component.

## Cấu trúc

```
app/
  page.tsx                 Trang chủ (hero, filter danh mục, grid khóa học, CTA)
  courses/                 Tất cả khóa học + chi tiết /courses/[slug]
  free/                    Tài liệu miễn phí
  ai-check/                Công cụ AI check (demo giả lập kết quả)
  phenikaa/                Trang dành riêng cho sinh viên trường
  contact/  login/  register/  checkout/
  policy/[slug]            Điều khoản, bảo mật, thanh toán, giao nhận, hoàn tiền
components/                Header, Footer, CourseCard, CourseBrowser (filter + search + "xem thêm")…
data/courses.ts            Danh sách khóa học (mock) — thêm/sửa khóa học ở đây
lib/site.ts                Tên thương hiệu, menu, thông tin liên hệ — đổi brand ở đây
lib/api.ts                 API client (fetch + Bearer token)
backend/                   FastAPI (xem backend/README.md)
scripts/export-courses.mts Xuất data/courses.ts -> backend/app/seed_data.json
```

## Tuỳ biến nhanh

- **Đổi tên / logo / liên hệ**: sửa `lib/site.ts` và `components/Logo.tsx`.
- **Thêm khóa học**: thêm một object vào mảng `courses` trong `data/courses.ts` (slug là URL).
- **Màu chủ đạo**: bảng màu `brand` trong `tailwind.config.ts`.
- **AI Check**: thay `setTimeout` trong `components/AiCheckDemo.tsx` bằng gọi API thật.

## Deploy

Frontend: push lên GitHub rồi import vào [Vercel](https://vercel.com), đặt biến `NEXT_PUBLIC_API_URL` trỏ tới backend. Backend: Railway / Render / Fly.io chạy `uvicorn app.main:app --host 0.0.0.0 --port $PORT`, đặt `CORS_ORIGINS` là domain Vercel.
