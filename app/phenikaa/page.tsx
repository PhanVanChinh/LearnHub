import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { site } from "@/lib/site";

export const metadata = { title: `Dành cho ${site.university}` };

const faculties = [
  ["Công nghệ thông tin", "Lập trình C, CTDL&GT, CSDL, Mạng máy tính, Hệ điều hành"],
  ["Kinh tế & Kinh doanh", "Kinh tế vi mô/vĩ mô, Nguyên lý kế toán, Marketing căn bản"],
  ["Khoa học cơ bản", "Giải tích, Đại số tuyến tính, Xác suất thống kê, Vật lý đại cương"],
  ["Đại cương", "Triết học, Kinh tế chính trị, Tư tưởng HCM, Lịch sử Đảng, Tiếng Anh B1"],
];

export default function PhenikaaPage() {
  return (
    <>
      <PageHeader eyebrow="Chương trình riêng" title={`Dành cho sinh viên ${site.university}`} subtitle="Tài liệu sắp xếp theo khoa và học kỳ, cập nhật theo đề cương mới nhất." />
      <div className="container-x grid gap-5 py-12 sm:grid-cols-2">
        {faculties.map(([f, d]) => (
          <Link key={f} href="/courses" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card transition hover:border-brand-300">
            <h3 className="text-lg font-semibold text-slate-900">{f}</h3>
            <p className="mt-2 text-sm text-slate-600">{d}</p>
            <span className="mt-4 inline-block text-sm font-semibold text-brand-700">Xem tài liệu →</span>
          </Link>
        ))}
      </div>
    </>
  );
}
