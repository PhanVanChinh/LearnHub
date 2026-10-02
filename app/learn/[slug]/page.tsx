import { Suspense } from "react";
import { notFound } from "next/navigation";
import LearnView from "@/components/LearnView";
import { getCourse, getCourses } from "@/lib/courses.server";
import { pageMeta } from "@/lib/seo";
import { isComingSoon } from "@/lib/site";

export async function generateStaticParams() {
  return (await getCourses()).map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const c = await getCourse(params.slug);
  return pageMeta({ path: `/learn/${params.slug}`, title: c ? `Học: ${c.title}` : "Không tìm thấy", noindex: true });
}

export default async function LearnPage({ params }: { params: { slug: string } }) {
  const course = await getCourse(params.slug);
  if (!course) notFound();
  // Gợi ý học tiếp ở màn tổng kết: cùng danh mục, đang bán, không phải khóa này
  const related = (await getCourses()).filter((c) => c.category === course.category && c.slug !== course.slug && !isComingSoon(c.category)).slice(0, 3);
  // ?lesson=<index> đọc ở client nên cần Suspense để xuất tĩnh
  return <Suspense><LearnView course={course} related={related} /></Suspense>;
}
