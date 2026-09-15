"use client";
import { useEffect, useState } from "react";
import { adminApi, ApiError, PublishStatus } from "@/lib/api";

/** Nút "Xuất bản": kích hoạt GitHub Actions build lại site tĩnh từ DB. Người đã mở trang thấy bản mới qua API,
 *  nhưng khóa học MỚI và HTML cho SEO chỉ có sau khi build lại. */
export default function PublishButton() {
  const [st, setSt] = useState<PublishStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [firedAt, setFiredAt] = useState<number | null>(null);

  useEffect(() => { adminApi.publishStatus().then(setSt).catch(() => setSt(null)); }, []);

  const run = async () => {
    if (!confirm("Build lại website công khai từ dữ liệu hiện tại trong DB? Mất khoảng 2 phút.")) return;
    setBusy(true); setMsg(null);
    try {
      const r = await adminApi.publish();
      setMsg({ ok: true, text: r.detail }); setFiredAt(Date.now());
    } catch (e) {
      setMsg({ ok: false, text: (e as ApiError).message });
    } finally { setBusy(false); }
  };

  const disabled = busy || !st?.configured || (firedAt !== null && Date.now() - firedAt < 60_000);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">Xuất bản lên website</p>
          <p className="mt-1 text-sm text-slate-500">
            Sửa khóa học xong, bấm để build lại trang tĩnh. Khóa học mới và nội dung cho Google chỉ xuất hiện sau bước này.
          </p>
          {st && !st.configured && (
            <p className="mt-2 text-xs text-amber-700">Chưa cấu hình: đặt <code>GITHUB_TOKEN</code> và <code>GITHUB_REPO</code> trong <code>backend/.env</code>.</p>
          )}
          {msg && <p className={`mt-2 text-sm ${msg.ok ? "text-emerald-700" : "text-rose-600"}`}>{msg.text}</p>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <button onClick={run} disabled={disabled} className="btn-primary disabled:opacity-50">{busy ? "Đang gửi…" : "🚀 Xuất bản"}</button>
          {st && (
            <div className="flex gap-3 text-xs">
              <a href={st.actions_url} target="_blank" rel="noreferrer" className="text-brand-700 hover:underline">Theo dõi build ↗</a>
              <a href={st.site_url} target="_blank" rel="noreferrer" className="text-slate-500 hover:underline">Mở site ↗</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
