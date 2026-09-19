"use client";
import { useState } from "react";
import { ApiError, coursesApi } from "@/lib/api";

type Att = { name: string; kind: "file" | "link"; size: number; content_type: string };

const ICON: Record<string, string> = { pdf: "📕", doc: "📝", docx: "📝", ppt: "📊", pptx: "📊", xls: "📈", xlsx: "📈", zip: "🗜️", txt: "📄", md: "📄", csv: "📈", png: "🖼️", jpg: "🖼️", jpeg: "🖼️", webp: "🖼️" };
const ext = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";
export const fmtSize = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : b >= 1024 ? `${Math.round(b / 1024)} KB` : b ? `${b} B` : "");

/** Danh sách tài liệu của một bài. Bấm → xin link từ API (kiểm tra quyền ở server) rồi mở tab mới. `locked` = chưa có quyền. */
export default function LessonAttachments({ slug, index, attachments, locked, dark = true }: {
  slug: string; index: number; attachments: Att[]; locked: boolean; dark?: boolean;
}) {
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState("");
  if (!attachments.length) return null;

  const open = async (pos: number) => {
    setBusy(pos); setError("");
    try {
      const { url } = await coursesApi.attachmentLink(slug, index, pos);
      window.open(url, "_blank", "noopener");
    } catch (e) { setError((e as ApiError).message); } finally { setBusy(null); }
  };

  const wrap = dark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white";
  const row = dark ? "hover:bg-white/10 text-slate-200" : "hover:bg-slate-50 text-slate-800";
  const sub = dark ? "text-slate-400" : "text-slate-500";
  return (
    <div className={`rounded-xl border p-4 ${wrap}`}>
      <p className={`text-xs uppercase tracking-wider ${sub}`}>Tài liệu bài học · {attachments.length}</p>
      <ul className="mt-2 divide-y divide-white/10">
        {attachments.map((a, i) => (
          <li key={i}>
            <button onClick={() => open(i)} disabled={busy !== null || locked}
              className={`flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${row}`}>
              <span className="text-xl">{a.kind === "link" ? "🔗" : ICON[ext(a.name)] ?? "📎"}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{a.name}</span>
                <span className={`text-xs ${sub}`}>{a.kind === "link" ? "Liên kết ngoài" : `${ext(a.name).toUpperCase()}${a.size ? ` · ${fmtSize(a.size)}` : ""}`}</span>
              </span>
              <span className={`shrink-0 text-xs ${sub}`}>{locked ? "🔒" : busy === i ? "Đang mở…" : a.kind === "link" ? "Mở ↗" : "Tải ⬇"}</span>
            </button>
          </li>
        ))}
      </ul>
      {locked && <p className={`mt-2 text-xs ${sub}`}>Ghi danh khóa học để tải tài liệu.</p>}
      {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
    </div>
  );
}
