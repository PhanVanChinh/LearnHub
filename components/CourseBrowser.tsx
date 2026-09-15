"use client";
import { useMemo, useState } from "react";
import { Category, categories, Course } from "@/data/courses";
import CourseCard from "./CourseCard";

export default function CourseBrowser({
  courses, initial = "all", pageSize = 8, showSearch = true,
}: { courses: Course[]; initial?: Category | "all"; pageSize?: number; showSearch?: boolean }) {
  const [cat, setCat] = useState<Category | "all">(initial);
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(pageSize);

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return courses.filter(
      (c) => (cat === "all" || c.tags.includes(cat)) && (!kw || c.title.toLowerCase().includes(kw) || c.short.toLowerCase().includes(kw)),
    );
  }, [courses, cat, q]);

  const visible = filtered.slice(0, limit);
  const countBy = (key: Category | "all") => (key === "all" ? courses.length : courses.filter((c) => c.tags.includes(key)).length);

  return (
    <div>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c.key}
              onClick={() => { setCat(c.key); setLimit(pageSize); }}
              className={`chip ${cat === c.key ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-brand-300"}`}
            >
              {c.label}
              <span className={`rounded-full px-1.5 text-xs ${cat === c.key ? "bg-white/20" : "bg-slate-100 text-slate-500"}`}>{countBy(c.key)}</span>
            </button>
          ))}
        </div>
        {showSearch && (
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setLimit(pageSize); }}
            placeholder="Tìm khóa học…"
            className="input md:w-64"
          />
        )}
      </div>

      {visible.length === 0 ? (
        <p className="mt-10 text-center text-slate-500">Không tìm thấy khóa học phù hợp.</p>
      ) : (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((c) => <CourseCard key={c.slug} course={c} />)}
        </div>
      )}

      {limit < filtered.length && (
        <div className="mt-8 text-center">
          <button onClick={() => setLimit(limit + pageSize)} className="btn-outline">
            Xem thêm ({filtered.length - limit} khóa học)
          </button>
        </div>
      )}
    </div>
  );
}
