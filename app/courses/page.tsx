import CourseBrowser from "@/components/CourseBrowser";
import PageHeader from "@/components/PageHeader";
import { getCourses } from "@/lib/courses.server";

export const metadata = { title: "Tất cả khóa học" };

export default async function CoursesPage() {
  const courses = await getCourses();
  return (
    <>
      <PageHeader eyebrow="Thư viện" title="Tất cả khóa học" subtitle="Video, PDF, trắc nghiệm, source code — lọc theo danh mục hoặc tìm theo tên môn." />
      <div className="container-x py-10">
        <CourseBrowser courses={courses} pageSize={12} />
      </div>
    </>
  );
}
