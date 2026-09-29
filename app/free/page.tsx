import CourseBrowser from "@/components/CourseBrowser";
import PageHeader from "@/components/PageHeader";
import { getCourses } from "@/lib/courses.server";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ path: "/free", title: "Tài liệu miễn phí", description: "Tài liệu và khóa học miễn phí cho sinh viên: xem thử video, tải slide và làm trắc nghiệm không cần thanh toán." });

export default async function FreePage() {
  const courses = await getCourses();
  const free = courses.filter((c) => c.price === 0);
  return (
    <>
      <PageHeader eyebrow="Miễn phí 100%" title="Tài liệu miễn phí" subtitle="Đăng nhập là học được ngay, không cần thanh toán." />
      <div className="container-x py-10">
        <CourseBrowser courses={free} initial="free" pageSize={12} />
      </div>
    </>
  );
}
