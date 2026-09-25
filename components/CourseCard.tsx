import Link from "next/link";
import { Course } from "@/data/courses";
import { formatVND, isComingSoon } from "@/lib/site";
import CourseStatsLine from "./CourseStatsLine";
import { highlight, type Match } from "@/lib/search";
import { coverUrl } from "@/lib/cover";

const labels: Record<string, string> = {
  "ai-check": "AI Check", pdf: "PDF", quiz: "Trắc nghiệm", free: "Miễn phí", source: "Source code", video: "Video",
};

type Action = { href: string; label: string };

type ProgressInfo = { completed: number; total: number };

function Hl({ text, query }: { text: string; query?: string }) {
  if (!query?.trim()) return <>{text}</>;
  return <>{highlight(text, query).map((p, i) => (p.hit ? <mark key={i} className="rounded bg-amber-100 px-0.5 text-inherit">{p.text}</mark> : p.text))}</>;
}

export default function CourseCard({ course, action, progress, match, query }: {
  course: Course; action?: Action; progress?: ProgressInfo; match?: Match; query?: string;
}) {
  const percent = progress && progress.total ? Math.round((progress.completed * 100) / progress.total) : 0;
  const soon = isComingSoon(course.category);
  const cover = coverUrl(course.cover);
  const cta: Action = action ?? { href: `/courses/${course.slug}`, label: course.price === 0 ? "Bắt đầu học" : "Xem chi tiết" };
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card transition hover:-translate-y-0.5 hover:shadow-lg">
      <Link href={`/courses/${course.slug}`} aria-label={course.title} className={`relative grid aspect-[16/9] place-items-center bg-gradient-to-br ${course.color}`}>
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition group-hover:scale-105" />
        ) : (
          <span aria-hidden="true" className="text-6xl drop-shadow-md transition group-hover:scale-110">{course.emoji}</span>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-slate-800">
          {labels[course.category]}
        </span>
        {course.price === 0 && (
          <span className="absolute right-3 top-3 rounded-full bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-white">Miễn phí</span>
        )}
        {soon && <span className="absolute right-3 top-3 rounded-full bg-slate-800/80 px-2.5 py-1 text-xs font-semibold text-white">Sắp mở bán</span>}
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 min-h-[2.75rem] text-base font-semibold leading-snug text-slate-900">
          <Link href={`/courses/${course.slug}`}><Hl text={course.title} query={query} /></Link>
        </h3>
        <p className="mt-1.5 line-clamp-2 min-h-[2.5rem] text-sm text-slate-600"><Hl text={course.short} query={query} /></p>
        {match && (match.where === "lesson" || match.where === "attachment") && (
          <Link href={`/learn/${course.slug}?lesson=${match.index}`} className="mt-2 block truncate rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800 hover:bg-amber-100">
            {match.where === "lesson"
              ? <>📍 Bài {match.index + 1}: <Hl text={match.title} query={query} /></>
              : <>📎 Bài {match.index + 1} · <Hl text={match.name} query={query} /></>}
          </Link>
        )}
        {match?.where === "description" && <p className="mt-2 text-xs text-slate-400">Khớp trong mô tả chi tiết</p>}
        <CourseStatsLine slug={course.slug} lessons={course.lessons.length} className="mt-3 text-xs text-slate-500" />
        {progress && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-slate-500">
              <span>{percent === 100 ? "🎉 Hoàn thành" : `${progress.completed}/${progress.total} bài`}</span>
              <span className="font-semibold text-slate-700">{percent}%</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full transition-all ${percent === 100 ? "bg-emerald-500" : "bg-brand-600"}`} style={{ width: `${percent}%` }} />
            </div>
          </div>
        )}
        <div className="mt-auto flex items-center justify-between pt-4">
          <span className={`text-lg font-bold ${course.price === 0 ? "text-emerald-600" : "text-brand-700"}`}>{formatVND(course.price)}</span>
          <Link href={cta.href} className="btn-primary !px-3 !py-1.5">{cta.label}</Link>
        </div>
      </div>
    </article>
  );
}
