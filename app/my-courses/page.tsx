import MyCourses from "@/components/MyCourses";
import { getCourses } from "@/lib/courses.server";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ path: "/my-courses", title: "Khóa học của tôi", noindex: true });

export default async function MyCoursesPage() {
  return <MyCourses courses={await getCourses()} />;
}
