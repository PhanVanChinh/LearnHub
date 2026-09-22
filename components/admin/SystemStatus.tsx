"use client";
import { useEffect, useState } from "react";
import { adminApi, HealthConfig } from "@/lib/api";

const SERVICES: { key: keyof HealthConfig["services"]; label: string; hint: string }[] = [
  { key: "mail", label: "Gửi email", hint: "RESEND_API_KEY" },
  { key: "bank_qr", label: "QR chuyển khoản", hint: "BANK_*" },
  { key: "google_login", label: "Đăng nhập Google", hint: "GOOGLE_CLIENT_ID" },
  { key: "captcha", label: "Captcha", hint: "TURNSTILE_SECRET_KEY" },
  { key: "file_storage", label: "Kho file tài liệu", hint: "S3_*" },
  { key: "ai_check", label: "AI Check", hint: "ANTHROPIC_API_KEY" },
  { key: "publish_button", label: "Nút Xuất bản", hint: "GITHUB_TOKEN" },
];

/** Thẻ "Hệ thống" trên bảng điều khiển: môi trường, DB, dịch vụ đã cấu hình, cảnh báo cấu hình. */
export default function SystemStatus() {
  const [d, setD] = useState<HealthConfig | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  useEffect(() => { adminApi.healthConfig().then(setD).catch(() => setD(null)); }, []);
  if (d === undefined) return <div className="h-28 animate-pulse rounded-2xl bg-slate-100" />;
  if (d === null) return null;
  const on = (k: keyof HealthConfig["services"]) => (k === "mail" ? d.services.mail === "resend" : !!d.services[k]);
  const enabled = SERVICES.filter((s) => on(s.key)).length;
  const prod = d.env === "production";
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-900">Hệ thống</p>
          <p className="mt-1 text-sm text-slate-500">
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${prod ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{d.env}</span>
            <span className="ml-2">DB: <b className={d.database === "postgres" ? "text-slate-800" : "text-amber-700"}>{d.database}</b></span>
            <span className="ml-2">· {enabled}/{SERVICES.length} dịch vụ đã cấu hình</span>
          </p>
        </div>
        <button onClick={() => setOpen(!open)} className="btn-outline !px-3 !py-1.5 text-sm">{open ? "Thu gọn" : "Chi tiết"}</button>
      </div>
      {(d.errors.length > 0 || (open && d.warnings.length > 0)) && (
        <ul className="mt-3 space-y-1 text-xs">
          {d.errors.map((e) => <li key={e} className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-rose-700">⛔ {e}</li>)}
          {open && d.warnings.map((w) => <li key={w} className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-amber-700">⚠️ {w}</li>)}
        </ul>
      )}
      {open && (
        <ul className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
          {SERVICES.map((s) => (
            <li key={s.key} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5">
              <span className="text-slate-700">{on(s.key) ? "✅" : "⬜"} {s.label}</span>
              {!on(s.key) && <code className="text-[11px] text-slate-400">{s.hint}</code>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
