import MyCourses from "@/components/MyCourses";
import { getCourses } from "@/lib/courses.server";

export const metadata = { title: "Khóa học của tôi" };

export default async function MyCoursesPage() {
  return <MyCourses courses={await getCourses()} />;
}
