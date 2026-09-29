import type { Metadata } from "next";
import { site } from "./site";

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
