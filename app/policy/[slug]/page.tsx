import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { site } from "@/lib/site";

const policies: Record<string, { title: string; body: string[] }> = {
  terms: { title: "Điều khoản sử dụng", body: ["Khi sử dụng website, bạn đồng ý không chia sẻ lại tài liệu đã mua cho bên thứ ba.", "Tài khoản là cá nhân, không dùng chung.", "Chúng tôi có quyền tạm khoá tài khoản vi phạm."] },
  privacy: { title: "Chính sách bảo mật", body: ["Thông tin cá nhân chỉ dùng để giao tài liệu và hỗ trợ.", "Không bán, không chia sẻ dữ liệu cho bên thứ ba.", "Mật khẩu được mã hoá một chiều."] },
  payment: { title: "Chính sách thanh toán", body: ["Hỗ trợ chuyển khoản ngân hàng, MoMo, ZaloPay.", "Đơn hàng được xác nhận tự động trong 1–5 phút."] },
  delivery: { title: "Chính sách giao nhận", body: ["Tài liệu số được mở khoá ngay trong tài khoản sau khi thanh toán thành công.", "Đồng thời gửi link tải qua email đăng ký."] },
  refund: { title: "Chính sách hoàn tiền", body: ["Hoàn 100% nếu tài liệu không đúng mô tả trong 7 ngày.", "Liên hệ " + site.contact.email + " để được hỗ trợ."] },
};

export function generateStaticParams() { return Object.keys(policies).map((slug) => ({ slug })); }

export default function PolicyPage({ params }: { params: { slug: string } }) {
  const p = policies[params.slug];
  if (!p) notFound();
  return (
    <>
      <PageHeader eyebrow="Chính sách" title={p.title} />
      <div className="container-x max-w-3xl py-12">
        <ol className="space-y-4 leading-7 text-slate-700">
          {p.body.map((t, i) => <li key={i} className="rounded-xl border border-slate-200 bg-white p-5">{i + 1}. {t}</li>)}
        </ol>
      </div>
    </>
  );
}
