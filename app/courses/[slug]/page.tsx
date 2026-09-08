import Link from "next/link";
import { notFound } from "next/navigation";
import CourseCard from "@/components/CourseCard";
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
            <ol className="mt-4 divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {course.lessons.map((l, i) => (
                <li key={l.title} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">{i + 1}</span>
                    <span className="font-medium text-slate-800">{l.title}</span>
                    {l.free && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Xem thử</span>}
                  </div>
                  <span className="text-sm text-slate-500">{l.duration}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
            <div className={`grid aspect-video place-items-center rounded-xl bg-gradient-to-br ${course.color} text-5xl`}>{course.emoji}</div>
            <p className={`mt-5 text-3xl font-bold ${course.price === 0 ? "text-emerald-600" : "text-brand-700"}`}>{formatVND(course.price)}</p>
            <Link href={course.price === 0 ? "/login" : `/checkout?course=${course.slug}`} className="btn-primary mt-4 w-full !py-3">
              {course.price === 0 ? "Bắt đầu học miễn phí" : "Mua ngay"}
            </Link>
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
