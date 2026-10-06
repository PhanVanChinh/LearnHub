"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Category, categories, Course } from "@/data/courses";
import CourseCard from "./CourseCard";
import { useLiveCourses } from "@/lib/liveCourse";
import { searchCourses, type Match } from "@/lib/search";
import { isComingSoon } from "@/lib/site";
import { loadCourseStats } from "@/lib/useCourseStats";
import type { CourseStats } from "@/lib/api";

const SORTS = [
  { key: "default", label: "Mặc định" },
  { key: "rating", label: "Đánh giá cao" },
  { key: "students", label: "Nhiều học viên" },
  { key: "views", label: "Nhiều lượt xem" },
  { key: "price-asc", label: "Giá thấp → cao" },
  { key: "price-desc", label: "Giá cao → thấp" },
] as const;
type SortKey = (typeof SORTS)[number]["key"];
const isSortKey = (v: string | null): v is SortKey => SORTS.some((s) => s.key === v);

export default function CourseBrowser({
  courses: staticCourses, initial = "all", pageSize = 8, showSearch = true, syncUrl = false,
}: { courses: Course[]; initial?: Category | "all"; pageSize?: number; showSearch?: boolean; syncUrl?: boolean }) {
  const courses = useLiveCourses(staticCourses); // bản tĩnh hiện ngay, API cập nhật giá/tên sau
  const [cat, setCat] = useState<Category | "all">(initial);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("default");
  const [limit, setLimit] = useState(pageSize);

  // Số liệu thật (đánh giá, học viên, lượt xem) cho các kiểu sắp xếp; không có backend → null, các kiểu đó xếp như mặc định
  const [stats, setStats] = useState<Map<string, CourseStats> | null>(null);
  useEffect(() => {
    let alive = true;
    loadCourseStats().then((m) => alive && setStats(m));
    return () => { alive = false; };
  }, []);

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
    const so = sp.get("sort");
    if (isSortKey(so)) setSort(so);
    urlRead.current = true;
  }, [syncUrl]);
  useEffect(() => {
    if (!syncUrl || !urlRead.current) return;
    const sp = new URLSearchParams(window.location.search);
    if (cat !== initial) sp.set("cat", cat); else sp.delete("cat");
    if (q.trim()) sp.set("q", q.trim()); else sp.delete("q");
    if (sort !== "default") sp.set("sort", sort); else sp.delete("sort");
    const qs = sp.toString();
    const next = `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`;
    if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) window.history.replaceState(window.history.state, "", next);
  }, [syncUrl, cat, q, sort, initial]);

  // Tìm trong tên khóa, mô tả, tên bài học và tên tài liệu (không phân biệt dấu).
  // Khóa "Sắp mở bán" luôn ở cuối (sort ổn định) — không quảng cáo thứ chưa bán ở vị trí đầu. Trong phần còn lại xếp theo `sort`.
  const filtered = useMemo(() => {
    const metric = (c: Course): number => {
      const st = stats?.get(c.slug);
      switch (sort) {
        case "rating": return st?.rating.average ?? 0;
        case "students": return st?.students ?? 0;
        case "views": return st?.views ?? 0;
        case "price-asc": return -c.price;
        case "price-desc": return c.price;
        default: return 0;
      }
    };
    return searchCourses(courses.filter((c) => cat === "all" || c.tags.includes(cat)), q)
      .sort((a, b) => Number(isComingSoon(a.course.category)) - Number(isComingSoon(b.course.category)) || metric(b.course) - metric(a.course));
  }, [courses, cat, q, sort, stats]);

  const visible = filtered.slice(0, limit);
  const countBy = (key: Category | "all") => (key === "all" ? courses.length : courses.filter((c) => c.tags.includes(key)).length);

  return (
    <div>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        {/* Mobile: một hàng cuộn ngang tràn sát mép màn hình (7 chip xếp 3 dòng chiếm quá nhiều chỗ); desktop: xuống dòng như cũ.
            Chip có 0 khóa ẩn đi (trừ "Tất cả" và chip đang chọn) — trang Miễn phí không hiện toàn chip 0. */}
        <div role="group" aria-label="Lọc theo danh mục"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:-mx-6 sm:px-6 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0">
          {categories.filter((c) => c.key === "all" || c.key === cat || countBy(c.key) > 0).map((c) => (
            <button
              key={c.key}
              onClick={() => { setCat(c.key); setLimit(pageSize); }}
              aria-pressed={cat === c.key}
              className={`chip shrink-0 whitespace-nowrap ${cat === c.key ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-brand-300"}`}
            >
              {c.label}
              <span className={`rounded-full px-1.5 text-xs ${cat === c.key ? "bg-white/20" : "bg-slate-100 text-slate-500"}`}>{countBy(c.key)}</span>
            </button>
          ))}
        </div>
        {showSearch && (
          <div className="flex gap-2">
            <input
              type="search" aria-label="Tìm khóa học, bài học, tài liệu"
              value={q}
              onChange={(e) => { setQ(e.target.value); setLimit(pageSize); }}
              placeholder="Tìm khóa học, bài học, tài liệu…"
              className="input min-w-0 flex-1 md:w-64"
            />
            <select aria-label="Sắp xếp" value={sort} onChange={(e) => { setSort(e.target.value as SortKey); setLimit(pageSize); }}
              className="input w-auto shrink-0 cursor-pointer pr-8">
              {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
        )}
      </div>

      {q.trim() && filtered.length > 0 && (
        <p className="mt-4 text-sm text-slate-500">{filtered.length} kết quả cho “{q.trim()}”{filtered.some((h) => h.match.where === "lesson" || h.match.where === "attachment") && " · một số khớp ở bài học bên trong"}</p>
      )}
      {visible.length === 0 ? (
        <p className="mt-10 text-center text-slate-500">Không tìm thấy khóa học phù hợp.{q.trim() && " Thử từ khóa ngắn hơn hoặc bỏ dấu."}</p>
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
