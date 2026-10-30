"use client";
import { FormEvent, useRef, useState } from "react";
import { categories } from "@/data/courses";
import { faculties } from "@/lib/faculties";
import { AdminCourse, adminApi, Attachment, CourseInput, Lesson } from "@/lib/api";
import { coverUrl } from "@/lib/cover";
import { parseQuizText, quizToText } from "@/lib/quizText";
import { ErrorBox, Field, useDialog } from "./ui";
import AttachmentEditor from "./AttachmentEditor";
import ContentEditor from "./ContentEditor";
import QuizEditor from "./QuizEditor";

const COLORS = [
  "from-brand-500 to-brand-700", "from-violet-500 to-fuchsia-600", "from-sky-500 to-indigo-600", "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600", "from-rose-500 to-pink-600", "from-slate-600 to-slate-800",
];

const slugify = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

// Mỗi dòng: "Tiêu đề | Thời lượng | free | <YouTube ID hoặc link> | #mã" — các token sau thời lượng tùy chọn, thứ tự tự do.
// "#mã" là mã cố định của bài do server cấp: giữ nguyên trên dòng thì đổi tên / đổi chỗ bài vẫn giữ đúng tiến độ học viên.
// Xóa mã cũng không sao — server tự khớp lại theo tiêu đề hoặc vị trí (backend/app/lessons.py).
const lessonsToText = (l: Lesson[]) =>
  l.map((x) => [x.title, x.duration, x.free ? "free" : null, x.video ?? null, x.id ? `#${x.id}` : null].filter(Boolean).join(" | ")).join("\n");

/** Chấp nhận ID 11 ký tự hoặc link youtube.com/watch?v=..., youtu.be/..., /shorts/..., /embed/... */
export const parseYouTubeId = (input: string): string | null => {
  const s = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  const m = s.match(/(?:v=|youtu\.be\/|\/shorts\/|\/embed\/|\/live\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
};

const textToLessons = (t: string): Lesson[] =>
  t.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const [title = "", duration = "", ...rest] = line.split("|").map((p) => p.trim());
    const lesson: Lesson = { title, duration, free: false };
    for (const tok of rest) {
      if (!tok) continue;
      if (tok.toLowerCase() === "free") { lesson.free = true; continue; }
      if (/^#[a-z0-9]{4,32}$/i.test(tok)) { lesson.id = tok.slice(1).toLowerCase(); continue; }
      const id = parseYouTubeId(tok);
      if (!id) throw new Error(`Không nhận ra video "${tok}" ở bài "${title}". Dán YouTube ID (11 ký tự) hoặc link video.`);
      lesson.video = id;
    }
    return lesson;
  });

type Props = { initial?: AdminCourse; onSubmit: (body: CourseInput) => Promise<void>; onCancel: () => void };

export default function CourseForm({ initial, onSubmit, onCancel }: Props) {
  const [f, setF] = useState({
    slug: initial?.slug ?? "", title: initial?.title ?? "", category: initial?.category ?? "video", faculty: initial?.faculty ?? "",
    price: initial?.price ?? 0, emoji: initial?.emoji ?? "📘", color: initial?.color ?? COLORS[0],
    short: initial?.short ?? "", description: initial?.description ?? "", featured: initial?.featured ?? false, cover: initial?.cover ?? "",
    includes: (initial?.includes ?? []).join("\n"), lessons: lessonsToText(initial?.lessons ?? []),
  });
  // Trắc nghiệm soạn riêng theo chỉ số bài (textarea "Bài học" chỉ giữ tiêu đề/thời lượng/video)
  const [quizText, setQuizText] = useState<Record<number, string>>(() =>
    Object.fromEntries((initial?.lessons ?? []).map((l, i) => [i, quizToText(l.quiz)]).filter(([, t]) => t)));
  const [quizLesson, setQuizLesson] = useState(0);
  // Nội dung bài đọc (Markdown) theo chỉ số bài
  const [content, setContent] = useState<Record<number, string>>(() =>
    Object.fromEntries((initial?.lessons ?? []).map((l, i) => [i, l.content ?? ""]).filter(([, c]) => c)));
  // Tài liệu đính kèm theo chỉ số bài — giữ nguyên qua các lần lưu (textarea "Bài học" không chứa chúng)
  const [attachments, setAttachments] = useState<Record<number, Attachment[]>>(() =>
    Object.fromEntries((initial?.lessons ?? []).map((l, i) => [i, l.attachments ?? []]).filter(([, a]) => (a as Attachment[]).length)));
  const [autoSlug, setAutoSlug] = useState(!initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  const { ask, dialog } = useDialog();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      const lessons = textToLessons(f.lessons);
      if (lessons.some((l) => !l.title || !l.duration)) throw new Error("Mỗi dòng bài học cần dạng: Tiêu đề | Thời lượng | free (tùy chọn)");
      for (const [i, text] of Object.entries(quizText)) {
        const idx = Number(i);
        if (!text.trim() || !lessons[idx]) continue;
        try { lessons[idx].quiz = parseQuizText(text); }
        catch (err) { throw new Error(`Trắc nghiệm bài ${idx + 1}: ${(err as Error).message}`); }
      }
      for (const [i, atts] of Object.entries(attachments)) {
        const idx = Number(i);
        if (lessons[idx] && atts.length) lessons[idx].attachments = atts;
      }
      for (const [i, md] of Object.entries(content)) {
        const idx = Number(i);
        if (lessons[idx] && md.trim()) lessons[idx].content = md.trim();
      }
      await onSubmit({
        slug: f.slug, title: f.title.trim(), category: f.category, faculty: f.faculty, price: Number(f.price) || 0, emoji: f.emoji, color: f.color,
        short: f.short.trim(), description: f.description.trim(), featured: f.featured, cover: f.cover.trim(),
        includes: f.includes.split("\n").map((s) => s.trim()).filter(Boolean), lessons,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {dialog}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tiêu đề">
          <input className="input" required value={f.title} onChange={(e) => { set("title", e.target.value); if (autoSlug) set("slug", slugify(e.target.value)); }} />
        </Field>
        <Field label="Slug" hint="Chữ thường, số, dấu gạch ngang. Dùng trong URL /courses/{slug}">
          <input className="input font-mono" required pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$" value={f.slug}
            onChange={(e) => { setAutoSlug(false); set("slug", e.target.value); }} />
        </Field>
        <Field label="Danh mục">
          <select className="input" value={f.category} onChange={(e) => set("category", e.target.value)}>
            {categories.filter((c) => c.key !== "all").map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </Field>
        <Field label="Khoa" hint="Hiện ở trang Dành cho Phenikaa; để trống nếu không thuộc khoa nào">
          <select className="input" value={f.faculty} onChange={(e) => set("faculty", e.target.value)}>
            <option value="">— Chưa xếp —</option>
            {faculties.map((x) => <option key={x.key} value={x.key}>{x.emoji} {x.label}</option>)}
          </select>
        </Field>
        <Field label="Giá (VNĐ)" hint="0 = miễn phí, tự gắn tag 'free'">
          <input className="input" type="number" min={0} step={1000} value={f.price} onChange={(e) => set("price", Number(e.target.value))} />
        </Field>
        <Field label="Emoji">
          <input className="input" maxLength={10} value={f.emoji} onChange={(e) => set("emoji", e.target.value)} />
        </Field>
        <Field label="Màu thumbnail">
          <div className="flex items-center gap-2">
            <select className="input" value={f.color} onChange={(e) => set("color", e.target.value)}>
              {Array.from(new Set([...COLORS, f.color])).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <span className={`grid h-9 w-12 shrink-0 place-items-center rounded-lg bg-gradient-to-br text-lg ${f.color}`}>{f.emoji}</span>
          </div>
        </Field>
      </div>
      <CoverField slug={f.slug} value={f.cover} onChange={(v) => set("cover", v)} color={f.color} emoji={f.emoji} />
      <Field label="Mô tả ngắn (hiển thị trên card)">
        <textarea className="input" rows={2} value={f.short} onChange={(e) => set("short", e.target.value)} />
      </Field>
      <Field label="Mô tả chi tiết">
        <textarea className="input" rows={4} value={f.description} onChange={(e) => set("description", e.target.value)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Khóa học bao gồm" hint="Mỗi dòng một mục">
          <textarea className="input font-mono text-xs" rows={5} value={f.includes} onChange={(e) => set("includes", e.target.value)} />
        </Field>
        <Field label="Bài học" hint="Mỗi dòng: Tiêu đề | Thời lượng | free (học thử) | YouTube ID hoặc link | #mã. Giữ nguyên #mã khi đổi tên hay đổi chỗ bài để học viên không mất tiến độ; chèn, xóa, đổi thứ tự dòng đều được.">
          <textarea className="input font-mono text-xs" rows={5} value={f.lessons} onChange={(e) => set("lessons", e.target.value)}
            placeholder={"Giới thiệu | 05:20 | free | aircAruvnKk\nChương 1 | 18:45 | https://youtu.be/aBcDeFgHiJk"} />
        </Field>
      </div>
      <ContentEditor lessonsText={f.lessons} content={content} setContent={setContent} lesson={quizLesson} setLesson={setQuizLesson} />
      <QuizEditor lessonsText={f.lessons} quizText={quizText} setQuizText={setQuizText} lesson={quizLesson} setLesson={setQuizLesson} />
      <AttachmentEditor lessonsText={f.lessons} slug={f.slug} attachments={attachments} setAttachments={setAttachments} lesson={quizLesson} setLesson={setQuizLesson} ask={ask} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={f.featured} onChange={(e) => set("featured", e.target.checked)} />
        Nổi bật (hiển thị ở trang chủ)
      </label>
      <ErrorBox message={error} />
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="btn-outline">Hủy</button>
        <button type="submit" disabled={busy} className="btn-primary disabled:opacity-60">{busy ? "Đang lưu…" : initial ? "Lưu thay đổi" : "Tạo khóa học"}</button>
      </div>
    </form>
  );
}


/** Ảnh bìa khóa học: tải file lên S3 hoặc dán URL ảnh ngoài. Trống → thẻ dùng gradient + emoji như trước. */
function CoverField({ slug, value, onChange, color, emoji }: { slug: string; value: string; onChange: (v: string) => void; color: string; emoji: string }) {
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
