import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { site } from "@/lib/site";
import { absUrl } from "@/lib/seo";
import CourseDetailView from "@/components/CourseDetailView";
import { getCourse, getCourses } from "@/lib/courses.server";

export async function generateStaticParams() {
  return (await getCourses()).map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const c = await getCourse(params.slug);
  if (!c) return { title: "Không tìm thấy" };
  const description = c.short.length > 20 ? c.short : c.description.slice(0, 160);
  return {
    title: c.title,
    description,
    alternates: { canonical: absUrl(`/courses/${c.slug}`) },
    openGraph: { type: "website", title: c.title, description, url: absUrl(`/courses/${c.slug}`), siteName: site.name, locale: "vi_VN" },
    twitter: { card: "summary_large_image", title: c.title, description },
  };
}

export default async function CourseDetail({ params }: { params: { slug: string } }) {
  const course = await getCourse(params.slug);
  if (!course) notFound();
  const courses = await getCourses();
  const related = courses.filter((c) => c.category === course.category && c.slug !== course.slug).slice(0, 4);
  // Dữ liệu có cấu trúc (schema.org/Course) để Google hiện rich result
  const jsonLd = {
    "@context": "https://schema.org", "@type": "Course", name: course.title, description: course.short, url: absUrl(`/courses/${course.slug}`),
    provider: { "@type": "Organization", name: site.name, url: absUrl("/") },
    inLanguage: "vi", isAccessibleForFree: course.price === 0,
    offers: { "@type": "Offer", price: course.price, priceCurrency: "VND", availability: "https://schema.org/InStock", url: absUrl(`/courses/${course.slug}`) },
    hasCourseInstance: { "@type": "CourseInstance", courseMode: "online", courseWorkload: `PT${course.lessons.length}H` },
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <CourseDetailView course={course} related={related} />
    </>
  );
}
