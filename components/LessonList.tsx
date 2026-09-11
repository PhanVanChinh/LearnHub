"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Lesson } from "@/data/courses";
import { coursesApi } from "@/lib/api";
import VideoPlayer from "./VideoPlayer";

/** Danh sách bài học trên trang chi tiết. Bài `free` có video thì bấm để xem thử ngay tại đây. */
export default function LessonList({ lessons, slug }: { lessons: Lesson[]; slug: string }) {
  const previewable = lessons.map((l, i) => (l.free && l.video ? i : -1)).filter((i) => i >= 0);
  const [active, setActive] = useState<number | null>(null);
  const current = active !== null ? lessons[active] : null;
  // Video bài trả phí không nằm trong dữ liệu tĩnh → hỏi API cờ has_video để hiện icon đúng
  const [hasVideoApi, setHasVideoApi] = useState<boolean[] | null>(null);
  useEffect(() => {
    coursesApi.detail(slug).then((d) => setHasVideoApi(d.lessons.map((l) => l.has_video))).catch(() => {});
  }, [slug]);
  const hasVideo = (i: number) => hasVideoApi?.[i] ?? !!lessons[i].video;
  const videoCount = lessons.filter((_, i) => hasVideo(i)).length;

  return (
    <div>
      <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-500">
        <span>{lessons.length} bài học</span>
        {videoCount > 0 && <span>· 🎬 {videoCount} video</span>}
        {previewable.length > 0 && <span>· {previewable.length} bài xem thử miễn phí</span>}
      </div>

      {current?.video && (
        <div className="mt-4">
          <VideoPlayer videoId={current.video} title={current.title} autoplay />
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="font-semibold text-slate-900">Đang xem thử: {current.title}</p>
            <div className="flex shrink-0 items-center gap-3 text-sm">
              <Link href={`/learn/${slug}?lesson=${active}`} className="font-semibold text-brand-700 hover:underline">Mở trang học →</Link>
              <button onClick={() => setActive(null)} className="text-slate-500 hover:text-slate-800">Đóng ✕</button>
            </div>
          </div>
        </div>
      )}

      <ol className="mt-4 divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {lessons.map((l, i) => {
          const canPreview = !!(l.free && l.video);
          const isActive = active === i;
          const row = (
            <>
              <div className="flex min-w-0 items-center gap-3">
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-semibold ${isActive ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-700"}`}>
                  {isActive ? "▶" : i + 1}
                </span>
                <span className={`truncate font-medium ${isActive ? "text-brand-700" : "text-slate-800"}`}>{l.title}</span>
                {l.free && <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Xem thử</span>}
              </div>
              <div className="flex shrink-0 items-center gap-3 text-sm text-slate-500">
                {hasVideo(i) ? <span title="Bài giảng video">🎬</span> : <span title="Tài liệu đọc">📄</span>}
                {!l.free && <span title="Cần ghi danh">🔒</span>}
                <span>{l.duration}</span>
              </div>
            </>
          );
          return (
            <li key={`${i}-${l.title}`}>
              {canPreview ? (
                <button type="button" onClick={() => setActive(isActive ? null : i)}
                  className={`flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-brand-50/60 ${isActive ? "bg-brand-50" : ""}`}>
                  {row}
                </button>
              ) : (
                <div className="flex items-center justify-between gap-4 px-5 py-4">{row}</div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
