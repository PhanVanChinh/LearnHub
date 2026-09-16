"use client";
import { useCallback, useEffect, useState } from "react";
import { AdminOrder, adminApi, OrderStatus } from "@/lib/api";
import { formatVND } from "@/lib/site";
import { ORDER_STATUS } from "@/components/MyOrders";
import { ErrorBox, Pager, tableCls, tdCls, thCls } from "./ui";

const LIMIT = 20;
const utc = (iso: string) => new Date(/Z|[+-]\d\d:\d\d$/.test(iso) ? iso : iso + "Z");
const fmt = (iso: string) => utc(iso).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default function OrdersPanel({ onChanged }: { onChanged: () => void }) {
  const [status, setStatus] = useState<OrderStatus | "">("pending");
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<{ total: number; items: AdminOrder[] } | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(() => {
    adminApi.orders({ status, q: q.trim() || undefined, limit: LIMIT, offset }).then(setData).catch((e) => setError(e.message));
  }, [status, q, offset]);
  useEffect(load, [load]);

  const act = async (o: AdminOrder, kind: "confirm" | "cancel") => {
    const msg = kind === "confirm"
      ? `Xác nhận ĐÃ NHẬN ${formatVND(o.amount)} cho đơn ${o.code} của ${o.user_email}?\nKhóa "${o.course_title}" sẽ mở ngay cho người mua.\n\nGhi chú (tuỳ chọn, vd mã giao dịch):`
      : `Huỷ đơn ${o.code}? Ghi chú (tuỳ chọn):`;
    const note = prompt(msg, "");
    if (note === null) return;
    setBusyId(o.id); setError("");
    try {
      if (kind === "confirm") await adminApi.confirmOrder(o.id, note); else await adminApi.cancelOrder(o.id, note);
      load(); onChanged();
    } catch (e) { setError((e as Error).message); } finally { setBusyId(null); }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {([["pending", "Chờ thanh toán"], ["paid", "Đã thanh toán"], ["cancelled", "Đã huỷ"], ["expired", "Hết hạn"], ["", "Tất cả"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => { setStatus(k); setOffset(0); }}
            className={`chip ${status === k ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-brand-300"}`}>{l}</button>
        ))}
        <input value={q} onChange={(e) => { setQ(e.target.value); setOffset(0); }} placeholder="Tìm mã đơn / email…" className="input ml-auto sm:w-64" />
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Đối soát: mở app ngân hàng, tìm giao dịch có <b>nội dung = mã đơn</b> và <b>đúng số tiền</b>, rồi bấm Xác nhận. Khóa học mở ngay cho người mua.
      </p>
      <div className="mt-3"><ErrorBox message={error} /></div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className={tableCls}>
          <thead><tr>
            <th className={thCls}>Mã đơn</th><th className={thCls}>Người mua</th><th className={thCls}>Khóa học</th>
            <th className={thCls}>Số tiền</th><th className={thCls}>Trạng thái</th><th className={thCls}>Thời gian</th><th className={thCls}></th>
          </tr></thead>
          <tbody>
            {!data && <tr><td className={tdCls} colSpan={7}>Đang tải…</td></tr>}
            {data?.items.length === 0 && <tr><td className={`${tdCls} text-slate-500`} colSpan={7}>Không có đơn nào.</td></tr>}
            {data?.items.map((o) => {
              const st = ORDER_STATUS[o.status];
              return (
                <tr key={o.id} className="hover:bg-slate-50/60">
                  <td className={`${tdCls} font-mono font-semibold text-slate-900`}>{o.code}</td>
                  <td className={tdCls}>
                    <div className="text-slate-900">{o.user_name}</div>
                    <div className="text-xs text-slate-500">{o.user_email}</div>
                  </td>
                  <td className={tdCls}>
                    <div className="max-w-[18rem] truncate font-medium text-slate-900">{o.course_emoji} {o.course_title}</div>
                    {o.note && <div className="mt-0.5 max-w-[18rem] truncate text-xs text-slate-500" title={o.note}>📝 {o.note}</div>}
                  </td>
                  <td className={`${tdCls} whitespace-nowrap font-semibold text-brand-700`}>{formatVND(o.amount)}</td>
                  <td className={tdCls}>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${st.cls}`}>{st.label}</span>
                    {o.confirmed_by_email && <div className="mt-0.5 text-xs text-slate-500">bởi {o.confirmed_by_email}</div>}
                  </td>
                  <td className={`${tdCls} whitespace-nowrap text-xs text-slate-600`}>
                    <div>tạo {fmt(o.created_at)}</div>
                    {o.status === "pending" && <div className="text-amber-700">hạn {fmt(o.expires_at)}</div>}
                    {o.paid_at && <div className="text-emerald-700">duyệt {fmt(o.paid_at)}</div>}
                  </td>
                  <td className={`${tdCls} whitespace-nowrap text-right`}>
                    {(o.status === "pending" || o.status === "expired") && (
                      <button onClick={() => act(o, "confirm")} disabled={busyId === o.id} className="btn-primary !px-2.5 !py-1 disabled:opacity-60">✓ Đã nhận tiền</button>
                    )}
                    {o.status === "pending" && (
                      <button onClick={() => act(o, "cancel")} disabled={busyId === o.id} className="btn-outline ml-1 !px-2.5 !py-1 !text-rose-600 hover:!border-rose-300 disabled:opacity-60">Huỷ</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {data && <Pager total={data.total} limit={LIMIT} offset={offset} onChange={setOffset} />}
    </div>
  );
}
