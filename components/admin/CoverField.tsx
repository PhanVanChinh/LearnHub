"use client";
import { useRef, useState } from "react";
import { adminApi } from "@/lib/api";
import { coverUrl } from "@/lib/cover";
import { Field } from "./ui";

/** Ảnh bìa khóa học: tải file lên S3 hoặc dán URL ảnh ngoài. Trống → thẻ dùng gradient + emoji như trước. */
export default function CoverField({ slug, value, onChange, color, emoji }: { slug: string; value: string; onChange: (v: string) => void; color: string; emoji: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  const url = coverUrl(value);

  const upload = async (file: File) => {
    if (!slug) return setError("Nhập slug khóa học trước khi tải ảnh.");
    setBusy(true); setError("");
    try { onChange((await adminApi.upload(file, slug, "cover")).key); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <Field label="Ảnh bìa" hint="Tỉ lệ 16:9, nên ≥ 1280×720. Bỏ trống → dùng nền gradient + emoji.">
      <div className="flex flex-wrap items-start gap-4">
        <div className="w-48 shrink-0 overflow-hidden rounded-xl border border-slate-200">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="Ảnh bìa" className="aspect-video w-full object-cover" />
          ) : (
            <div className={`grid aspect-video place-items-center bg-gradient-to-br text-3xl ${color}`}>{emoji}</div>
          )}
        </div>
        <div className="min-w-[14rem] flex-1 space-y-2">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => ref.current?.click()} disabled={busy} className="btn-outline disabled:opacity-60">
              {busy ? "Đang tải…" : url ? "Đổi ảnh" : "⬆ Tải ảnh lên"}
            </button>
            {value && <button type="button" onClick={() => onChange("")} className="btn-outline-danger">Gỡ ảnh</button>}
            <input ref={ref} type="file" accept="image/*" className="hidden" aria-label="Chọn ảnh bìa"
              onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(file); e.target.value = ""; }} />
          </div>
          <input className="input font-mono text-xs" aria-label="URL ảnh bìa" placeholder="hoặc dán URL ảnh: https://…" value={value} onChange={(e) => onChange(e.target.value)} />
          {error && <p className="text-xs text-rose-600">{error}</p>}
        </div>
      </div>
    </Field>
  );
}
