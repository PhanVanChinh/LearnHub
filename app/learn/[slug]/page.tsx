import { Suspense } from "react";
import { notFound } from "next/navigation";
import LearnView from "@/components/LearnView";
import { getCourse, getCourses } from "@/lib/courses.server";

export async function generateStaticParams() {
  return (await getCourses()).map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const c = await getCourse(params.slug);
  return { title: c ? `Học: ${c.title}` : "Không tìm thấy" };
}

export default async function LearnPage({ params }: { params: { slug: string } }) {
  const course = await getCourse(params.slug);
  if (!course) notFound();
  // ?lesson=<index> đọc ở client nên cần Suspense để xuất tĩnh
  return <Suspense><LearnView course={course} /></Suspense>;
}
