"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { OrderDetail } from "@/lib/api";
import { formatVND } from "@/lib/site";

const utc = (iso: string) => new Date(/Z|[+-]\d\d:\d\d$/.test(iso) ? iso : iso + "Z");
const fmtTime = (iso: string) => utc(iso).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });

/** Khối hướng dẫn chuyển khoản + trạng thái đơn. */
export default function PaymentInstructions({ order, onRefresh, onCancel, busy, learnHref }: {
  order: OrderDetail; onRefresh: () => void; onCancel: () => void; busy: boolean; learnHref: string;
}) {
  const pay = order.payment;

  if (order.status === "paid") {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <p className="text-5xl">🎉</p>
        <p className="mt-3 text-lg font-semibold text-emerald-800">Thanh toán đã được xác nhận</p>
        <p className="mt-1 text-sm text-emerald-700">Đơn {order.code} · {order.paid_at && fmtTime(order.paid_at)}. Khóa học đã mở trong tài khoản của bạn.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link href={learnHref} className="btn-primary">▶ Vào học ngay</Link>
          <Link href="/my-courses" className="btn-outline">Khóa học của tôi</Link>
        </div>
      </div>
    );
  }
  if (order.status !== "pending") {
    const label = order.status === "cancelled" ? "Đơn đã huỷ" : "Đơn đã hết hạn thanh toán";
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-card">
        <p className="text-5xl">{order.status === "cancelled" ? "🗑️" : "⌛"}</p>
        <p className="mt-3 text-lg font-semibold text-slate-900">{label}</p>
        <p className="mt-1 text-sm text-slate-600">Nếu bạn đã chuyển khoản cho đơn này, hãy liên hệ hỗ trợ kèm mã <b>{order.code}</b>.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link href={`/checkout?course=${order.course_slug}`} className="btn-primary">Đặt lại đơn mới</Link>
          <Link href="/contact" className="btn-outline">Liên hệ hỗ trợ</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-900">Chuyển khoản để hoàn tất</h2>
          <p className="mt-1 text-sm text-slate-500">Đơn tạo lúc {fmtTime(order.created_at)} · hết hạn {fmtTime(order.expires_at)}</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
          <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" /> Đang chờ thanh toán
        </span>
      </div>

      <div className="mt-5 grid gap-6 sm:grid-cols-[14rem_1fr]">
        <div className="flex flex-col items-center">
          {pay?.qr_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pay.qr_url} alt={`QR chuyển khoản ${order.code}`} className="w-56 rounded-xl border border-slate-200" />
          ) : (
            <div className="grid aspect-square w-56 place-items-center rounded-xl border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500">
              Chưa cấu hình QR. Chuyển khoản theo thông tin bên cạnh.
            </div>
          )}
          <p className="mt-2 text-center text-xs text-slate-500">Quét bằng app ngân hàng, số tiền và nội dung tự điền.</p>
        </div>
        <dl className="space-y-2 text-sm">
          {pay?.bank_name && <Row k="Ngân hàng" v={pay.bank_name} />}
          {pay?.account_number && <Row k="Số tài khoản" v={pay.account_number} copy />}
          {pay?.account_name && <Row k="Chủ tài khoản" v={pay.account_name} />}
          <Row k="Số tiền" v={formatVND(order.amount)} copy={String(order.amount)} highlight />
          <Row k="Nội dung" v={order.code} copy highlight />
          <p className="pt-1 text-xs text-slate-500">Nhập <b>đúng nội dung {order.code}</b> để hệ thống đối soát. Sai nội dung có thể chậm xác nhận.</p>
        </dl>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
        <p className="text-xs text-slate-500">Trang này tự cập nhật khi được xác nhận. Bạn có thể đóng và xem lại ở <Link href="/orders" className="text-brand-700 hover:underline">Đơn hàng của tôi</Link>.</p>
        <div className="flex gap-2">
          <button onClick={onRefresh} className="btn-outline !px-3 !py-1.5 text-sm">Kiểm tra lại</button>
          <button onClick={onCancel} disabled={busy} className="btn !px-3 !py-1.5 text-sm text-rose-600 hover:bg-rose-50 disabled:opacity-50">Huỷ đơn</button>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v, copy, highlight }: { k: string; v: string; copy?: boolean | string; highlight?: boolean }) {
  const [done, setDone] = useState(false);
  useEffect(() => { if (!done) return; const t = setTimeout(() => setDone(false), 1500); return () => clearTimeout(t); }, [done]);
  const text = typeof copy === "string" ? copy : v;
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
      <dt className="text-slate-500">{k}</dt>
      <dd className="flex items-center gap-2">
        <span className={highlight ? "font-mono text-base font-bold text-brand-700" : "font-medium text-slate-800"}>{v}</span>
        {copy && (
          <button type="button" onClick={() => { navigator.clipboard?.writeText(text).then(() => setDone(true)).catch(() => {}); }}
            className="rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-200" aria-label={`Sao chép ${k}`}>
            {done ? "✓" : "Sao chép"}
          </button>
        )}
      </dd>
    </div>
  );
}
