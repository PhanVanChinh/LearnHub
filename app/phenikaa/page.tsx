import Link from "next/link";
import CourseCard from "@/components/CourseCard";
import PageHeader from "@/components/PageHeader";
import { getCourses } from "@/lib/courses.server";
import { faculties } from "@/lib/faculties";
import { pageMeta } from "@/lib/seo";
import { isComingSoon, site } from "@/lib/site";

export const metadata = pageMeta({ path: "/phenikaa", title: `Dành cho ${site.university}`, description: `Khóa học và tài liệu ôn tập theo từng khoa cho sinh viên ${site.university}, bám sát đề cương từng môn.` });

export default async function PhenikaaPage() {
  const courses = await getCourses();
  // Mỗi khoa: khóa thuộc khoa đó, "sắp mở bán" xếp cuối
  const groups = faculties.map((f) => ({
    ...f,
    courses: courses.filter((c) => c.faculty === f.key).sort((a, b) => Number(isComingSoon(a.category)) - Number(isComingSoon(b.category))),
  }));
  const unsorted = courses.filter((c) => !c.faculty).length;

  return (
    <>
      <PageHeader eyebrow="Chương trình riêng" title={`Dành cho sinh viên ${site.university}`} subtitle="Tài liệu sắp xếp theo khoa, bám sát đề cương từng môn. Chọn khoa để nhảy tới phần của bạn." />

      {/* Thẻ khoa: link tới mục tương ứng bên dưới, kèm số khóa */}
      <nav aria-label="Các khoa" className="container-x grid gap-4 py-10 sm:grid-cols-2 lg:grid-cols-5">
        {groups.map((g) => (
          <Link key={g.key} href={`#${g.key}`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:border-brand-300">
            <div className="text-2xl" aria-hidden="true">{g.emoji}</div>
            <h2 className="mt-2 font-semibold text-slate-900">{g.label}</h2>
            <p className="mt-1 line-clamp-2 text-xs text-slate-500">{g.subjects}</p>
            <p className={`mt-3 text-sm font-semibold ${g.courses.length ? "text-brand-700" : "text-slate-400"}`}>
              {g.courses.length ? `${g.courses.length} khóa học →` : "Sắp có"}
            </p>
          </Link>
        ))}
      </nav>

      {groups.map((g) => (
        <section key={g.key} id={g.key} aria-labelledby={`${g.key}-title`} className="container-x scroll-mt-24 py-8">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h2 id={`${g.key}-title`} className="text-2xl font-bold text-slate-900"><span aria-hidden="true">{g.emoji}</span> {g.label}</h2>
              <p className="mt-1 text-sm text-slate-600">{g.subjects}</p>
            </div>
            <p className="text-sm text-slate-500">{g.courses.length ? `${g.courses.length} khóa học & tài liệu` : "Chưa có tài liệu"}</p>
          </div>
          {g.courses.length ? (
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {g.courses.map((c) => <CourseCard key={c.slug} course={c} />)}
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
              <p>Tài liệu cho khoa này đang được biên soạn.</p>
              <p className="mt-1">Cần gấp môn nào? <Link href="/contact" className="font-semibold text-brand-700 hover:underline">Nhắn cho chúng tôi</Link>, môn được hỏi nhiều sẽ làm trước.</p>
            </div>
          )}
        </section>
      ))}

      {unsorted > 0 && (
        <p className="container-x pb-12 text-sm text-slate-500">
          Còn {unsorted} khóa chưa xếp khoa, xem tại <Link href="/courses" className="font-semibold text-brand-700 hover:underline">Tất cả khóa học</Link>.
        </p>
      )}
    </>
  );
}
