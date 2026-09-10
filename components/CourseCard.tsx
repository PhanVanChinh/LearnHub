import Link from "next/link";
import { Course } from "@/data/courses";
import { formatVND } from "@/lib/site";

const labels: Record<string, string> = {
  "ai-check": "AI Check", pdf: "PDF", quiz: "Trắc nghiệm", free: "Miễn phí", source: "Source code", video: "Video",
};

export default function CourseCard({ course }: { course: Course }) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card transition hover:-translate-y-0.5 hover:shadow-lg">
      <Link href={`/courses/${course.slug}`} className={`relative grid aspect-[16/9] place-items-center bg-gradient-to-br ${course.color}`}>
        <span className="text-6xl drop-shadow-md transition group-hover:scale-110">{course.emoji}</span>
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-slate-800">
          {labels[course.category]}
        </span>
        {course.price === 0 && (
          <span className="absolute right-3 top-3 rounded-full bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-white">Miễn phí</span>
        )}
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 min-h-[2.75rem] text-base font-semibold leading-snug text-slate-900">
          <Link href={`/courses/${course.slug}`}>{course.title}</Link>
        </h3>
        <p className="mt-1.5 line-clamp-2 min-h-[2.5rem] text-sm text-slate-600">{course.short}</p>
        <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
          <span>👁 {course.views.toLocaleString("vi-VN")} lượt xem</span>
          <span>🛍 {course.sold} đã mua</span>
        </div>
        <div className="mt-auto flex items-center justify-between pt-4">
          <span className={`text-lg font-bold ${course.price === 0 ? "text-emerald-600" : "text-brand-700"}`}>{formatVND(course.price)}</span>
          <Link href={`/courses/${course.slug}`} className="btn-primary !px-3 !py-1.5">
            {course.price === 0 ? "Bắt đầu học" : "Xem chi tiết"}
          </Link>
        </div>
      </div>
    </article>
  );
}
