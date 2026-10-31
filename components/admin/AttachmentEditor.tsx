"use client";
import { useEffect, useRef, useState } from "react";
import { adminApi, Attachment, UploadStatus } from "@/lib/api";
import { fmtSize } from "@/components/LessonAttachments";
import { AskFn, Field } from "./ui";
import { clampLesson, lessonTitles } from "./LessonChips";

/** Tài liệu đính kèm theo bài: kéo thả / chọn file (lên S3) hoặc thêm link ngoài. Lưu vào lesson.attachments khi bấm Lưu. */
export default function AttachmentEditor({ lessonsText, slug, attachments, setAttachments, lesson, ask }: {
  lessonsText: string; slug: string; attachments: Record<number, Attachment[]>;
  setAttachments: (v: Record<number, Attachment[]>) => void; lesson: number; ask: AskFn;
}) {
  const titles = lessonTitles(lessonsText);
  const idx = clampLesson(lesson, titles);
  const list = attachments[idx] ?? [];
  const [status, setStatus] = useState<UploadStatus | null>(null);
  const [uploading, setUploading] = useState<string[]>([]);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState("");
  const [link, setLink] = useState({ name: "", url: "" });
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { adminApi.uploadStatus().then(setStatus).catch(() => setStatus(null)); }, []);

  const update = (next: Attachment[]) => setAttachments({ ...attachments, [idx]: next });

  const addFiles = async (files: FileList | File[]) => {
    if (!slug) return setError("Nhập slug khóa học trước khi tải file (file được xếp theo slug).");
    setError("");
    for (const file of Array.from(files)) {
      setUploading((u) => [...u, file.name]);
      try {
        const up = await adminApi.upload(file, slug);
        update([...(attachments[idx] ?? []), { name: up.name, kind: "file", key: up.key, size: up.size, content_type: up.content_type }]);
      } catch (e) { setError(`${file.name}: ${(e as Error).message}`); }
      finally { setUploading((u) => u.filter((n) => n !== file.name)); }
    }
  };
  const addLink = () => {
    const url = link.url.trim();
    if (!/^https?:\/\//.test(url)) return setError("Link phải bắt đầu bằng http:// hoặc https://");
    update([...list, { name: link.name.trim() || url.replace(/^https?:\/\//, "").slice(0, 60), kind: "link", url, size: 0, content_type: "" }]);
    setLink({ name: "", url: "" }); setError("");
  };
  const remove = async (i: number) => {
    const a = list[i];
    if (!(await ask({ title: `Gỡ «${a.name}»?`, message: a.kind === "file" ? "File cũng bị xóa khỏi kho lưu trữ, không khôi phục được." : "Chỉ gỡ link khỏi bài.", confirmLabel: "Gỡ", danger: true })).ok) return;
    if (a.kind === "file" && a.key) { try { await adminApi.deleteUpload(a.key); } catch { /* file có thể đã mất; vẫn gỡ khỏi bài */ } }
    update(list.filter((_, j) => j !== i));
  };
  const rename = (i: number, name: string) => update(list.map((a, j) => (j === i ? { ...a, name } : a)));

  if (titles.length === 0) return null;
  const counts = titles.map((_, i) => attachments[i]?.length ?? 0);
  return (
    <Field label="Tài liệu theo bài" hint="PDF, slide, đề mẫu… Người học chỉ tải được khi bài free hoặc đã ghi danh. Chọn bài ở dãy nút bên trên (dùng chung với Trắc nghiệm).">
      <p className="text-xs text-slate-500">Đang sửa: <b>Bài {idx + 1}. {titles[idx]}</b>{counts.some(Boolean) && <> · tổng {counts.reduce((a, b) => a + b, 0)} tài liệu</>}</p>
      {list.length > 0 && (
        <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
          {list.map((a, i) => (
            <li key={`${a.key ?? a.url}-${i}`} className="flex items-center gap-2 px-3 py-2 text-sm">
              <span>{a.kind === "link" ? "🔗" : "📎"}</span>
              <input value={a.name} onChange={(e) => rename(i, e.target.value)} className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 hover:border-slate-200 focus:border-brand-400 focus:outline-none" />
              <span className="shrink-0 text-xs text-slate-500">{a.kind === "link" ? "link" : fmtSize(a.size)}</span>
              <button type="button" onClick={() => remove(i)} className="shrink-0 text-xs text-rose-600 hover:underline">Gỡ</button>
            </li>
          ))}
        </ul>
      )}
      {status?.enabled ? (
        <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); void addFiles(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inputRef.current?.click(); } }}
          role="button" tabIndex={0} aria-label="Chọn hoặc kéo thả file tài liệu để tải lên"
          className={`mt-2 cursor-pointer rounded-lg border-2 border-dashed focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 p-4 text-center text-sm transition ${drag ? "border-brand-500 bg-brand-50" : "border-slate-300 bg-slate-50 hover:border-brand-300"}`}>
          {uploading.length ? <span className="text-brand-700">Đang tải lên {uploading.join(", ")}…</span>
            : <span className="text-slate-600">Kéo thả file vào đây hoặc <span className="font-medium text-brand-700">chọn file</span> · tối đa {status.max_mb} MB · {status.allowed.join(", ")}</span>}
          <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => { if (e.target.files) void addFiles(e.target.files); e.target.value = ""; }} />
        </div>
      ) : (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {status === null ? "Không đọc được trạng thái kho lưu trữ." : "Chưa cấu hình kho lưu trữ file (S3_* trong backend/.env) — hiện chỉ thêm được link ngoài."}
        </p>
      )}
      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
        <input className="input" placeholder="Tên hiển thị (tùy chọn)" value={link.name} onChange={(e) => setLink({ ...link, name: e.target.value })} />
        <input className="input" placeholder="https://drive.google.com/… hoặc link tài liệu ngoài" value={link.url} onChange={(e) => setLink({ ...link, url: e.target.value })}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLink(); } }} />
        <button type="button" onClick={addLink} className="btn-outline">+ Thêm link</button>
      </div>
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </Field>
  );
}
