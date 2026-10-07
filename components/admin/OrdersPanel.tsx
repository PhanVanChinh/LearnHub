"use client";
import { useCallback, useEffect, useState } from "react";
import { AdminOrder, adminApi, OrderStatus } from "@/lib/api";
import { formatVND } from "@/lib/site";
import { ORDER_STATUS } from "@/components/MyOrders";
import { ErrorBox, Pager, tableCls, tdCls, thCls, useDialog } from "./ui";

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

  const { ask, dialog } = useDialog();
  const act = async (o: AdminOrder, kind: "confirm" | "cancel") => {
    const r = kind === "confirm"
      ? await ask({
          title: `Xác nhận đã nhận ${formatVND(o.amount)}`,
          message: `Đơn ${o.code} của ${o.user_email}. Khóa "${o.course_title}" sẽ mở ngay cho người mua và gửi email xác nhận.`,
          confirmLabel: "Đã nhận tiền",
          input: { label: "Mã giao dịch / ghi chú đối soát", required: true, placeholder: "VD: FT25100412345 · VCB 14:32 · nội dung CK đúng mã" },
        })
      : await ask({
          title: `Hủy đơn ${o.code}?`,
          message: `Người mua ${o.user_email} sẽ nhận email báo đơn đã hủy. Nếu họ đã chuyển khoản, hãy đối soát trước.`,
          confirmLabel: "Hủy đơn", danger: true,
          input: { label: "Lý do (người mua sẽ thấy)", placeholder: "VD: Không nhận được tiền sau 24 giờ" },
        });
    if (!r.ok) return;
    const note = r.value;
    setBusyId(o.id); setError("");
    try {
      if (kind === "confirm") await adminApi.confirmOrder(o.id, note); else await adminApi.cancelOrder(o.id, note);
      load(); onChanged();
    } catch (e) { setError((e as Error).message); } finally { setBusyId(null); }
  };

  return (
    <div>
      {dialog}
      <div className="flex flex-wrap items-center gap-2">
        {([["pending", "Chờ thanh toán"], ["paid", "Đã thanh toán"], ["cancelled", "Đã hủy"], ["expired", "Hết hạn"], ["", "Tất cả"]] as const).map(([k, l]) => (
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
                      <button onClick={() => act(o, "confirm")} disabled={busyId === o.id} className="btn-primary btn-xs disabled:opacity-60">✓ Đã nhận tiền</button>
                    )}
                    {o.status === "pending" && (
                      <button onClick={() => act(o, "cancel")} disabled={busyId === o.id} className="btn-outline-danger ml-1 btn-xs disabled:opacity-60">Hủy</button>
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
