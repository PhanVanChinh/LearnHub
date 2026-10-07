"use client";
import { useEffect, useState } from "react";
import { adminApi, downloadFile, RevenueReport } from "@/lib/api";
import { formatVND } from "@/lib/site";
import { ErrorBox } from "./ui";

const RANGES = [7, 30, 90] as const;
const fmtDay = (iso: string) => { const [, m, d] = iso.split("-"); return `${d}/${m}`; };
/** Trục tiền gọn: 1.200.000 → "1,2tr", 850.000 → "850k" */
const compact = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0).replace(".", ",")}tr` : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));

/** Tab Doanh thu: số tổng trong kỳ, cột theo ngày (một chuỗi, một màu), bảng theo khóa, tải CSV. */
export default function RevenuePanel() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const [data, setData] = useState<RevenueReport | null>(null);
  const [error, setError] = useState("");
  const [table, setTable] = useState(false);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    let alive = true;
    setData(null); setError("");
    adminApi.revenue(days).then((d) => alive && setData(d)).catch((e) => alive && setError(e.message));
    return () => { alive = false; };
  }, [days]);

  const exportCsv = async (kind: "orders" | "users" | "enrollments") => {
    setBusy(kind); setError("");
    try { await downloadFile(`/api/admin/export/${kind}.csv`); } catch (e) { setError((e as Error).message); } finally { setBusy(""); }
  };

  const max = data ? Math.max(1, ...data.by_day.map((d) => d.revenue)) : 1;
  const avg = data ? Math.round(data.total / data.days) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1" role="group" aria-label="Khoảng thời gian">
          {RANGES.map((r) => (
            <button key={r} onClick={() => setDays(r)} aria-pressed={days === r}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${days === r ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{r} ngày</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {([["orders", "Đơn hàng"], ["users", "Người dùng"], ["enrollments", "Ghi danh"]] as const).map(([k, label]) => (
            <button key={k} onClick={() => exportCsv(k)} disabled={!!busy} className="btn-outline btn-sm disabled:opacity-60">
              {busy === k ? "Đang tải…" : `⬇ CSV ${label}`}
            </button>
          ))}
        </div>
      </div>
      <ErrorBox message={error} />

      {/* Số tổng */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Doanh thu trong kỳ", data ? formatVND(data.total) : null, `${days} ngày gần nhất`],
          ["Đơn đã thanh toán", data ? data.orders.toLocaleString("vi-VN") : null, data && data.orders ? `TB ${formatVND(Math.round(data.total / data.orders))}/đơn` : "—"],
          ["Trung bình mỗi ngày", data ? formatVND(avg) : null, "theo ngày thanh toán"],
        ].map(([label, value, sub]) => (
          <div key={label as string} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <p className="text-sm text-slate-500">{label}</p>
            {value == null ? <div className="mt-2 h-8 w-32 animate-pulse rounded bg-slate-100" /> : <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>}
            <p className="mt-1 text-xs text-slate-500">{sub}</p>
          </div>
        ))}
      </div>

      {/* Theo ngày */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold text-slate-900">Doanh thu theo ngày</h3>
          <button onClick={() => setTable(!table)} className="text-sm font-medium text-brand-700 hover:underline" aria-pressed={table}>{table ? "Xem biểu đồ" : "Xem bảng"}</button>
        </div>
        {!data ? <div className="mt-4 h-44 animate-pulse rounded-lg bg-slate-100" /> : table ? (
          <div className="mt-4 max-h-80 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white text-left text-xs uppercase tracking-wider text-slate-500"><tr><th className="py-2">Ngày</th><th className="py-2 text-right">Đơn</th><th className="py-2 text-right">Doanh thu</th></tr></thead>
              <tbody>{data.by_day.map((d) => (
                <tr key={d.date} className="border-t border-slate-100"><td className="py-1.5">{fmtDay(d.date)}</td><td className="py-1.5 text-right">{d.orders}</td><td className="py-1.5 text-right font-medium">{formatVND(d.revenue)}</td></tr>
              ))}</tbody>
            </table>
          </div>
        ) : <DailyBars days={data.by_day} max={max} />}
      </div>

      {/* Theo khóa */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <h3 className="font-semibold text-slate-900">Theo khóa học</h3>
        {!data ? <div className="mt-4 h-24 animate-pulse rounded-lg bg-slate-100" /> : data.by_course.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Chưa có đơn thanh toán trong kỳ.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-slate-500"><tr><th className="py-2">Khóa học</th><th className="py-2 text-right">Đơn</th><th className="py-2 text-right">Doanh thu</th><th className="py-2 text-right">Tỷ trọng</th></tr></thead>
            <tbody>{data.by_course.map((c) => {
              const share = data.total ? Math.round((c.revenue * 100) / data.total) : 0;
              return (
                <tr key={c.slug} className="border-t border-slate-100">
                  <td className="py-2"><a href={`/courses/${c.slug}`} className="font-medium text-slate-800 hover:text-brand-700">{c.title}</a></td>
                  <td className="py-2 text-right">{c.orders}</td>
                  <td className="py-2 text-right font-medium">{formatVND(c.revenue)}</td>
                  <td className="py-2 text-right">
                    <span className="inline-flex items-center gap-2"><span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-brand-600" style={{ width: `${share}%` }} /></span>{share}%</span>
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/** Cột theo ngày: một chuỗi, một màu thương hiệu, đầu cột bo 4px, chân cột phẳng ở trục; rê chuột hiện tooltip; lưới mờ. */
function DailyBars({ days, max }: { days: RevenueReport["by_day"]; max: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720, H = 180, PAD_L = 44, PAD_B = 22, PAD_T = 8;
  const plotW = W - PAD_L - 8, plotH = H - PAD_B - PAD_T;
  const n = days.length;
  const slot = plotW / n;
  const bw = Math.max(2, Math.min(18, slot - 2)); // ≥2px khoảng cách giữa cột
  const y = (v: number) => PAD_T + plotH - (v / max) * plotH;
  const ticks = [0, 0.5, 1].map((t) => t * max);
  const labelEvery = n > 40 ? 15 : n > 10 ? 5 : 1;
  const h = hover == null ? null : days[hover];
  return (
    <div className="relative mt-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-44 w-full" role="img" aria-label={`Doanh thu ${n} ngày, cao nhất ${formatVND(max)}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD_L} x2={W - 8} y1={y(t)} y2={y(t)} stroke="#e2e8f0" strokeWidth="1" />
            <text x={PAD_L - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#64748b">{compact(t)}</text>
          </g>
        ))}
        {days.map((d, i) => {
          const x = PAD_L + i * slot + (slot - bw) / 2;
          const top = y(d.revenue), base = y(0), r = Math.min(4, bw / 2);
          const bar = d.revenue > 0
            ? `M${x},${base} L${x},${top + r} Q${x},${top} ${x + r},${top} L${x + bw - r},${top} Q${x + bw},${top} ${x + bw},${top + r} L${x + bw},${base} Z`
            : "";
          return (
            <g key={d.date} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              {/* vùng rê chuột rộng hơn cột */}
              <rect x={PAD_L + i * slot} y={PAD_T} width={slot} height={plotH} fill="transparent" />
              {bar && <path d={bar} fill="#2563eb" opacity={hover == null || hover === i ? 1 : 0.55} />}
              {d.revenue === 0 && <rect x={x} y={base - 1} width={bw} height={1} fill="#cbd5e1" />}
              {i % labelEvery === 0 && <text x={PAD_L + i * slot + slot / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="#64748b">{fmtDay(d.date)}</text>}
              <title>{`${fmtDay(d.date)}: ${formatVND(d.revenue)} · ${d.orders} đơn`}</title>
            </g>
          );
        })}
        <line x1={PAD_L} x2={W - 8} y1={y(0)} y2={y(0)} stroke="#cbd5e1" strokeWidth="1" />
      </svg>
      {h && hover != null && (
        <div role="tooltip" className="pointer-events-none absolute -top-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"
          style={{ left: `${((PAD_L + hover * slot + slot / 2) / W) * 100}%`, transform: `translateX(${hover > n / 2 ? "-100%" : "0"})` }}>
          <p className="font-semibold text-slate-900">{fmtDay(h.date)}</p>
          <p className="text-slate-600">{formatVND(h.revenue)} · {h.orders} đơn</p>
        </div>
      )}
    </div>
  );
}
