"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { Course } from "@/data/courses";
import { ApiError, CourseDetail, coursesApi, Progress } from "@/lib/api";
import { useAuth } from "./AuthProvider";
import VideoPlayer from "./VideoPlayer";

type Access = "checking" | "granted" | "login" | "enroll" | "offline";

export default function LearnView({ course }: { course: Course }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const lessons = course.lessons;

  const fromUrl = Number(params.get("lesson"));
  const index = Number.isInteger(fromUrl) && fromUrl >= 0 && fromUrl < lessons.length ? fromUrl : 0;
  const lesson = lessons[index];

  // Chi tiết từ API: biết bài nào có video (has_video) và đã ghi danh chưa
  const [detail, setDetail] = useState<CourseDetail | null>(null);
  useEffect(() => {
    if (loading) return;
    coursesApi.detail(course.slug).then(setDetail).catch(() => setDetail(null));
  }, [course.slug, user, loading]);

  // Video của bài đang xem. Bài free lấy từ dữ liệu tĩnh; bài khác phải hỏi API (kiểm tra ghi danh ở server).
  const [state, setState] = useState<{ access: Access; video: string | null }>({ access: "checking", video: null });
  useEffect(() => {
    if (lesson.free) return setState({ access: "granted", video: lesson.video ?? null });
    if (loading) return setState({ access: "checking", video: null });
    if (!user) return setState({ access: "login", video: null });
    let cancelled = false;
    setState({ access: "checking", video: null });
    coursesApi.lessonVideo(course.slug, index)
      .then((v) => !cancelled && setState({ access: "granted", video: v.video }))
      .catch((e: ApiError) => {
        if (cancelled) return;
        setState({ access: e.status === 403 ? "enroll" : e.status === 401 ? "login" : "offline", video: null });
      });
    return () => { cancelled = true; };
  }, [course.slug, index, lesson.free, lesson.video, user, loading]);
  const { access, video } = state;
  const enrolled = detail?.enrolled ?? false;
  const hasVideo = (i: number) => detail?.lessons[i]?.has_video ?? !!lessons[i].video;

  // Tiến độ học (chỉ khi đã ghi danh)
  const [progress, setProgress] = useState<Progress | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!enrolled) return setProgress(null);
    coursesApi.progress(course.slug).then(setProgress).catch(() => setProgress(null));
  }, [enrolled, course.slug]);
  const isDone = (i: number) => progress?.completed.includes(i) ?? false;
  const toggleDone = async () => {
    if (!enrolled || saving) return;
    setSaving(true);
    try {
      const p = isDone(index) ? await coursesApi.uncomplete(course.slug, index) : await coursesApi.complete(course.slug, index);
      setProgress(p);
      if (!isDone(index) && index < lessons.length - 1) go(index + 1); // vừa hoàn thành → sang bài tiếp
    } catch { /* giữ trạng thái cũ */ } finally { setSaving(false); }
  };

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
          {access === "granted" && video && <VideoPlayer videoId={video} title={lesson.title} autoplay className="!rounded-xl" />}
          {access === "granted" && !video && (
            <div className={`grid aspect-video place-items-center rounded-xl bg-gradient-to-br ${course.color} p-8 text-center`}>
              <div>
                <p className="text-5xl">📄</p>
                <p className="mt-3 text-lg font-semibold text-white">Bài này là tài liệu đọc</p>
                <p className="mt-1 text-sm text-white/80">Video cho bài học này sẽ được bổ sung. Tài liệu đính kèm nằm trong phần "Khóa học bao gồm".</p>
              </div>
            </div>
          )}
          {access === "checking" && <div className="aspect-video animate-pulse rounded-xl bg-white/10" />}
          {access === "offline" && (
            <div className="grid aspect-video place-items-center rounded-xl border border-rose-500/30 bg-rose-500/10 p-8 text-center">
              <div>
                <p className="text-5xl">⚠️</p>
                <p className="mt-3 text-lg font-semibold">Không kết nối được máy chủ</p>
                <p className="mt-1 text-sm text-slate-300">Video bài trả phí được lấy từ backend. Hãy kiểm tra backend đã chạy chưa.</p>
              </div>
            </div>
          )}
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
            <div className="flex shrink-0 flex-wrap gap-2">
              {enrolled && (
                <button onClick={toggleDone} disabled={saving}
                  className={`btn disabled:opacity-60 ${isDone(index) ? "border border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25" : "bg-emerald-600 text-white hover:bg-emerald-700"}`}>
                  {isDone(index) ? "✓ Đã hoàn thành · Bỏ đánh dấu" : "✓ Hoàn thành bài này"}
                </button>
              )}
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
              <p className="text-xs text-slate-400">{lessons.length} bài · {lessons.filter((_, i) => hasVideo(i)).length} video</p>
              {progress && (
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>{progress.percent === 100 ? "🎉 Đã hoàn thành khóa học" : `Đã học ${progress.completed.length}/${progress.total} bài`}</span>
                    <span className="font-semibold">{progress.percent}%</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className={`h-full rounded-full transition-all ${progress.percent === 100 ? "bg-emerald-400" : "bg-brand-500"}`} style={{ width: `${progress.percent}%` }} />
                  </div>
                </div>
              )}
            </div>
            <ol className="max-h-[70vh] divide-y divide-white/10 overflow-y-auto">
              {lessons.map((l, i) => {
                const locked = !l.free && !enrolled;
                const isActive = i === index;
                return (
                  <li key={`${i}-${l.title}`}>
                    <button onClick={() => go(i)}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-white/10 ${isActive ? "bg-brand-600/30" : ""}`}>
                      <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${isActive ? "bg-brand-500 text-white" : isDone(i) ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-slate-300"}`}>
                        {isActive ? "▶" : isDone(i) ? "✓" : i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-sm ${isActive ? "font-semibold text-white" : "text-slate-200"}`}>{l.title}</span>
                        <span className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                          <span>{hasVideo(i) ? "🎬" : "📄"} {l.duration}</span>
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
