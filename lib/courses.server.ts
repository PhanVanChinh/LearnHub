// Nguồn khóa học cho Server Components / lúc build tĩnh.
// Ưu tiên DB qua API (/api/courses/export) — đây là nguồn sự thật, admin sửa ở đây.
// Không gọi được API (build offline, backend chưa deploy) → rớt về data/courses.ts để build không bao giờ fail.
// KHÔNG import file này từ Client Component ("use client"): fetch chạy ở server/build, client nhận qua props.
import { API_URL } from "./api";
import { Category, Course, courses as fallbackCourses } from "@/data/courses";

type ApiLesson = { title: string; duration: string; free: boolean; video: string | null; has_video: boolean; quiz_count?: number };
type ApiCourse = Omit<Course, "lessons" | "tags" | "category"> & { category: string; tags: string[]; lessons: ApiLesson[] };

const fromApi = (c: ApiCourse): Course => ({
  slug: c.slug, title: c.title, category: c.category as Category, tags: c.tags as Category[], price: c.price,
  color: c.color, emoji: c.emoji, short: c.short, description: c.description, includes: c.includes, featured: c.featured,
  lessons: c.lessons.map((l) => ({ title: l.title, duration: l.duration, free: l.free || undefined, video: l.video ?? undefined, hasVideo: l.has_video, quizCount: l.quiz_count || undefined })),
});

async function fetchFromApi(): Promise<Course[] | null> {
  try {
    const res = await fetch(`${API_URL}/api/courses/export`, {
      signal: AbortSignal.timeout(15_000),
      // build: cache theo lần build; dev: luôn lấy mới để thấy thay đổi từ admin ngay
      cache: process.env.NODE_ENV === "production" ? "force-cache" : "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = (await res.json()) as ApiCourse[];
    if (!Array.isArray(rows) || rows.length === 0) throw new Error("rỗng");
    return rows.map(fromApi);
  } catch (e) {
    console.warn(`[courses] Không lấy được ${API_URL}/api/courses/export (${(e as Error).message}) → dùng data/courses.ts`);
    return null;
  }
}

let cached: Promise<Course[]> | null = null;
/** Danh sách khóa học (API → fallback tĩnh). Trong build được nhớ một lần cho mọi trang. */
export function getCourses(): Promise<Course[]> {
  if (process.env.NODE_ENV !== "production") return fetchFromApi().then((r) => r ?? fallbackCourses);
  cached ??= fetchFromApi().then((r) => {
    console.log(r ? `[courses] ${r.length} khóa học từ API` : `[courses] ${fallbackCourses.length} khóa học từ data/courses.ts (fallback)`);
    return r ?? fallbackCourses;
  });
  return cached;
}

export async function getCourse(slug: string): Promise<Course | undefined> {
  return (await getCourses()).find((c) => c.slug === slug);
}
