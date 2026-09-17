"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import { aiCheckApi, AiCheckResult, AiCheckStatus, ApiError } from "@/lib/api";

const CONF: Record<AiCheckResult["confidence"], { label: string; cls: string }> = {
  low: { label: "Độ tin cậy thấp", cls: "bg-slate-100 text-slate-600" },
  medium: { label: "Độ tin cậy trung bình", cls: "bg-amber-50 text-amber-700" },
  high: { label: "Độ tin cậy cao", cls: "bg-emerald-50 text-emerald-700" },
};
const scoreTone = (s: number) => (s >= 70 ? "text-rose-600" : s >= 40 ? "text-amber-600" : "text-emerald-600");
const barTone = (s: number) => (s >= 70 ? "bg-rose-500" : s >= 40 ? "bg-amber-500" : "bg-emerald-500");

/** AI Check thật: gửi văn bản lên backend → Claude phân tích → điểm, dấu hiệu, đoạn đáng chú ý, gợi ý sửa. */
export default function AiCheckTool() {
  const { user, loading } = useAuth();
  const [status, setStatus] = useState<AiCheckStatus | null | undefined>(undefined);
  const [text, setText] = useState("");
  const [result, setResult] = useState<AiCheckResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (loading) return;
    aiCheckApi.status().then(setStatus).catch(() => setStatus(null));
  }, [user, loading]);
  useEffect(() => {
    if (!busy) return;
    setElapsed(0);
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [busy]);

  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const minWords = status?.min_words ?? 80;
  const maxChars = status?.max_chars ?? 15000;
  const canRun = !!status?.enabled && !!user?.email_verified && words >= minWords && text.length <= maxChars && (status?.remaining ?? 0) > 0;

  const run = async () => {
    setBusy(true); setError(""); setResult(null);
    try {
      const r = await aiCheckApi.run(text.trim());
      setResult(r);
      setStatus((s) => (s ? { ...s, used_today: s.daily_limit - r.remaining, remaining: r.remaining } : s));
    } catch (e) { setError((e as ApiError).message); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      {/* Trạng thái / điều kiện dùng */}
      {status === null && <Notice tone="rose" text="Không kết nối được máy chủ. Hãy kiểm tra backend đã chạy chưa." />}
      {status && !status.enabled && (
        <Notice tone="amber" text="AI Check chưa được kích hoạt trên hệ thống này (thiếu khoá dịch vụ phân tích). Quản trị viên cần cấu hình trước khi dùng." />
      )}
      {status?.enabled && !loading && !user && (
        <Notice tone="brand" text="Đăng nhập để dùng AI Check. Mỗi tài khoản có hạn mức lượt kiểm tra mỗi ngày.">
          <Link href="/login?next=/ai-check" className="btn-primary !px-3 !py-1.5">Đăng nhập</Link>
        </Notice>
      )}
      {status?.enabled && user && !user.email_verified && (
        <Notice tone="amber" text="Xác thực email để bắt đầu kiểm tra.">
          <Link href="/verify?next=/ai-check" className="btn-primary !px-3 !py-1.5">Nhập mã xác thực</Link>
        </Notice>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="ai-text" className="text-sm font-semibold text-slate-800">Dán nội dung cần kiểm tra</label>
          {status?.enabled && user && (
            <span className="text-xs text-slate-500">Còn <b className={status.remaining ? "text-slate-800" : "text-rose-600"}>{status.remaining}/{status.daily_limit}</b> lượt trong 24 giờ</span>
          )}
        </div>
        <textarea id="ai-text" value={text} onChange={(e) => { setText(e.target.value); setError(""); }} rows={10} maxLength={maxChars}
          placeholder={`Dán một phần tiểu luận / báo cáo (từ ${minWords} từ). Không cần dán cả bài, hãy chọn phần bạn băn khoăn nhất.`}
          className="input mt-2 resize-y font-[inherit]" disabled={busy} />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
          <span>
            {words} từ · {text.length.toLocaleString("vi-VN")}/{maxChars.toLocaleString("vi-VN")} ký tự
            {words > 0 && words < minWords && <span className="text-amber-600"> · cần thêm {minWords - words} từ</span>}
          </span>
          <button onClick={run} disabled={busy || !canRun} className="btn-primary disabled:opacity-50">
            {busy ? `Đang phân tích… ${elapsed}s` : "Kiểm tra ngay"}
          </button>
        </div>
        {busy && <p className="mt-2 text-xs text-slate-500">Claude đang đọc toàn bộ văn bản, thường mất 15–60 giây tuỳ độ dài.</p>}
        {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      </div>

      {result && <ResultView r={result} />}

      <p className="text-xs leading-5 text-slate-500">
        * Kết quả do mô hình ngôn ngữ ước lượng, <b>chỉ mang tính tham khảo</b> để bạn tự chỉnh sửa. Không công cụ nào phát hiện chắc chắn văn bản AI,
        nên không dùng kết quả này làm bằng chứng. Công cụ không đối chiếu với nguồn trên internet, do đó không kết luận về đạo văn.
        Văn bản của bạn không được lưu lại sau khi phân tích.
      </p>
    </div>
  );
}

function ResultView({ r }: { r: AiCheckResult }) {
  const conf = CONF[r.confidence] ?? CONF.low;
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="grid gap-6 sm:grid-cols-[12rem_1fr]">
          <div>
            <p className="text-sm text-slate-600">Khả năng do AI viết</p>
            <p className={`mt-1 text-5xl font-extrabold ${scoreTone(r.ai_score)}`}>{r.ai_score}%</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full ${barTone(r.ai_score)}`} style={{ width: `${r.ai_score}%` }} /></div>
            <span className={`mt-3 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${conf.cls}`}>{conf.label}</span>
          </div>
          <div>
            <p className="font-semibold text-slate-900">{r.verdict}</p>
            {r.signals.length > 0 && (
              <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
                {r.signals.map((s, i) => <li key={i} className="flex gap-2"><span className="text-slate-400">•</span><span>{s}</span></li>)}
              </ul>
            )}
            <p className="mt-3 text-xs text-slate-400">{r.words} từ · phân tích bởi {r.model}</p>
          </div>
        </div>
      </div>

      {r.segments.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
          <h3 className="font-semibold text-slate-900">Đoạn đáng chú ý</h3>
          <ul className="mt-3 divide-y divide-slate-100">
            {r.segments.map((s, i) => (
              <li key={i} className="flex flex-wrap items-start gap-3 py-3">
                <span className={`w-14 shrink-0 text-lg font-bold ${scoreTone(s.ai_likelihood)}`}>{s.ai_likelihood}%</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm italic text-slate-700">“{s.text}”</p>
                  <p className="mt-1 text-xs text-slate-500">{s.reason}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
          <h3 className="font-semibold text-slate-900">Gợi ý chỉnh sửa</h3>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-700">{r.suggestions.map((s, i) => <li key={i}>{s}</li>)}</ol>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
          <h3 className="font-semibold text-slate-900">Nhận xét học thuật</h3>
          <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700">{r.writing_feedback}</p>
        </div>
      </div>
    </div>
  );
}

function Notice({ tone, text, children }: { tone: "rose" | "amber" | "brand"; text: string; children?: React.ReactNode }) {
  const cls = { rose: "border-rose-200 bg-rose-50 text-rose-800", amber: "border-amber-200 bg-amber-50 text-amber-800", brand: "border-brand-200 bg-brand-50 text-brand-800" }[tone];
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm ${cls}`}>
      <span>{text}</span>{children}
    </div>
  );
}
