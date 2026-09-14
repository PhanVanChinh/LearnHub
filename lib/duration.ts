/** "05:20" → 320 giây; "1:02:30" → 3750 giây. Chuỗi lạ → 0. */
export function parseDuration(s: string): number {
  const parts = s.trim().split(":").map(Number);
  if (parts.some((p) => !Number.isFinite(p))) return 0;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

/** Tổng giây → "1 giờ 25 phút" | "45 phút" | "dưới 1 phút". */
export function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 1) return "dưới 1 phút";
  const h = Math.floor(mins / 60), m = mins % 60;
  if (h === 0) return `${m} phút`;
  return m ? `${h} giờ ${m} phút` : `${h} giờ`;
}

export const totalDuration = (lessons: { duration: string }[]) =>
  formatDuration(lessons.reduce((s, l) => s + parseDuration(l.duration), 0));
