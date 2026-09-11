import Link from "next/link";
import { notFound } from "next/navigation";
import CourseCard from "@/components/CourseCard";
import EnrollButton from "@/components/EnrollButton";
import LessonList from "@/components/LessonList";
import { youtubeThumb } from "@/components/VideoPlayer";
import { courses, getCourse } from "@/data/courses";
import { formatVND } from "@/lib/site";

export function generateStaticParams() {
  return courses.map((c) => ({ slug: c.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const c = getCourse(params.slug);
  return { title: c?.title ?? "Không tìm thấy" };
}

export default function CourseDetail({ params }: { params: { slug: string } }) {
  const course = getCourse(params.slug);
  if (!course) notFound();
  const previewVideo = course.lessons.find((l) => l.free && l.video)?.video;
  const related = courses.filter((c) => c.category === course.category && c.slug !== course.slug).slice(0, 4);

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
                <span>👁 {course.views.toLocaleString("vi-VN")} lượt xem</span>
                <span>🛍 {course.sold} đã mua</span>
                <span>⭐ 4.9 (120 đánh giá)</span>
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
            <LessonList lessons={course.lessons} />
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
            <EnrollButton slug={course.slug} price={course.price} />
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
