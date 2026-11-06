import type { Metadata } from "next";
import type { Course } from "@/data/courses";
import { coverUrl } from "./cover";
import { isComingSoon, site } from "./site";

// URL công khai của site (không dấu / cuối). CI đặt NEXT_PUBLIC_SITE_URL = origin + base_path của GitHub Pages;
// local rỗng → http://localhost:3000. Dùng cho canonical, sitemap, Open Graph (bắt buộc URL tuyệt đối).
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
// metadataBase phải là ORIGIN (không kèm base path): Next tự thêm basePath vào URL ảnh OG/icon; kèm cả hai sẽ bị lặp /LearnHub/LearnHub
export const SITE_ORIGIN = new URL(SITE_URL).origin;
export const absUrl = (path = "/") => `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;

export const DEFAULT_TITLE = `${site.name} — Học tập online cho sinh viên`;

/** Metadata chuẩn cho một trang: title, description, canonical và Open Graph trỏ đúng URL của trang đó.
 *  Không dùng thì trang kế thừa canonical/OG của layout gốc → mọi trang tự nhận là bản sao của trang chủ.
 *  `noindex` cho trang riêng tư: robots.txt chỉ chặn crawl, vẫn có thể bị index theo URL nếu có link từ ngoài. */
export function pageMeta({ path, title, description = site.description, noindex = false }: {
  path: string; title?: string; description?: string; noindex?: boolean;
}): Metadata {
  const url = absUrl(path);
  const full = title ? `${title} | ${site.name}` : DEFAULT_TITLE; // OG không qua template của layout nên tự ghép
  return {
    ...(title ? { title } : {}),
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", siteName: site.name, locale: "vi_VN", title: full, description, url },
    twitter: { card: "summary_large_image", title: full, description },
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
  };
}

/** "05:20" / "1:02:30" → số giây; chuỗi lạ ("~10 phút") → null, bỏ qua khi cộng tổng. */
const durationSeconds = (d: string): number | null => {
  const parts = d.trim().split(":").map(Number);
  if (parts.length < 2 || parts.length > 3 || parts.some((n) => !Number.isFinite(n) || n < 0)) return null;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
};

/** Tổng thời lượng các bài theo ISO 8601 (PT1H25M). Không bài nào đọc được thời lượng → undefined (không ghi bừa). */
export function courseWorkload(course: Pick<Course, "lessons">): string | undefined {
  const secs = course.lessons.map((l) => durationSeconds(l.duration)).filter((n): n is number => n !== null);
  if (!secs.length) return undefined;
  const minutes = Math.max(1, Math.round(secs.reduce((a, b) => a + b, 0) / 60));
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return `PT${h ? `${h}H` : ""}${m || !h ? `${m}M` : ""}`;
}

/** schema.org/Course cho rich result "Course info" của Google: offers phải có category Free/Paid, courseMode viết hoa,
 *  workload là tổng thời lượng thật; khóa "sắp mở bán" ghi PreOrder để không hứa mua được ngay. */
export function courseJsonLd(course: Course) {
  const url = absUrl(`/courses/${course.slug}`);
  const free = course.price === 0;
  const image = coverUrl(course.cover);
  const workload = courseWorkload(course);
  return {
    "@context": "https://schema.org", "@type": "Course", name: course.title, description: course.short, url,
    ...(image ? { image } : {}),
    provider: { "@type": "Organization", name: site.name, url: absUrl("/") },
    inLanguage: "vi", isAccessibleForFree: free,
    offers: {
      "@type": "Offer", category: free ? "Free" : "Paid", price: course.price, priceCurrency: "VND", url,
      availability: !free && isComingSoon(course.category) ? "https://schema.org/PreOrder" : "https://schema.org/InStock",
    },
    hasCourseInstance: { "@type": "CourseInstance", courseMode: "Online", ...(workload ? { courseWorkload: workload } : {}) },
  };
}
