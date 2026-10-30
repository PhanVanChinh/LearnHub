import Link from "next/link";
import type { Course } from "@/data/courses";
import type { Progress } from "@/lib/api";
import { formatVND } from "@/lib/site";
import CertificateButton from "@/components/CertificateButton";
import ProgressBar from "@/components/ProgressBar";
import ReviewPrompt from "@/components/ReviewPrompt";

type Props = {
  course: Course;
  progress: Progress;
  related: Course[];
  onClose: () => void;
  onSelect: (i: number) => void;
};

// Màn tổng kết khóa học: mở khi bấm "Hoàn tất khóa học" ở bài cuối hoặc vừa đánh dấu xong bài cuối
export default function CourseSummary({ course, progress, related, onClose, onSelect }: Props) {
  const remaining = course.lessons.map((_, i) => i).filter((i) => !progress.completed.includes(i));
  return (
    <section aria-label="Tổng kết khóa học" className="mb-6 rounded-2xl border border-white/10 bg-gradient-to-br from-brand-900/60 to-slate-900 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-400">Tổng kết</p>
          <p className="mt-1 text-2xl font-bold text-white">
            {progress.percent === 100 ? <><span aria-hidden="true">🎉 </span>Bạn đã hoàn thành khóa học!</> : `Bạn đã tới bài cuối · còn ${remaining.length} bài chưa hoàn thành`}
          </p>
        </div>
        <button onClick={onClose} aria-label="Đóng tổng kết" className="rounded-lg px-2 py-1 text-slate-400 hover:bg-white/10 hover:text-white">✕</button>
      </div>
      <div className="mt-4">
        <div className="flex justify-between text-sm text-slate-300">
          <span>Đã học {progress.completed.length}/{progress.total} bài</span>
          <span className="font-semibold text-white">{progress.percent}%</span>
        </div>
        <ProgressBar percent={progress.percent} label="Tiến độ khóa học" className="mt-1 h-2" track="bg-white/10" bar={progress.percent === 100 ? "bg-emerald-400" : "bg-brand-500"} />
      </div>

      {progress.percent < 100 ? (
        <div className="mt-4">
          <p className="text-sm text-slate-300">Hoàn thành các bài sau để nhận chứng nhận:</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {remaining.map((i) => (
              <li key={i}>
                <button onClick={() => onSelect(i)} className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/10">
                  Bài {i + 1}: <span className="font-medium text-white">{course.lessons[i].title}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="mt-2 max-w-md">
          <CertificateButton slug={course.slug} />
          <ReviewPrompt slug={course.slug} completed />
        </div>
      )}

      {related.length > 0 && (
        <div className="mt-6 border-t border-white/10 pt-5">
          <p className="text-sm font-semibold text-white">Học tiếp khóa khác</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-3">
            {related.map((c) => (
              <li key={c.slug}>
                <Link href={`/courses/${c.slug}`} className="flex h-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 transition hover:bg-white/10">
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br ${c.color} text-xl`} aria-hidden="true">{c.emoji}</span>
                  <span className="min-w-0">
                    <span className="line-clamp-2 text-sm font-medium text-white">{c.title}</span>
                    <span className={`block text-xs ${c.price === 0 ? "text-emerald-300" : "text-slate-400"}`}>{formatVND(c.price)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/my-courses" className="btn-primary">Khóa học của tôi</Link>
        <Link href={`/courses/${course.slug}`} className="btn border border-white/15 bg-white/5 text-white hover:bg-white/10">Trang khóa học</Link>
      </div>
    </section>
  );
}
