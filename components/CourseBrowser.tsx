"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Category, categories, Course } from "@/data/courses";
import CourseCard from "./CourseCard";
import { useLiveCourses } from "@/lib/liveCourse";
import { searchCourses, type Match } from "@/lib/search";
import { isComingSoon } from "@/lib/site";

export default function CourseBrowser({
  courses: staticCourses, initial = "all", pageSize = 8, showSearch = true, syncUrl = false,
}: { courses: Course[]; initial?: Category | "all"; pageSize?: number; showSearch?: boolean; syncUrl?: boolean }) {
  const courses = useLiveCourses(staticCourses); // bản tĩnh hiện ngay, API cập nhật giá/tên sau
  const [cat, setCat] = useState<Category | "all">(initial);
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(pageSize);

  // syncUrl: bộ lọc và từ khóa nằm trên URL (?cat=&q=) để chia sẻ được link, Back/F5 không mất bộ lọc.
  // Trang xuất tĩnh nên đọc window.location sau khi mount (HTML tĩnh vẫn là danh sách đầy đủ, tốt cho SEO),
  // và ghi bằng history.replaceState để không tạo thêm mục lịch sử mỗi lần gõ.
  const urlRead = useRef(false);
  useEffect(() => {
    if (!syncUrl) return;
    const sp = new URLSearchParams(window.location.search);
    const c = sp.get("cat");
    if (c && categories.some((k) => k.key === c)) setCat(c as Category | "all");
    const kw = sp.get("q");
    if (kw) setQ(kw);
    urlRead.current = true;
  }, [syncUrl]);
  useEffect(() => {
    if (!syncUrl || !urlRead.current) return;
    const sp = new URLSearchParams(window.location.search);
    if (cat !== initial) sp.set("cat", cat); else sp.delete("cat");
    if (q.trim()) sp.set("q", q.trim()); else sp.delete("q");
    const qs = sp.toString();
    const next = `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`;
    if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) window.history.replaceState(window.history.state, "", next);
  }, [syncUrl, cat, q, initial]);

  // Tìm trong tên khóa, mô tả, tên bài học và tên tài liệu (không phân biệt dấu).
  // Khóa "Sắp mở bán" đẩy xuống cuối (sort ổn định, giữ thứ tự còn lại) — không quảng cáo thứ chưa bán ở vị trí đầu.
  const filtered = useMemo(
    () => searchCourses(courses.filter((c) => cat === "all" || c.tags.includes(cat)), q)
      .sort((a, b) => Number(isComingSoon(a.course.category)) - Number(isComingSoon(b.course.category))),
    [courses, cat, q],
  );

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
            type="search" aria-label="Tìm khóa học, bài học, tài liệu"
            value={q}
            onChange={(e) => { setQ(e.target.value); setLimit(pageSize); }}
            placeholder="Tìm khóa học, bài học, tài liệu…"
            className="input md:w-64"
          />
        )}
      </div>

      {q.trim() && filtered.length > 0 && (
        <p className="mt-4 text-sm text-slate-500">{filtered.length} kết quả cho “{q.trim()}”{filtered.some((h) => h.match.where === "lesson" || h.match.where === "attachment") && " · một số khớp ở bài học bên trong"}</p>
      )}
      {visible.length === 0 ? (
        <p className="mt-10 text-center text-slate-500">Không tìm thấy khóa học phù hợp.{q.trim() && " Thử từ khoá ngắn hơn hoặc bỏ dấu."}</p>
      ) : (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((h) => <CourseCard key={h.course.slug} course={h.course} match={q.trim() ? h.match : undefined} query={q} />)}
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
