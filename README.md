# LearnHub — nền tảng khóa học online cho sinh viên

Website học tập online (video, PDF, trắc nghiệm, source code, AI check đạo văn) xây bằng **Next.js 14 (App Router) + TypeScript + Tailwind CSS**. Dữ liệu khóa học hiện là mock, chưa có backend — sẵn sàng để nối API sau.

## Chạy local

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start   # bản production
```

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
```

## Tuỳ biến nhanh

- **Đổi tên / logo / liên hệ**: sửa `lib/site.ts` và `components/Logo.tsx`.
- **Thêm khóa học**: thêm một object vào mảng `courses` trong `data/courses.ts` (slug là URL).
- **Màu chủ đạo**: bảng màu `brand` trong `tailwind.config.ts`.
- **Nối backend**: thay `data/courses.ts` bằng fetch trong Server Component; thay `setTimeout` trong `components/AiCheckDemo.tsx` bằng gọi API thật.

## Deploy

Push lên GitHub rồi import vào [Vercel](https://vercel.com) — không cần cấu hình thêm.
