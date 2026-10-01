import CourseBrowser from "@/components/CourseBrowser";
import PageHeader from "@/components/PageHeader";
import { getCourses } from "@/lib/courses.server";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ path: "/courses", title: "Tất cả khóa học", description: "Toàn bộ khóa học và tài liệu của LearnHub: video bài giảng, slide PDF, source code và trắc nghiệm, bám sát chương trình trên lớp." });

export default async function CoursesPage() {
  const courses = await getCourses();
  return (
    <>
      <PageHeader eyebrow="Thư viện" title="Tất cả khóa học" subtitle="Video, PDF, trắc nghiệm, source code — lọc theo danh mục hoặc tìm theo tên môn." />
      <div className="container-x py-10">
        <CourseBrowser courses={courses} pageSize={12} syncUrl />
      </div>
    </>
  );
}
