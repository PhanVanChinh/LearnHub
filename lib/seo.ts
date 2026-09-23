// URL công khai của site (không dấu / cuối). CI đặt NEXT_PUBLIC_SITE_URL = origin + base_path của GitHub Pages;
// local rỗng → http://localhost:3000. Dùng cho canonical, sitemap, Open Graph (bắt buộc URL tuyệt đối).
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
// metadataBase phải là ORIGIN (không kèm base path): Next tự thêm basePath vào URL ảnh OG/icon; kèm cả hai sẽ bị lặp /LearnHub/LearnHub
export const SITE_ORIGIN = new URL(SITE_URL).origin;
export const absUrl = (path = "/") => `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
