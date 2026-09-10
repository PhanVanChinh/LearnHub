"use client";
import { FormEvent, useState } from "react";
import { categories } from "@/data/courses";
import { AdminCourse, CourseInput, Lesson } from "@/lib/api";
import { ErrorBox, Field } from "./ui";

const COLORS = [
  "from-brand-500 to-brand-700", "from-violet-500 to-fuchsia-600", "from-sky-500 to-indigo-600", "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600", "from-rose-500 to-pink-600", "from-slate-600 to-slate-800",
];

const slugify = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const lessonsToText = (l: Lesson[]) => l.map((x) => `${x.title} | ${x.duration}${x.free ? " | free" : ""}`).join("\n");
const textToLessons = (t: string): Lesson[] =>
  t.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const [title = "", duration = "", flag = ""] = line.split("|").map((p) => p.trim());
    return { title, duration, free: flag.toLowerCase() === "free" };
  });

type Props = { initial?: AdminCourse; onSubmit: (body: CourseInput) => Promise<void>; onCancel: () => void };

export default function CourseForm({ initial, onSubmit, onCancel }: Props) {
  const [f, setF] = useState({
    slug: initial?.slug ?? "", title: initial?.title ?? "", category: initial?.category ?? "video",
    price: initial?.price ?? 0, emoji: initial?.emoji ?? "📘", color: initial?.color ?? COLORS[0],
    short: initial?.short ?? "", description: initial?.description ?? "", featured: initial?.featured ?? false,
    includes: (initial?.includes ?? []).join("\n"), lessons: lessonsToText(initial?.lessons ?? []),
  });
  const [autoSlug, setAutoSlug] = useState(!initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      const lessons = textToLessons(f.lessons);
      if (lessons.some((l) => !l.title || !l.duration)) throw new Error("Mỗi dòng bài học cần dạng: Tiêu đề | Thời lượng | free (tuỳ chọn)");
      await onSubmit({
        slug: f.slug, title: f.title.trim(), category: f.category, price: Number(f.price) || 0, emoji: f.emoji, color: f.color,
        short: f.short.trim(), description: f.description.trim(), featured: f.featured,
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
        <Field label="Bài học" hint="Mỗi dòng: Tiêu đề | Thời lượng | free (nếu học thử)">
          <textarea className="input font-mono text-xs" rows={5} value={f.lessons} onChange={(e) => set("lessons", e.target.value)}
            placeholder={"Giới thiệu | 05:20 | free\nChương 1 | 18:45"} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={f.featured} onChange={(e) => set("featured", e.target.checked)} />
        Nổi bật (hiển thị ở trang chủ)
      </label>
      <ErrorBox message={error} />
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="btn-outline">Huỷ</button>
        <button type="submit" disabled={busy} className="btn-primary disabled:opacity-60">{busy ? "Đang lưu…" : initial ? "Lưu thay đổi" : "Tạo khóa học"}</button>
      </div>
    </form>
  );
}
