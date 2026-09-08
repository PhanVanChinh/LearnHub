import CourseBrowser from "@/components/CourseBrowser";
import PageHeader from "@/components/PageHeader";
import { courses } from "@/data/courses";

export const metadata = { title: "Tài liệu miễn phí" };

export default function FreePage() {
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
