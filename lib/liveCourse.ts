"use client";
// Trang được build tĩnh từ DB tại thời điểm build. Sau khi mở trang, các hook này lấy bản MỚI NHẤT từ API
// và trộn vào dữ liệu tĩnh, để admin sửa giá / tên / bài học là người dùng thấy ngay, không cần chờ rebuild.
// Không có backend → giữ nguyên dữ liệu tĩnh, không báo lỗi.
import { useEffect, useMemo, useState } from "react";
import type { Category, Course, Lesson } from "@/data/courses";
import { CourseDetail, CoursePublic, coursesApi, LessonOut } from "./api";

const TTL = 5_000; // gộp các lời gọi trong cùng một lần tải trang → 1 request, 1 lượt xem

const detailCache = new Map<string, { at: number; p: Promise<CourseDetail> }>();
/** GET /api/courses/{slug}, gộp mọi lời gọi trong 5 giây (LessonList, EnrollButton, CourseDetailView dùng chung). */
export function fetchCourseDetail(slug: string, fresh = false): Promise<CourseDetail> {
  const hit = detailCache.get(slug);
  if (hit && !fresh && Date.now() - hit.at < TTL) return hit.p;
  const p = coursesApi.detail(slug);
  detailCache.set(slug, { at: Date.now(), p });
  p.catch(() => detailCache.delete(slug));
  return p;
}

let exportCache: { at: number; p: Promise<CoursePublic[]> } | null = null;
function fetchExport(): Promise<CoursePublic[]> {
  if (exportCache && Date.now() - exportCache.at < TTL) return exportCache.p;
  const p = coursesApi.exportAll();
  exportCache = { at: Date.now(), p };
  p.catch(() => { exportCache = null; });
  return p;
}

const toLesson = (l: LessonOut): Lesson => ({ title: l.title, duration: l.duration, free: l.free || undefined, video: l.video ?? undefined, hasVideo: l.has_video });

/** Trộn bản API vào bản tĩnh (API thắng). */
export function mergeCourse(base: Course, d: CoursePublic | CourseDetail): Course {
  return {
    ...base, title: d.title, category: d.category as Category, tags: d.tags as Category[], price: d.price, color: d.color, emoji: d.emoji,
    short: d.short, featured: d.featured, description: d.description, includes: d.includes, lessons: d.lessons.map(toLesson),
  };
}

/** Một khóa: bản tĩnh ngay lập tức, rồi bản mới nhất từ API. `detail` có thêm `enrolled`. */
export function useLiveCourse(initial: Course, deps: unknown[] = []) {
  const [detail, setDetail] = useState<CourseDetail | null>(null);
  useEffect(() => {
    let alive = true;
    fetchCourseDetail(initial.slug, deps.length > 0).then((d) => alive && setDetail(d)).catch(() => alive && setDetail(null));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.slug, ...deps]);
  const course = useMemo(() => (detail ? mergeCourse(initial, detail) : initial), [initial, detail]);
  return { course, detail };
}

/** Danh sách: cập nhật các khóa ĐÃ có trong bản tĩnh. Khóa mới trong DB chưa có trang tĩnh (sẽ 404) nên chờ rebuild. */
export function useLiveCourses(initial: Course[]): Course[] {
  const [rows, setRows] = useState<CoursePublic[] | null>(null);
  useEffect(() => {
    let alive = true;
    fetchExport().then((r) => alive && setRows(r)).catch(() => alive && setRows(null));
    return () => { alive = false; };
  }, []);
  return useMemo(() => {
    if (!rows) return initial;
    const bySlug = new Map(rows.map((r) => [r.slug, r]));
    return initial.map((c) => { const d = bySlug.get(c.slug); return d ? mergeCourse(c, d) : c; });
  }, [initial, rows]);
}
