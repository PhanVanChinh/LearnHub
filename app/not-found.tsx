import Link from "next/link";
import { site } from "@/lib/site";

export const metadata = { title: "Không tìm thấy trang" };

const SUGGEST = [
  { href: "/courses", label: "Tất cả khóa học", d: "Tìm theo tên môn, bài học hoặc tài liệu" },
  { href: "/free", label: "Tài liệu miễn phí", d: "Đăng nhập là học ngay" },
  { href: "/my-courses", label: "Khóa học của tôi", d: "Tiếp tục bài đang học" },
  { href: "/contact", label: "Liên hệ hỗ trợ", d: "Báo link hỏng để chúng tôi sửa" },
];

/** 404: gợi ý đường đi thay vì chỉ một nút. Khóa học đổi slug / bị xoá là trường hợp thường gặp. */
export default function NotFound() {
  return (
    <div className="container-x py-24">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-7xl font-black text-brand-600">404</p>
        <h1 className="mt-3 text-2xl font-bold text-slate-900">Không tìm thấy trang</h1>
        <p className="mt-2 text-slate-600">Trang có thể đã bị xoá, đổi địa chỉ, hoặc link bạn nhận được bị gõ sai. Nếu đây là khóa học, hãy thử tìm lại theo tên.</p>
        <div className="mt-8 grid gap-3 text-left sm:grid-cols-2">
          {SUGGEST.map((s) => (
            <Link key={s.href} href={s.href} className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-brand-300 hover:shadow-card">
              <p className="font-semibold text-slate-900">{s.label} →</p>
              <p className="mt-0.5 text-sm text-slate-500">{s.d}</p>
            </Link>
          ))}
        </div>
        <p className="mt-8 text-xs text-slate-400">{site.name} · <Link href="/" className="hover:underline">Về trang chủ</Link></p>
      </div>
    </div>
  );
}
