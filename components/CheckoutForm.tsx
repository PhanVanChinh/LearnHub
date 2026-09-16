"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { Course } from "@/data/courses";
import { ApiError, OrderDetail, ordersApi } from "@/lib/api";
import { fetchCourseDetail } from "@/lib/liveCourse";
import { formatVND } from "@/lib/site";
import { useAuth } from "./AuthProvider";
import PaymentInstructions from "./PaymentInstructions";

/**
 * /checkout?course=<slug>  → xem đơn, bấm "Xác nhận đặt hàng" → tạo đơn → hướng dẫn chuyển khoản
 * /checkout?order=<code>   → mở lại đơn đã tạo (từ trang Đơn hàng của tôi / email)
 * Trang tự hỏi API mỗi 8 giây; admin xác nhận xong → hiện nút Vào học.
 */
export default function CheckoutForm({ courses }: { courses: Course[] }) {
  const params = useSearchParams();
  const slug = params.get("course");
  const orderCode = params.get("order");
  const { user, loading } = useAuth();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [enrolled, setEnrolled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const course = courses.find((c) => c.slug === (order?.course_slug ?? slug));
  const self = orderCode ? `/checkout?order=${orderCode}` : slug ? `/checkout?course=${slug}` : "/checkout";

  // Mở lại đơn theo mã, hoặc kiểm tra đã có quyền khóa này chưa
  useEffect(() => {
    if (loading || !user) return;
    if (orderCode) ordersApi.get(orderCode).then(setOrder).catch((e: ApiError) => setError(e.message));
    else if (slug) fetchCourseDetail(slug, true).then((d) => setEnrolled(d.enrolled)).catch(() => {});
  }, [user, loading, orderCode, slug]);

  // Poll trạng thái khi đơn còn chờ
  const refresh = useCallback(() => {
    if (!order || order.status !== "pending") return;
    ordersApi.get(order.code).then(setOrder).catch(() => {});
  }, [order]);
  useEffect(() => {
    if (!order || order.status !== "pending") return;
    const id = setInterval(refresh, 8000);
    return () => clearInterval(id);
  }, [order, refresh]);

  const createOrder = async () => {
    if (!slug) return;
    setBusy(true); setError("");
    try {
      const o = await ordersApi.create(slug);
      setOrder(o);
      window.history.replaceState(null, "", `/checkout?order=${o.code}`); // F5 vẫn mở đúng đơn
    } catch (e) {
      const ae = e as ApiError;
      if (ae.status === 409) setEnrolled(true); else setError(ae.message);
    } finally { setBusy(false); }
  };
  const cancel = async () => {
    if (!order || !confirm("Huỷ đơn này? Bạn có thể đặt lại sau.")) return;
    setBusy(true);
    try { setOrder(await ordersApi.cancel(order.code)); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  // ---- các trạng thái chặn ----
  if (!slug && !orderCode) return <Shell title="Thanh toán"><Empty /></Shell>;
  if (loading) return <Shell title="Thanh toán"><div className="h-40 animate-pulse rounded-2xl bg-slate-100" /></Shell>;
  if (!user) {
    return (
      <Shell title="Thanh toán">
        <Notice icon="🔐" title="Đăng nhập để mua khóa học" text="Khóa học sẽ gắn với tài khoản của bạn, học được trên mọi thiết bị.">
          <Link href={`/login?next=${encodeURIComponent(self)}`} className="btn-primary">Đăng nhập</Link>
          <Link href={`/register?next=${encodeURIComponent(self)}`} className="btn-outline">Tạo tài khoản</Link>
        </Notice>
      </Shell>
    );
  }
  if (!user.email_verified) {
    return (
      <Shell title="Thanh toán">
        <Notice icon="✉️" title="Xác thực email trước khi thanh toán" text={`Chúng tôi đã gửi mã 6 số tới ${user.email}. Xác thực để nhận thông báo đơn hàng.`}>
          <Link href={`/verify?next=${encodeURIComponent(self)}`} className="btn-primary">Nhập mã xác thực</Link>
        </Notice>
      </Shell>
    );
  }
  if (!course && !order) return <Shell title="Thanh toán">{error ? <Notice icon="⚠️" title="Không mở được đơn" text={error} /> : <Empty />}</Shell>;

  const price = order?.amount ?? course?.price ?? 0;
  const title = order?.course_title ?? course?.title ?? "";
  const learnHref = `/learn/${order?.course_slug ?? slug}`;

  return (
    <Shell title={order ? `Đơn hàng ${order.code}` : "Thanh toán"}>
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {enrolled && !order && (
            <Notice icon="🎉" title="Bạn đã có quyền truy cập khóa học này" text="Không cần thanh toán lại.">
              <Link href={learnHref} className="btn-primary">▶ Vào học ngay</Link>
            </Notice>
          )}
          {!enrolled && !order && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
              <h2 className="font-semibold text-slate-900">Cách thanh toán</h2>
              <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-slate-600">
                <li>Bấm <b>Xác nhận đặt hàng</b> để nhận mã đơn và mã QR.</li>
                <li>Chuyển khoản đúng số tiền, nội dung là mã đơn (quét QR sẽ tự điền).</li>
                <li>Chúng tôi xác nhận trong giờ làm việc, thường dưới 30 phút. Khóa học tự mở khi được duyệt.</li>
              </ol>
              <p className="mt-3 text-xs text-slate-500">Người nhận tài liệu: <b>{user.full_name}</b> · {user.email}</p>
              {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
              <button onClick={createOrder} disabled={busy} className="btn-primary mt-5 w-full !py-3 disabled:opacity-60">
                {busy ? "Đang tạo đơn…" : `Xác nhận đặt hàng · ${formatVND(price)}`}
              </button>
            </div>
          )}
          {order && <PaymentInstructions order={order} onRefresh={refresh} onCancel={cancel} busy={busy} learnHref={learnHref} />}
          {order && error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        </div>

        <aside className="rounded-2xl border border-slate-200 bg-white p-6 lg:self-start">
          <h2 className="font-semibold">Đơn hàng</h2>
          <div className={`mt-4 grid aspect-video place-items-center rounded-xl bg-gradient-to-br ${order?.course_color ?? course?.color} text-4xl`}>
            {order?.course_emoji ?? course?.emoji}
          </div>
          <p className="mt-3 font-medium text-slate-800">{title}</p>
          {course && <p className="mt-1 text-xs text-slate-500">{course.lessons.length} bài học · truy cập trọn đời</p>}
          <div className="mt-4 flex justify-between border-t border-slate-200 pt-4 font-bold">
            <span>Tổng</span><span className="text-brand-700">{formatVND(price)}</span>
          </div>
          <Link href={`/courses/${order?.course_slug ?? slug}`} className="mt-3 block text-sm text-brand-700 hover:underline">← Xem lại trang khóa học</Link>
        </aside>
      </div>
    </Shell>
  );
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="container-x py-12">
      <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
      <div className="mt-6">{children}</div>
    </div>
  );
}

function Notice({ icon, title, text, children }: { icon: string; title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-card">
      <p className="text-5xl">{icon}</p>
      <p className="mt-3 text-lg font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-slate-600">{text}</p>
      {children && <div className="mt-5 flex flex-wrap justify-center gap-3">{children}</div>}
    </div>
  );
}

function Empty() {
  return (
    <Notice icon="🛒" title="Chưa chọn khóa học" text="Hãy chọn một khóa học trả phí rồi bấm Mua ngay.">
      <Link href="/courses" className="btn-primary">Xem khóa học</Link>
    </Notice>
  );
}
