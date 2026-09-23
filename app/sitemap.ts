import type { MetadataRoute } from "next";
import { getCourses } from "@/lib/courses.server";
import { absUrl } from "@/lib/seo";
import { site } from "@/lib/site";

export const dynamic = "force-static";

/** Sitemap sinh lúc build từ DB (qua getCourses): trang tĩnh + mọi khóa học + chính sách. Trang cần đăng nhập không đưa vào. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const courses = await getCourses();
  const now = new Date();
  return [
    { url: absUrl("/"), lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: absUrl("/courses"), lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: absUrl("/free"), lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: absUrl("/ai-check"), lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: absUrl("/phenikaa"), lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: absUrl("/contact"), lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    ...courses.map((c) => ({ url: absUrl(`/courses/${c.slug}`), lastModified: now, changeFrequency: "weekly" as const, priority: c.featured ? 0.9 : 0.7 })),
    ...site.footerLinks.map((l) => ({ url: absUrl(l.href), lastModified: now, changeFrequency: "yearly" as const, priority: 0.2 })),
  ];
}
