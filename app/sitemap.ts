import type { MetadataRoute } from "next";
import { getVisibleCourses } from "@/lib/courses.server";
import { absUrl } from "@/lib/seo";
import { site } from "@/lib/site";

export const dynamic = "force-static";

/** URL đúng dạng canonical: trailingSlash bật trong next.config → "/courses/" (không có "/" cuối sẽ bị chuyển hướng 308,
 *  Google coi URL chuyển hướng trong sitemap là lỗi). */
const page = (path: string) => absUrl(path.endsWith("/") ? path : `${path}/`);

/** Sitemap sinh lúc build từ DB: trang tĩnh + mọi khóa học đang hiện + chính sách. Trang cần đăng nhập không đưa vào. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const courses = await getVisibleCourses();
  const now = new Date();
  return [
    { url: page("/"), lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: page("/courses"), lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: page("/free"), lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: page("/ai-check"), lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: page("/phenikaa"), lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: page("/contact"), lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    // Tra cứu chứng nhận công khai (nhà tuyển dụng tìm tới) và đăng ký
    { url: page("/certificate"), lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: page("/register"), lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    ...courses.map((c) => ({ url: page(`/courses/${c.slug}`), lastModified: now, changeFrequency: "weekly" as const, priority: c.featured ? 0.9 : 0.7 })),
    ...site.footerLinks.map((l) => ({ url: page(l.href), lastModified: now, changeFrequency: "yearly" as const, priority: 0.2 })),
  ];
}
