import PageHeader from "@/components/PageHeader";
import AiCheckTool from "@/components/AiCheckTool";

export const metadata = { title: "AI Check bài viết" };

const steps = [
  ["1", "Dán nội dung", "Dán trực tiếp phần bài viết bạn muốn kiểm tra (từ 80 từ). Chưa hỗ trợ tải file .docx/.pdf."],
  ["2", "Claude phân tích", "Mô hình ngôn ngữ đọc toàn văn, ước lượng khả năng do AI viết và chỉ ra dấu hiệu cụ thể."],
  ["3", "Nhận gợi ý", "Điểm tổng, đoạn đáng chú ý, nhận xét học thuật và gợi ý chỉnh sửa để bài tự nhiên hơn."],
];

const limits = [
  ["Không đối chiếu internet", "Công cụ không kiểm tra đạo văn với nguồn bên ngoài. Trường bạn dùng Turnitin hay DoIT thì kết quả có thể khác."],
  ["Chỉ mang tính tham khảo", "Không công cụ nào phát hiện chắc chắn văn bản AI. Dùng để tự chỉnh sửa, không dùng làm bằng chứng."],
  ["Không lưu văn bản", "Bài viết chỉ được gửi đi phân tích, không lưu trên hệ thống sau khi trả kết quả."],
];

export default function AiCheckPage() {
  return (
    <>
      <PageHeader eyebrow="Công cụ" title="AI Check bài viết" subtitle="Rà soát dấu hiệu văn bản do AI viết trong tiểu luận, báo cáo, khoá luận và nhận gợi ý chỉnh sửa trước khi nộp." />
      <div className="container-x grid gap-8 py-12 lg:grid-cols-5">
        <div className="lg:col-span-3"><AiCheckTool /></div>
        <div className="space-y-4 lg:col-span-2">
          {steps.map(([n, t, d]) => (
            <div key={n} className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-600 font-bold text-white">{n}</span>
              <div><h3 className="font-semibold text-slate-900">{t}</h3><p className="mt-1 text-sm text-slate-600">{d}</p></div>
            </div>
          ))}
        </div>
      </div>
      <section className="container-x pb-12">
        <h2 className="text-xl font-bold text-slate-900">Giới hạn bạn cần biết</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {limits.map(([t, d]) => (
            <div key={t} className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="font-semibold text-slate-900">{t}</h3>
              <p className="mt-1 text-sm text-slate-600">{d}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-sm text-slate-500">
          Mỗi tài khoản có hạn mức lượt kiểm tra mỗi ngày. Gói mở rộng lượt kiểm tra đang được chuẩn bị và sẽ mở bán sau.
        </p>
      </section>
    </>
  );
}
