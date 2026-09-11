import { Suspense } from "react";
import { notFound } from "next/navigation";
import LearnView from "@/components/LearnView";
import { courses, getCourse } from "@/data/courses";

export function generateStaticParams() {
  return courses.map((c) => ({ slug: c.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const c = getCourse(params.slug);
  return { title: c ? `Học: ${c.title}` : "Không tìm thấy" };
}

export default function LearnPage({ params }: { params: { slug: string } }) {
  const course = getCourse(params.slug);
  if (!course) notFound();
  // ?lesson=<index> đọc ở client nên cần Suspense để xuất tĩnh
  return <Suspense><LearnView course={course} /></Suspense>;
}
