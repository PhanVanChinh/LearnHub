// Định dạng ngày giờ dùng chung. Backend trả thời điểm UTC dạng ISO đôi khi KHÔNG có hậu tố "Z"
// ("2026-10-25T03:00:00") → new Date() sẽ hiểu nhầm là giờ máy người xem. parseUtc thêm "Z" khi thiếu.
// Hiển thị luôn theo giờ Việt Nam để khớp email, sao kê ngân hàng và CSV, bất kể máy người xem đặt múi giờ nào.
const TZ = "Asia/Ho_Chi_Minh";

export const parseUtc = (iso: string) => new Date(/Z|[+-]\d\d:\d\d$/.test(iso) ? iso : iso + "Z");

const f = (iso: string | null | undefined, opts: Intl.DateTimeFormatOptions) =>
  iso ? parseUtc(iso).toLocaleString("vi-VN", { timeZone: TZ, ...opts }) : "";

/** 25/10/2026 */
export const fmtDate = (iso?: string | null) => f(iso, { day: "2-digit", month: "2-digit", year: "numeric" });
/** 10:30 25/10/2026 */
export const fmtDateTime = (iso?: string | null) => f(iso, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
/** 10:30:15 25/10/2026 — nhật ký quản trị cần tới giây */
export const fmtDateTimeSec = (iso?: string | null) => f(iso, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
/** 10:30 25/10 — danh sách gọn (đơn hàng) */
export const fmtShort = (iso?: string | null) => f(iso, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(/(\d\d)-(\d\d)/, "$1/$2"); // vi-VN ra "26-10" khi không có năm
