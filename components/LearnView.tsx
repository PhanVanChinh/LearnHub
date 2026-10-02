"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { Course } from "@/data/courses";
import { ApiError, CourseDetail, coursesApi, Progress } from "@/lib/api";
import { fetchCourseDetail, mergeCourse } from "@/lib/liveCourse";
import { formatVND } from "@/lib/site";
import { useAuth } from "./AuthProvider";
import VideoPlayer from "./VideoPlayer";
import QuizPlayer from "./QuizPlayer";
import LessonAttachments from "./LessonAttachments";
import ReviewPrompt from "./ReviewPrompt";
import CertificateButton from "./CertificateButton";

type Access = "checking" | "granted" | "login" | "verify" | "enroll" | "offline";

export default function LearnView({ course: staticCourse, related = [] }: { course: Course; related?: Course[] }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();

  // Chi tiết từ API: biết bài nào có video (has_video) và đã ghi danh chưa
  const [detail, setDetail] = useState<CourseDetail | null>(null);
  useEffect(() => {
    if (loading) return;
    fetchCourseDetail(staticCourse.slug, true).then(setDetail).catch(() => setDetail(null));
  }, [staticCourse.slug, user, loading]);
  // Bài học / tiêu đề mới nhất từ DB (admin sửa là thấy), bản tĩnh chỉ là khởi đầu
  const course = detail ? mergeCourse(staticCourse, detail) : staticCourse;
  const lessons = course.lessons;

  const fromUrl = Number(params.get("lesson"));
  const index = Number.isInteger(fromUrl) && fromUrl >= 0 && fromUrl < lessons.length ? fromUrl : 0;
  const lesson = lessons[index];

  // Video của bài đang xem. Bài free lấy từ dữ liệu tĩnh; bài khác phải hỏi API (kiểm tra ghi danh ở server).
  const [state, setState] = useState<{ access: Access; video: string | null }>({ access: "checking", video: null });
  useEffect(() => {
    if (lesson.free) return setState({ access: "granted", video: lesson.video ?? null });
    if (loading) return setState({ access: "checking", video: null });
    if (!user) return setState({ access: "login", video: null });
    if (!user.email_verified) return setState({ access: "verify", video: null });
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
  const reloadProgress = () => { if (enrolled) coursesApi.progress(course.slug).then(setProgress).catch(() => {}); };
  const isDone = (i: number) => progress?.completed.includes(i) ?? false;
  const toggleDone = async () => {
    if (!enrolled || saving) return;
    setSaving(true);
    try {
      const p = isDone(index) ? await coursesApi.uncomplete(course.slug, index) : await coursesApi.complete(course.slug, index);
      setProgress(p);
      if (!isDone(index) && index < lessons.length - 1) go(index + 1); // vừa hoàn thành → sang bài tiếp
      else if (!isDone(index)) setSummary(true); // vừa hoàn thành bài cuối → màn tổng kết
    } catch { /* giữ trạng thái cũ */ } finally { setSaving(false); }
  };

  const go = (i: number) => {
    if (i < 0 || i >= lessons.length) return;
    setSummary(false);
    router.replace(`/learn/${course.slug}?lesson=${i}`, { scroll: false });
  };

  // Màn tổng kết: mở khi bấm "Hoàn tất khóa học" ở bài cuối hoặc vừa đánh dấu xong bài cuối
  const [summary, setSummary] = useState(false);
  const isLast = index === lessons.length - 1;
  const remaining = progress ? lessons.map((_, i) => i).filter((i) => !progress.completed.includes(i)) : [];

  // Phím ← → chuyển bài
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return; // tổ hợp phím của trình duyệt / hệ điều hành
      const t = e.target as HTMLElement | null;
      // Đang gõ trong ô nhập (input, textarea, select, contenteditable) thì mũi tên là di chuyển con trỏ, không chuyển bài
      if (t && (["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) || t.isContentEditable)) return;
      if (e.key === "ArrowLeft") go(index - 1);
      if (e.key === "ArrowRight") go(index + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const lessonList = (
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
                          <span>{hasVideo(i) ? "🎬" : l.quizCount ? "📝" : l.attachments?.length ? "📚" : "📄"} {l.duration}</span>
                          {!!l.quizCount && <span>{l.quizCount} câu</span>}
                          {!!l.attachments?.length && <span>📎 {l.attachments.length}</span>}
                          {l.free && <span className="rounded-full bg-emerald-500/20 px-1.5 text-emerald-300">Xem thử</span>}
                          {locked && <span>🔒</span>}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
    </ol>
  );

  // Tiến độ + nút chứng nhận + nhắc đánh giá: dùng chung cho sidebar desktop và khối riêng trên mobile
  const progressBlock = progress && (
    <div>
      <div className="flex justify-between text-xs text-slate-300">
        <span>{progress.percent === 100 ? "🎉 Đã hoàn thành khóa học" : `Đã học ${progress.completed.length}/${progress.total} bài`}</span>
        <span className="font-semibold">{progress.percent}%</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full transition-all ${progress.percent === 100 ? "bg-emerald-400" : "bg-brand-500"}`} style={{ width: `${progress.percent}%` }} />
      </div>
      {progress.percent === 100 && <CertificateButton slug={course.slug} />}
      {progress.percent >= 50 && <ReviewPrompt slug={course.slug} completed={progress.percent === 100} />}
    </div>
  );

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-950 text-slate-100">
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
          {summary && enrolled && progress && (
            <section aria-label="Tổng kết khóa học" className="mb-6 rounded-2xl border border-white/10 bg-gradient-to-br from-brand-900/60 to-slate-900 p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-400">Tổng kết</p>
                  <h2 className="mt-1 text-2xl font-bold text-white">
                    {progress.percent === 100 ? "🎉 Bạn đã hoàn thành khóa học!" : `Bạn đã tới bài cuối · còn ${remaining.length} bài chưa hoàn thành`}
                  </h2>
                </div>
                <button onClick={() => setSummary(false)} aria-label="Đóng tổng kết" className="rounded-lg px-2 py-1 text-slate-400 hover:bg-white/10 hover:text-white">✕</button>
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-sm text-slate-300">
                  <span>Đã học {progress.completed.length}/{progress.total} bài</span>
                  <span className="font-semibold text-white">{progress.percent}%</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
                  <div className={`h-full rounded-full transition-all ${progress.percent === 100 ? "bg-emerald-400" : "bg-brand-500"}`} style={{ width: `${progress.percent}%` }} />
                </div>
              </div>

              {progress.percent < 100 ? (
                <div className="mt-4">
                  <p className="text-sm text-slate-300">Hoàn thành các bài sau để nhận chứng nhận:</p>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {remaining.map((i) => (
                      <li key={i}>
                        <button onClick={() => go(i)} className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/10">
                          Bài {i + 1}: <span className="font-medium text-white">{lessons[i].title}</span>
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
          )}
          {access === "granted" && video && <VideoPlayer videoId={video} title={lesson.title} autoplay className="!rounded-xl" />}
          {access === "granted" && !video && !lesson.quizCount && !lesson.attachments?.length && (
            <div className={`grid aspect-video place-items-center rounded-xl bg-gradient-to-br ${course.color} p-8 text-center`}>
              <div>
                <p className="text-5xl">📄</p>
                <p className="mt-3 text-lg font-semibold text-white">Nội dung bài này đang được cập nhật</p>
                <p className="mt-1 text-sm text-white/80">Bài chưa có video hay tài liệu. Hãy chuyển sang bài kế tiếp hoặc quay lại sau.</p>
              </div>
            </div>
          )}
          {access === "granted" && !video && !!lesson.attachments?.length && (
            <div className={`grid aspect-video place-items-center rounded-xl bg-gradient-to-br ${course.color} p-8 text-center`}>
              <div>
                <p className="text-5xl">📚</p>
                <p className="mt-3 text-lg font-semibold text-white">Bài học dạng tài liệu</p>
                <p className="mt-1 text-sm text-white/80">Tải {lesson.attachments.length} tài liệu bên dưới để học.{lesson.quizCount ? " Làm trắc nghiệm sau khi đọc xong." : ""}</p>
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
          {access === "verify" && (
            <div className="grid aspect-video place-items-center rounded-xl border border-amber-500/30 bg-amber-500/10 p-8 text-center">
              <div>
                <p className="text-5xl">✉️</p>
                <p className="mt-3 text-lg font-semibold">Xác thực email để tiếp tục học</p>
                <p className="mt-1 text-sm text-slate-300">Chúng tôi đã gửi mã 6 số tới {user?.email}.</p>
                <Link href={`/verify?next=/learn/${course.slug}?lesson=${index}`} className="btn-primary mt-4">Nhập mã xác thực</Link>
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
                <p className="mt-3 text-xs text-slate-400">Bạn vẫn có thể xem các bài gắn nhãn “Xem thử” ở danh sách bên.</p>
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
              {isLast && enrolled ? (
                <button onClick={() => { setSummary(true); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="btn bg-emerald-600 text-white hover:bg-emerald-700">
                  {progress?.percent === 100 ? "🎉 Hoàn tất khóa học" : "Tổng kết khóa học"}
                </button>
              ) : (
                <button onClick={() => go(index + 1)} disabled={isLast} className="btn-primary disabled:opacity-40">Bài tiếp →</button>
              )}
            </div>
          </div>

          {/* Mobile: tiến độ, chứng nhận, nhắc đánh giá — sidebar bên phải chỉ có trên desktop */}
          {progressBlock && <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 lg:hidden">{progressBlock}</div>}

          {/* Mobile: danh sách bài thu gọn ngay dưới tiêu đề — không phải cuộn qua video/quiz để chuyển bài */}
          <details className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-white/5 lg:hidden">
            <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-semibold text-white marker:content-none">
              <span>Nội dung khóa học <span className="font-normal text-slate-400">· {lessons.length} bài{progress ? ` · ${progress.percent}%` : ""}</span></span>
              <span className="text-slate-400">▾</span>
            </summary>
            <div className="border-t border-white/10">{lessonList}</div>
          </details>

          {!!lesson.attachments?.length && (access === "granted" || access === "enroll" || access === "login") && (
            <div className="mt-6">
              <LessonAttachments slug={course.slug} index={index} attachments={lesson.attachments} locked={access !== "granted"} />
            </div>
          )}

          {access === "granted" && !!lesson.quizCount && (
            <div className="mt-6">
              <QuizPlayer key={`${course.slug}-${index}`} slug={course.slug} index={index} loggedIn={!!user} onCompleted={reloadProgress} />
            </div>
          )}

        </div>

        {/* Danh sách bài */}
        <aside className="hidden lg:sticky lg:top-20 lg:block lg:self-start">
          <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
            <div className="border-b border-white/10 px-4 py-3">
              <p className="font-semibold text-white">Nội dung khóa học</p>
              <p className="text-xs text-slate-400">
                {lessons.length} bài · {lessons.filter((_, i) => hasVideo(i)).length} video
                {lessons.some((l) => l.quizCount) && <> · {lessons.filter((l) => l.quizCount).length} trắc nghiệm</>}
              </p>
              {progressBlock && <div className="mt-2">{progressBlock}</div>}
            </div>
            {lessonList}
          </div>
        </aside>
      </div>
    </div>
  );
}
