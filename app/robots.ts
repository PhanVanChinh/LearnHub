import type { MetadataRoute } from "next";
import { absUrl } from "@/lib/seo";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    // Các trang riêng tư (tài khoản, đơn hàng, học, thanh toán…) đã gắn meta noindex. KHÔNG chặn crawl chúng ở đây:
    // bị chặn thì Google không đọc được noindex và vẫn có thể index URL (không mô tả) khi có link từ ngoài.
    // Chỉ chặn /admin để bot khỏi tốn lượt crawl vào trang quản trị.
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin"] }],
    sitemap: absUrl("/sitemap.xml"),
  };
}
