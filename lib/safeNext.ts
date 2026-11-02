/** Đường dẫn quay về sau đăng nhập / xác thực, lấy từ tham số `?next=`.
 *  Chỉ nhận đường dẫn nội bộ: bắt đầu bằng đúng một dấu "/" — "//host" hay "/\host" bị trình duyệt hiểu là URL
 *  tuyệt đối, còn "https://..." thì router chuyển hẳn sang web khác (open redirect: mail lừa đảo gắn
 *  `/login?next=https://evil.example` để người dùng vừa đăng nhập xong là sang trang giả). Khác đi → về `fallback`. */
export function safeNext(raw: string | null | undefined, fallback = "/"): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  return raw;
}
