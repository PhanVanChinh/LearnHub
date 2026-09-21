"use client";
import Link from "next/link";
import CourseCard from "@/components/CourseCard";
import CourseStatsLine from "@/components/CourseStatsLine";
import EnrollButton from "@/components/EnrollButton";
import LessonList from "@/components/LessonList";
import CourseReviews from "@/components/CourseReviews";
import { youtubeThumb } from "@/components/VideoPlayer";
import type { Course } from "@/data/courses";
import { totalDuration } from "@/lib/duration";
import { useLiveCourse } from "@/lib/liveCourse";
import { formatVND } from "@/lib/site";

/** Thân trang chi tiết. Nhận bản tĩnh (build) rồi tự làm mới giá / mô tả / bài học từ API. */
export default function CourseDetailView({ course: initial, related }: { course: Course; related: Course[] }) {
  const { course } = useLiveCourse(initial);
  const previewVideo = course.lessons.find((l) => l.free && l.video)?.video;

  return (
    <>
      <section className={`bg-gradient-to-br ${course.color} text-white`}>
        <div className="container-x py-14">
          <nav className="text-sm text-white/75">
            <Link href="/" className="hover:text-white">Trang chủ</Link> / <Link href="/courses" className="hover:text-white">Khóa học</Link>
          </nav>
          <div className="mt-4 flex items-start gap-5">
            <span className="hidden text-6xl sm:block">{course.emoji}</span>
            <div>
              <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{course.title}</h1>
              <p className="mt-3 max-w-2xl text-white/85">{course.short}</p>
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-white/80">
                <CourseStatsLine slug={course.slug} lessons={course.lessons.length} />
                <span>⏱ {totalDuration(course.lessons)}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="container-x grid gap-8 py-12 lg:grid-cols-3">
        <div className="space-y-10 lg:col-span-2">
          <section>
            <h2 className="text-xl font-bold text-slate-900">Mô tả</h2>
            <p className="mt-3 leading-7 text-slate-600">{course.description}</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-slate-900">Nội dung</h2>
            <LessonList lessons={course.lessons} slug={course.slug} />
          </section>
          <section id="reviews">
            <h2 className="text-xl font-bold text-slate-900">Đánh giá của học viên</h2>
            <CourseReviews slug={course.slug} />
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
            {previewVideo ? (
              <div className="relative aspect-video overflow-hidden rounded-xl bg-slate-900">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={youtubeThumb(previewVideo)} alt="" className="h-full w-full object-cover opacity-90" />
                <span className="absolute inset-0 grid place-items-center">
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-white/90 text-2xl text-brand-700 shadow-lg">▶</span>
                </span>
                <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white">Có bài xem thử</span>
              </div>
            ) : (
              <div className={`grid aspect-video place-items-center rounded-xl bg-gradient-to-br ${course.color} text-5xl`}>{course.emoji}</div>
            )}
            <p className={`mt-5 text-3xl font-bold ${course.price === 0 ? "text-emerald-600" : "text-brand-700"}`}>{formatVND(course.price)}</p>
            <EnrollButton slug={course.slug} price={course.price} category={course.category} />
            <ul className="mt-5 space-y-2 text-sm text-slate-600">
              {course.includes.map((x) => <li key={x}>✅ {x}</li>)}
            </ul>
          </div>
        </aside>
      </div>

      {related.length > 0 && (
        <section className="container-x pb-8">
          <h2 className="text-xl font-bold text-slate-900">Khóa học liên quan</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((c) => <CourseCard key={c.slug} course={c} />)}
          </div>
        </section>
      )}
    </>
  );
}
