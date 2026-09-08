import PageHeader from "@/components/PageHeader";
import AiCheckDemo from "@/components/AiCheckDemo";
import CourseCard from "@/components/CourseCard";
import { courses } from "@/data/courses";

export const metadata = { title: "AI Check đạo văn" };

const steps = [
  ["1", "Tải lên hoặc dán nội dung", "Hỗ trợ .docx, .pdf hoặc dán trực tiếp văn bản."],
  ["2", "Hệ thống phân tích", "Đối chiếu với kho dữ liệu và mô hình phát hiện nội dung AI."],
  ["3", "Nhận báo cáo", "Tỷ lệ trùng theo đoạn, nguồn trùng và gợi ý chỉnh sửa."],
];

export default function AiCheckPage() {
  return (
    <>
      <PageHeader eyebrow="Công cụ" title="AI Check đạo văn & nội dung AI" subtitle="Kiểm tra khoá luận, tiểu luận, báo cáo thực tập trước khi nộp — nhanh, chi tiết, bảo mật." />
      <div className="container-x grid gap-8 py-12 lg:grid-cols-5">
        <div className="lg:col-span-3"><AiCheckDemo /></div>
        <div className="space-y-4 lg:col-span-2">
          {steps.map(([n, t, d]) => (
            <div key={n} className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-600 font-bold text-white">{n}</span>
              <div><h3 className="font-semibold text-slate-900">{t}</h3><p className="mt-1 text-sm text-slate-600">{d}</p></div>
            </div>
          ))}
        </div>
      </div>
      <section className="container-x pb-8">
        <h2 className="text-xl font-bold text-slate-900">Gói kiểm tra</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {courses.filter((c) => c.category === "ai-check").map((c) => <CourseCard key={c.slug} course={c} />)}
        </div>
      </section>
    </>
  );
}
