/** Cuộn mượt chỉ khi người dùng không bật "giảm chuyển động" (CSS scroll-behavior đã làm vậy; gọi JS phải tự kiểm tra). */
export function scrollBehavior(): ScrollBehavior {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}
