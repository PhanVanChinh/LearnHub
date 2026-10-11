"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import CourseCard from "@/components/CourseCard";
import PageHeader from "@/components/PageHeader";
import type { Course } from "@/data/courses";
import { coursesApi, EnrolledCourse } from "@/lib/api";

export default function MyCourses({ courses }: { courses: Course[] }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [enrolled, setEnrolled] = useState<EnrolledCourse[] | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) return router.replace("/login?next=/my-courses");
    coursesApi.mine().then(setEnrolled).catch(() => setEnrolled([]));
  }, [user, loading, router]);

  const byId = new Map(enrolled?.map((e) => [e.slug, e]) ?? []);
  const mine = enrolled ? courses.filter((c) => byId.has(c.slug)) : [];
  // Ghi danh vào khóa chưa có trong bản build tĩnh (admin vừa tạo, chưa Xuất bản): vẫn liệt kê, chờ website cập nhật
  const known = new Set(mine.map((c) => c.slug));
  const pending = enrolled?.filter((e) => !known.has(e.slug)) ?? [];
  const doneCount = mine.filter((c) => byId.get(c.slug)!.progress.percent === 100).length;

  return (
    <>
      <PageHeader eyebrow="Tài khoản" title="Khóa học của tôi"
        subtitle={user ? `Xin chào ${user.full_name}!${mine.length ? ` Bạn đã hoàn thành ${doneCount}/${mine.length} khóa.` : ""}` : undefined} />
      <div className="container-x py-10">
        {enrolled === null ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-busy="true" aria-label="Đang tải">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />)}
          </div>
        ) : mine.length === 0 && pending.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center">
            <p className="text-slate-600">Bạn chưa ghi danh khóa học nào.</p>
            <Link href="/free" className="btn-primary mt-4">Xem tài liệu miễn phí</Link>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {mine.map((c) => {
              const p = byId.get(c.slug)!.progress;
              // Ưu tiên bài xem gần nhất (đúng chỗ đang dở), rồi mới tới bài chưa hoàn thành đầu tiên
              const resume = p.last_index ?? p.next_index ?? 0;
              const started = p.last_index != null || p.completed.length > 0;
              return (
                <CourseCard key={c.slug} course={c}
                  progress={{ completed: p.completed.length, total: p.total }}
                  action={p.percent === 100
                    ? { href: `/learn/${c.slug}?lesson=${p.last_index ?? 0}`, label: "🎓 Xem lại / chứng nhận" }
                    : { href: `/learn/${c.slug}?lesson=${resume}`, label: started ? `▶ Học tiếp bài ${resume + 1}` : "▶ Vào học" }} />
              );
            })}
            {pending.map((e) => (
              <article key={e.slug} className="flex h-full flex-col overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-white">
                <div className={`grid aspect-[16/9] place-items-center bg-gradient-to-br ${e.color} text-6xl`} aria-hidden="true">{e.emoji}</div>
                <div className="flex flex-1 flex-col p-4">
                  <h3 className="line-clamp-2 text-base font-semibold text-slate-900">{e.title}</h3>
                  <p className="mt-1.5 text-sm text-slate-600">Bạn đã ghi danh. Trang học của khóa này đang được cập nhật lên website, quay lại sau vài phút.</p>
                  <p className="mt-auto pt-4 text-xs text-slate-500">Nếu quá 1 giờ vẫn chưa vào được, <Link href="/contact" className="font-semibold text-brand-700 hover:underline">liên hệ hỗ trợ</Link>.</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
