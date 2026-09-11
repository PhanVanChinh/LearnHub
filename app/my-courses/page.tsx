"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import CourseCard from "@/components/CourseCard";
import PageHeader from "@/components/PageHeader";
import { courses } from "@/data/courses";
import { coursesApi, EnrolledCourse } from "@/lib/api";

export default function MyCoursesPage() {
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
  const doneCount = mine.filter((c) => byId.get(c.slug)!.progress.percent === 100).length;

  return (
    <>
      <PageHeader eyebrow="Tài khoản" title="Khóa học của tôi"
        subtitle={user ? `Xin chào ${user.full_name}!${mine.length ? ` Bạn đã hoàn thành ${doneCount}/${mine.length} khóa.` : ""}` : undefined} />
      <div className="container-x py-10">
        {enrolled === null ? (
          <p className="text-slate-500">Đang tải…</p>
        ) : mine.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center">
            <p className="text-slate-600">Bạn chưa ghi danh khóa học nào.</p>
            <Link href="/free" className="btn-primary mt-4">Xem tài liệu miễn phí</Link>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {mine.map((c) => {
              const p = byId.get(c.slug)!.progress;
              const resume = p.next_index ?? 0;
              return (
                <CourseCard key={c.slug} course={c}
                  progress={{ completed: p.completed.length, total: p.total }}
                  action={{ href: `/learn/${c.slug}?lesson=${resume}`, label: p.percent === 100 ? "Xem lại" : p.completed.length ? "▶ Học tiếp" : "▶ Vào học" }} />
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
