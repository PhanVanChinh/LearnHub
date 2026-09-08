"use client";
import { useState } from "react";

export default function AiCheckDemo() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<null | { plag: number; ai: number }>(null);
  const [loading, setLoading] = useState(false);

  const run = () => {
    if (!text.trim()) return;
    setLoading(true);
    setResult(null);
    // Demo: giả lập kết quả. Thay bằng gọi API thật ở đây.
    setTimeout(() => {
      const seed = text.length % 37;
      setResult({ plag: 8 + seed, ai: 5 + ((seed * 3) % 40) });
      setLoading(false);
    }, 1200);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
      <label className="text-sm font-semibold text-slate-800">Dán nội dung cần kiểm tra (demo)</label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        placeholder="Dán một đoạn văn bản từ tiểu luận / báo cáo của bạn…"
        className="input mt-2 resize-y"
      />
      <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
        <span>{text.trim().split(/\s+/).filter(Boolean).length} từ</span>
        <button onClick={run} disabled={loading || !text.trim()} className="btn-primary disabled:opacity-50">
          {loading ? "Đang phân tích…" : "Kiểm tra ngay"}
        </button>
      </div>
      {result && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {[
            { l: "Tỷ lệ trùng lặp", v: result.plag, c: "bg-rose-500" },
            { l: "Khả năng do AI viết", v: result.ai, c: "bg-violet-500" },
          ].map((m) => (
            <div key={m.l} className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm text-slate-600">{m.l}</p>
              <p className="mt-1 text-3xl font-bold text-slate-900">{m.v}%</p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full ${m.c}`} style={{ width: `${m.v}%` }} />
              </div>
            </div>
          ))}
          <p className="text-xs text-slate-500 sm:col-span-2">* Đây là kết quả mô phỏng cho mục đích demo giao diện.</p>
        </div>
      )}
    </div>
  );
}
