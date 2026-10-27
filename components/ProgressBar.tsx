/** Thanh tiến độ dùng chung: role="progressbar" + aria-value* để trình đọc màn hình đọc "40 phần trăm".
 *  `track`/`bar` là class màu (nền sáng / nền tối khác nhau), `label` nêu thanh này đo cái gì. */
export default function ProgressBar({ percent, label, className = "h-2", track = "bg-slate-100", bar = "bg-brand-600" }: {
  percent: number; label: string; className?: string; track?: string; bar?: string;
}) {
  const v = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={v}
      className={`overflow-hidden rounded-full ${track} ${className}`}>
      <div className={`h-full rounded-full transition-all ${bar}`} style={{ width: `${v}%` }} />
    </div>
  );
}
