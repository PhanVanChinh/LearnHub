"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import CourseCard from "@/components/CourseCard";
import PageHeader from "@/components/PageHeader";
import { courses } from "@/data/courses";
import { coursesApi } from "@/lib/api";

export default function MyCoursesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [slugs, setSlugs] = useState<string[] | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) return router.replace("/login?next=/my-courses");
    coursesApi.mine().then((list) => setSlugs(list.map((c) => c.slug))).catch(() => setSlugs([]));
  }, [user, loading, router]);

  const mine = slugs ? courses.filter((c) => slugs.includes(c.slug)) : [];

  return (
    <>
      <PageHeader eyebrow="Tài khoản" title="Khóa học của tôi" subtitle={user ? `Xin chào ${user.full_name}!` : undefined} />
      <div className="container-x py-10">
        {slugs === null ? (
          <p className="text-slate-500">Đang tải…</p>
        ) : mine.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center">
            <p className="text-slate-600">Bạn chưa ghi danh khóa học nào.</p>
            <Link href="/free" className="btn-primary mt-4">Xem tài liệu miễn phí</Link>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {mine.map((c) => <CourseCard key={c.slug} course={c} action={{ href: `/learn/${c.slug}`, label: "▶ Vào học" }} />)}
          </div>
        )}
      </div>
    </>
  );
}
