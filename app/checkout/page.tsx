import Link from "next/link";
import { getCourse } from "@/data/courses";
import { formatVND } from "@/lib/site";

export const metadata = { title: "Thanh toán" };

export default function CheckoutPage({ searchParams }: { searchParams: { course?: string } }) {
  const course = searchParams.course ? getCourse(searchParams.course) : undefined;
  return (
    <div className="container-x grid gap-8 py-12 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <h1 className="text-2xl font-bold text-slate-900">Thanh toán</h1>
        <div className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="font-semibold">Thông tin nhận tài liệu</h2>
          <input className="input" type="email" placeholder="Email nhận tài liệu" />
          <input className="input" placeholder="Số điện thoại" />
          <h2 className="pt-2 font-semibold">Phương thức thanh toán</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {["Chuyển khoản / QR", "Ví MoMo", "ZaloPay"].map((m, i) => (
              <label key={m} className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
                <input type="radio" name="pm" defaultChecked={i === 0} /> {m}
              </label>
            ))}
          </div>
          <button className="btn-primary w-full !py-3">Xác nhận thanh toán</button>
          <p className="text-xs text-slate-500">* Trang demo — chưa kết nối cổng thanh toán.</p>
        </div>
      </div>
      <aside className="rounded-2xl border border-slate-200 bg-white p-6 lg:self-start">
        <h2 className="font-semibold">Đơn hàng</h2>
        {course ? (
          <>
            <div className={`mt-4 grid aspect-video place-items-center rounded-xl bg-gradient-to-br ${course.color} text-4xl`}>{course.emoji}</div>
            <p className="mt-3 font-medium text-slate-800">{course.title}</p>
            <div className="mt-4 flex justify-between border-t border-slate-200 pt-4 font-bold">
              <span>Tổng</span><span className="text-brand-700">{formatVND(course.price)}</span>
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm text-slate-500">Chưa chọn khóa học. <Link href="/courses" className="text-brand-700 underline">Chọn khóa học</Link></p>
        )}
      </aside>
    </div>
  );
}
