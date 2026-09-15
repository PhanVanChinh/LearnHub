import { notFound } from "next/navigation";
import CourseDetailView from "@/components/CourseDetailView";
import { getCourse, getCourses } from "@/lib/courses.server";

export async function generateStaticParams() {
  return (await getCourses()).map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const c = await getCourse(params.slug);
  return { title: c?.title ?? "Không tìm thấy" };
}

export default async function CourseDetail({ params }: { params: { slug: string } }) {
  const course = await getCourse(params.slug);
  if (!course) notFound();
  const courses = await getCourses();
  const related = courses.filter((c) => c.category === course.category && c.slug !== course.slug).slice(0, 4);
  return <CourseDetailView course={course} related={related} />;
}
