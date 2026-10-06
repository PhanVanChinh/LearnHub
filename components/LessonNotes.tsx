"use client";
import { useEffect, useRef, useState } from "react";
import { coursesApi } from "@/lib/api";

type Status = "loading" | "idle" | "typing" | "saving" | "saved" | "error";
const DEBOUNCE_MS = 1200;

/** Ghi chú riêng của người học cho bài đang xem. Tự lưu sau khi ngừng gõ, lưu nốt khi rời bài / đóng tab.
 *  Chỉ hiện khi đã đăng nhập và có quyền xem bài (server kiểm tra lại). Nền tối theo trang học. */
export default function LessonNotes({ slug, index }: { slug: string; index: number }) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status>("loading");
  const [open, setOpen] = useState(false);
  const saved = useRef("");           // nội dung đã lưu gần nhất, để không gửi lại khi không đổi
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const latest = useRef("");          // bản mới nhất, cho handler rời trang đọc được ngoài closure
  latest.current = text;

  useEffect(() => {
    let alive = true;
    setStatus("loading");
    coursesApi.note(slug, index)
      .then((n) => { if (!alive) return; saved.current = n.text; setText(n.text); setOpen(!!n.text); setStatus("idle"); })
      .catch(() => alive && setStatus("error"));
    return () => { alive = false; clearTimeout(timer.current); };
  }, [slug, index]);

  const save = async (value: string) => {
    if (value.trim() === saved.current.trim()) { setStatus("idle"); return; }
    setStatus("saving");
    try {
      const n = await coursesApi.saveNote(slug, index, value);
      saved.current = n.text;
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  };

  const onChange = (v: string) => {
    setText(v);
    setStatus("typing");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => save(v), DEBOUNCE_MS);
  };

  // Rời bài (đổi index/slug) hoặc đóng tab khi còn thay đổi chưa lưu → lưu thẳng, không đụng state
  // (state lúc đó đã thuộc bài mới; saved.current sẽ được nạp lại bởi effect tải ghi chú)
  useEffect(() => {
    const flush = () => {
      if (latest.current.trim() === saved.current.trim()) return;
      clearTimeout(timer.current);
      saved.current = latest.current;
      coursesApi.saveNote(slug, index, latest.current).catch(() => {});
    };
    window.addEventListener("pagehide", flush);
    return () => { window.removeEventListener("pagehide", flush); flush(); };
  }, [slug, index]);

  if (status === "loading") return null;

  const label = { idle: "", typing: "Đang gõ…", saving: "Đang lưu…", saved: "✓ Đã lưu", error: "Không lưu được, sẽ thử lại khi bạn gõ tiếp", loading: "" }[status];

  return (
    <section aria-label="Ghi chú của tôi" className="mt-6 rounded-xl border border-white/10 bg-white/5">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-white">
        <span>📝 Ghi chú của tôi <span className="font-normal text-slate-400">· chỉ mình bạn thấy</span></span>
        <span className="flex items-center gap-3">
          <span className={`text-xs font-normal ${status === "error" ? "text-rose-300" : "text-slate-400"}`} aria-live="polite">{label}</span>
          <span className="text-slate-400" aria-hidden="true">{open ? "▴" : "▾"}</span>
        </span>
      </button>
      {open && (
        <div className="border-t border-white/10 p-4">
          <textarea
            value={text} onChange={(e) => onChange(e.target.value)} maxLength={20_000} rows={text.length > 400 ? 10 : 5}
            placeholder="Ghi lại ý chính, công thức, câu hỏi cần hỏi thêm… Tự lưu khi bạn ngừng gõ."
            aria-label="Nội dung ghi chú"
            className="w-full resize-y rounded-lg border border-white/15 bg-slate-950/60 px-3 py-2 text-sm leading-6 text-slate-100 placeholder:text-slate-500 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
          <p className="mt-1 text-right text-xs text-slate-500">{text.length.toLocaleString("vi-VN")} / 20.000</p>
        </div>
      )}
    </section>
  );
}
