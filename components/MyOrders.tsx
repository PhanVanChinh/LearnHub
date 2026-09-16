"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import PageHeader from "@/components/PageHeader";
import { Order, OrderStatus, ordersApi } from "@/lib/api";
import { formatVND } from "@/lib/site";

const utc = (iso: string) => new Date(/Z|[+-]\d\d:\d\d$/.test(iso) ? iso : iso + "Z");
const fmt = (iso: string) => utc(iso).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export const ORDER_STATUS: Record<OrderStatus, { label: string; cls: string }> = {
  pending: { label: "Chờ thanh toán", cls: "bg-amber-50 text-amber-700" },
  paid: { label: "Đã thanh toán", cls: "bg-emerald-50 text-emerald-700" },
  cancelled: { label: "Đã huỷ", cls: "bg-slate-100 text-slate-600" },
  expired: { label: "Hết hạn", cls: "bg-slate-100 text-slate-600" },
};

export default function MyOrders() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) return router.replace("/login?next=/orders");
    ordersApi.mine().then(setOrders).catch((e) => { setOrders([]); setError((e as Error).message); });
  }, [user, loading, router]);

  const pending = orders?.filter((o) => o.status === "pending").length ?? 0;

  return (
    <>
      <PageHeader eyebrow="Tài khoản" title="Đơn hàng của tôi"
        subtitle={pending ? `Bạn có ${pending} đơn đang chờ thanh toán. Mở đơn để xem mã QR và nội dung chuyển khoản.` : "Lịch sử mua khóa học trả phí."} />
      <div className="container-x py-10">
        {orders === null ? (
          <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-100" />)}</div>
        ) : orders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center">
            <p className="text-slate-600">{error || "Bạn chưa có đơn hàng nào."}</p>
            <Link href="/courses" className="btn-primary mt-4">Xem khóa học</Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {orders.map((o) => {
              const st = ORDER_STATUS[o.status];
              return (
                <li key={o.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:p-5">
                  <div className="flex flex-wrap items-center gap-4">
                    <span className={`grid h-14 w-20 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-2xl ${o.course_color}`}>{o.course_emoji}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/courses/${o.course_slug}`} className="truncate font-semibold text-slate-900 hover:text-brand-700">{o.course_title}</Link>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${st.cls}`}>{st.label}</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        Mã <span className="font-mono font-semibold text-slate-700">{o.code}</span> · {fmt(o.created_at)}
                        {o.status === "pending" && <> · hết hạn {fmt(o.expires_at)}</>}
                        {o.status === "paid" && o.paid_at && <> · duyệt {fmt(o.paid_at)}</>}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="font-bold text-brand-700">{formatVND(o.amount)}</span>
                      {o.status === "pending" && <Link href={`/checkout?order=${o.code}`} className="btn-primary !px-3 !py-1.5">Thanh toán</Link>}
                      {o.status === "paid" && <Link href={`/learn/${o.course_slug}`} className="btn !px-3 !py-1.5 bg-emerald-600 text-white hover:bg-emerald-700">▶ Vào học</Link>}
                      {(o.status === "cancelled" || o.status === "expired") && <Link href={`/checkout?course=${o.course_slug}`} className="btn-outline !px-3 !py-1.5">Đặt lại</Link>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
