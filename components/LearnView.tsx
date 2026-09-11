"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Course } from "@/data/courses";
import { coursesApi } from "@/lib/api";
import { useAuth } from "./AuthProvider";
import VideoPlayer from "./VideoPlayer";

type Access = "checking" | "granted" | "login" | "enroll";

export default function LearnView({ course }: { course: Course }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const lessons = course.lessons;

  const fromUrl = Number(params.get("lesson"));
  const index = Number.isInteger(fromUrl) && fromUrl >= 0 && fromUrl < lessons.length ? fromUrl : 0;
  const lesson = lessons[index];

  // Quyền xem: bài free → ai cũng xem; còn lại cần đăng nhập + đã ghi danh
  const [enrolled, setEnrolled] = useState<boolean | null>(null);
  useEffect(() => {
    if (loading) return;
    if (!user) return setEnrolled(false);
    coursesApi.detail(course.slug).then((d) => setEnrolled(d.enrolled)).catch(() => setEnrolled(false));
  }, [user, loading, course.slug]);

  const access: Access = useMemo(() => {
    if (lesson.free) return "granted";
    if (loading || (user && enrolled === null)) return "checking";
    if (!user) return "login";
    return enrolled ? "granted" : "enroll";
  }, [lesson.free, loading, user, enrolled]);

  const go = (i: number) => {
    if (i < 0 || i >= lessons.length) return;
    router.replace(`/learn/${course.slug}?lesson=${i}`, { scroll: false });
  };

  // Phím ← → chuyển bài
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "ArrowLeft") go(index - 1);
      if (e.key === "ArrowRight") go(index + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  return (
    <div className="bg-slate-950 text-slate-100">
      {/* Thanh trên */}
      <div className="border-b border-white/10">
        <div className="container-x flex h-14 items-center gap-4">
          <Link href={`/courses/${course.slug}`} className="shrink-0 text-sm text-slate-300 hover:text-white">← Trang khóa học</Link>
          <span className="hidden truncate text-sm font-medium text-white sm:block">{course.emoji} {course.title}</span>
          <span className="ml-auto shrink-0 text-xs text-slate-400">Bài {index + 1}/{lessons.length}</span>
        </div>
      </div>

      <div className="container-x grid gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* Khu vực nội dung */}
        <div className="min-w-0">
          {access === "granted" && lesson.video && <VideoPlayer videoId={lesson.video} title={lesson.title} autoplay className="!rounded-xl" />}
          {access === "granted" && !lesson.video && (
            <div className={`grid aspect-video place-items-center rounded-xl bg-gradient-to-br ${course.color} p-8 text-center`}>
              <div>
                <p className="text-5xl">📄</p>
                <p className="mt-3 text-lg font-semibold text-white">Bài này là tài liệu đọc</p>
                <p className="mt-1 text-sm text-white/80">Video cho bài học này sẽ được bổ sung. Tài liệu đính kèm nằm trong phần "Khóa học bao gồm".</p>
              </div>
            </div>
          )}
          {access === "checking" && <div className="aspect-video animate-pulse rounded-xl bg-white/10" />}
          {(access === "login" || access === "enroll") && (
            <div className="grid aspect-video place-items-center rounded-xl border border-white/10 bg-white/5 p-8 text-center">
              <div>
                <p className="text-5xl">🔒</p>
                <p className="mt-3 text-lg font-semibold">Bài học dành cho học viên đã ghi danh</p>
                {access === "login" ? (
                  <Link href={`/login?next=/learn/${course.slug}?lesson=${index}`} className="btn-primary mt-4">Đăng nhập để tiếp tục</Link>
                ) : (
                  <Link href={`/courses/${course.slug}`} className="btn-primary mt-4">{course.price === 0 ? "Ghi danh miễn phí" : "Mua khóa học"}</Link>
                )}
                <p className="mt-3 text-xs text-slate-400">Bạn vẫn có thể xem các bài gắn nhãn "Xem thử" ở danh sách bên.</p>
              </div>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wider text-slate-400">Bài {index + 1}</p>
              <h1 className="mt-1 text-xl font-bold text-white sm:text-2xl">{lesson.title}</h1>
              <p className="mt-1 text-sm text-slate-400">⏱ {lesson.duration}{lesson.free && " · Xem thử miễn phí"}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button onClick={() => go(index - 1)} disabled={index === 0} className="btn border border-white/15 bg-white/5 text-white hover:bg-white/10 disabled:opacity-40">← Bài trước</button>
              <button onClick={() => go(index + 1)} disabled={index === lessons.length - 1} className="btn-primary disabled:opacity-40">Bài tiếp →</button>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-5 text-sm leading-6 text-slate-300">
            <p className="font-semibold text-white">Về khóa học</p>
            <p className="mt-2">{course.description}</p>
          </div>
        </div>

        {/* Danh sách bài */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
            <div className="border-b border-white/10 px-4 py-3">
              <p className="font-semibold text-white">Nội dung khóa học</p>
              <p className="text-xs text-slate-400">{lessons.length} bài · {lessons.filter((l) => l.video).length} video</p>
            </div>
            <ol className="max-h-[70vh] divide-y divide-white/10 overflow-y-auto">
              {lessons.map((l, i) => {
                const locked = !l.free && access !== "granted" && !(user && enrolled);
                const isActive = i === index;
                return (
                  <li key={`${i}-${l.title}`}>
                    <button onClick={() => go(i)}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-white/10 ${isActive ? "bg-brand-600/30" : ""}`}>
                      <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${isActive ? "bg-brand-500 text-white" : "bg-white/10 text-slate-300"}`}>
                        {isActive ? "▶" : i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-sm ${isActive ? "font-semibold text-white" : "text-slate-200"}`}>{l.title}</span>
                        <span className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                          <span>{l.video ? "🎬" : "📄"} {l.duration}</span>
                          {l.free && <span className="rounded-full bg-emerald-500/20 px-1.5 text-emerald-300">Xem thử</span>}
                          {locked && <span>🔒</span>}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}
