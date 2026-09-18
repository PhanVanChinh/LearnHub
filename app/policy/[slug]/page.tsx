import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { site } from "@/lib/site";

type Section = { h: string; items: string[] };
type Policy = { title: string; updated: string; intro?: string; sections: Section[]; actions?: { href: string; label: string }[] };

const UPDATED = "18/09/2026";

// Nội dung mô tả ĐÚNG cách hệ thống đang vận hành. Khi thêm cổng thanh toán, dịch vụ bên thứ ba... hãy cập nhật lại tại đây.
const policies: Record<string, Policy> = {
  privacy: {
    title: "Chính sách bảo mật & dữ liệu cá nhân",
    updated: UPDATED,
    intro: `${site.name} tôn trọng quyền riêng tư của bạn. Chính sách này mô tả dữ liệu chúng tôi thu thập, mục đích sử dụng, thời gian lưu và quyền của bạn theo Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân.`,
    sections: [
      { h: "1. Dữ liệu chúng tôi thu thập", items: [
        "Thông tin tài khoản: họ tên, email, mật khẩu (chỉ lưu dạng băm một chiều bcrypt, không thể đọc lại).",
        "Nếu đăng nhập Google: mã định danh Google, ảnh đại diện. Chúng tôi không nhận mật khẩu Google.",
        "Hoạt động học: khóa đã ghi danh, bài đã hoàn thành, kết quả trắc nghiệm.",
        "Giao dịch: mã đơn, khóa học, số tiền, trạng thái, thời điểm thanh toán. Chúng tôi không nhận hay lưu thông tin thẻ/tài khoản ngân hàng của bạn — bạn chuyển khoản trực tiếp qua ngân hàng.",
        "Liên hệ: tên, email và nội dung tin nhắn bạn gửi qua form Liên hệ.",
        "AI Check: chỉ lưu số từ, điểm và thời điểm mỗi lượt để tính hạn mức. Văn bản bạn dán KHÔNG được lưu.",
        "Kỹ thuật: địa chỉ IP và thời điểm đăng nhập để chống lạm dụng (giới hạn tần suất, khoá tạm khi sai mật khẩu) và ghi nhật ký các thao tác quản trị.",
      ]},
      { h: "2. Mục đích sử dụng", items: [
        "Cung cấp dịch vụ: đăng nhập, mở khóa học, lưu tiến độ, chấm trắc nghiệm.",
        "Xử lý đơn hàng và gửi email xác nhận, hướng dẫn thanh toán.",
        "Hỗ trợ khách hàng qua email bạn cung cấp.",
        "Bảo mật hệ thống: phát hiện đăng nhập bất thường, chống spam.",
        "Chúng tôi không dùng dữ liệu của bạn để quảng cáo, không bán hay cho thuê dữ liệu cho bên thứ ba.",
      ]},
      { h: "3. Cơ sở pháp lý", items: [
        "Sự đồng ý của bạn khi đăng ký (tick 'Đồng ý điều khoản & chính sách bảo mật') và khi chủ động gửi form.",
        "Thực hiện hợp đồng mua khóa học.",
        "Nghĩa vụ pháp luật: lưu chứng từ giao dịch theo quy định kế toán.",
      ]},
      { h: "4. Bên thứ ba xử lý dữ liệu thay chúng tôi", items: [
        "Resend (gửi email): nhận email và nội dung thư hệ thống gửi cho bạn.",
        "Google Identity Services: khi bạn chọn đăng nhập bằng Google.",
        "Cloudflare Turnstile: xác minh 'không phải robot' ở form đăng ký, quên mật khẩu, liên hệ (nếu được bật).",
        "Anthropic (Claude): khi bạn dùng AI Check, văn bản được gửi tới API của Anthropic để phân tích và không được LearnHub lưu lại. Xem chính sách của Anthropic về thời gian lưu dữ liệu API.",
        "YouTube: video bài giảng nhúng từ YouTube, YouTube có thể đặt cookie theo chính sách riêng của Google.",
        "GitHub Pages và nhà cung cấp máy chủ backend: lưu trữ website và cơ sở dữ liệu.",
        "Các bên này chỉ xử lý dữ liệu theo mục đích nêu trên và theo điều khoản dịch vụ của họ.",
      ]},
      { h: "5. Thời gian lưu trữ", items: [
        "Dữ liệu tài khoản và học tập: cho đến khi bạn xoá tài khoản.",
        "Đơn hàng đã thanh toán: giữ ở dạng ẩn danh sau khi bạn xoá tài khoản, theo thời hạn lưu chứng từ kế toán.",
        "Mã OTP và link đặt lại mật khẩu: tự xoá sau khi hết hạn (tối đa 7 ngày).",
        "Nhật ký thao tác quản trị: giữ để đối soát, chỉ ghi hành động của quản trị viên và yêu cầu xoá tài khoản.",
      ]},
      { h: "6. Quyền của bạn và cách thực hiện", items: [
        "Truy cập & tải về: bấm 'Tải JSON' trong trang Tài khoản → Dữ liệu cá nhân để nhận toàn bộ dữ liệu.",
        "Chỉnh sửa: đổi họ tên, mật khẩu, liên kết/gỡ Google ngay trong trang Tài khoản.",
        "Xoá: bấm 'Xoá tài khoản' trong trang Tài khoản. Dữ liệu học tập bị xoá ngay; đơn hàng đã thanh toán được ẩn danh hoá.",
        "Rút lại đồng ý / khiếu nại: gửi email tới " + site.contact.email + ". Chúng tôi phản hồi trong 72 giờ làm việc.",
      ]},
      { h: "7. Cookie và lưu trữ trên trình duyệt", items: [
        "Chúng tôi không dùng cookie theo dõi hay phân tích hành vi.",
        "Trình duyệt của bạn lưu token đăng nhập (localStorage) để giữ phiên; đăng xuất sẽ xoá token này.",
      ]},
      { h: "8. Bảo mật", items: [
        "Mật khẩu băm bcrypt; phiên đăng nhập bằng JWT có thời hạn, thu hồi được khi đổi mật khẩu hoặc bấm 'Đăng xuất mọi thiết bị'.",
        "Giới hạn tần suất, khoá tạm sau nhiều lần sai mật khẩu, captcha ở các form công khai.",
        "Mọi thao tác của quản trị viên đều được ghi nhật ký.",
      ]},
      { h: "9. Trẻ em và thay đổi chính sách", items: [
        "Dịch vụ dành cho sinh viên từ 16 tuổi. Nếu bạn dưới 16 tuổi, vui lòng có sự đồng ý của người giám hộ.",
        `Khi chính sách thay đổi, chúng tôi cập nhật ngày ở đầu trang. Liên hệ: ${site.contact.email}.`,
      ]},
    ],
    actions: [{ href: "/account", label: "Mở trang Tài khoản →" }, { href: "/contact", label: "Liên hệ về dữ liệu cá nhân" }],
  },
  terms: {
    title: "Điều khoản sử dụng",
    updated: UPDATED,
    sections: [
      { h: "Tài khoản", items: ["Tài khoản là cá nhân, không dùng chung hoặc chuyển nhượng.", "Bạn chịu trách nhiệm bảo mật mật khẩu và mọi hoạt động dưới tài khoản của mình."] },
      { h: "Nội dung khóa học", items: ["Nội dung chỉ dùng cho mục đích học tập cá nhân. Không sao chép, chia sẻ lại video, tài liệu hay đề trắc nghiệm cho bên thứ ba.", "Chúng tôi có quyền tạm khoá tài khoản vi phạm sau khi thông báo qua email."] },
      { h: "AI Check", items: ["Kết quả AI Check là ước lượng của mô hình ngôn ngữ, chỉ để bạn tự tham khảo và chỉnh sửa, không phải kết luận về đạo văn hay bằng chứng cho bất kỳ mục đích nào."] },
    ],
  },
  payment: {
    title: "Chính sách thanh toán",
    updated: UPDATED,
    sections: [
      { h: "Hình thức", items: ["Hiện hỗ trợ chuyển khoản ngân hàng qua mã QR (VietQR). Ví điện tử và thẻ sẽ được bổ sung sau và cập nhật tại đây.", "Giá niêm yết là giá cuối, không phát sinh phụ phí."] },
      { h: "Quy trình", items: ["Bấm Mua ngay → Xác nhận đặt hàng để nhận mã đơn và QR.", "Chuyển khoản đúng số tiền với nội dung là mã đơn (quét QR sẽ tự điền).", "Chúng tôi đối soát và xác nhận thủ công trong giờ làm việc (8:00–22:00), thường dưới 30 phút; ngoài giờ có thể lâu hơn.", "Đơn chưa thanh toán tự hết hạn sau 24 giờ; bạn có thể đặt lại. Nếu đã chuyển tiền cho đơn hết hạn, liên hệ hỗ trợ kèm mã đơn."] },
    ],
  },
  delivery: {
    title: "Chính sách giao nhận",
    updated: UPDATED,
    sections: [
      { h: "Sản phẩm số", items: ["Khóa học được mở khoá ngay trong tài khoản của bạn khi đơn được xác nhận; bạn nhận email thông báo kèm nút Vào học.", "Không có sản phẩm vật lý, không thu phí vận chuyển.", "Học trên mọi thiết bị có trình duyệt, không giới hạn số lần xem trong thời gian khóa học còn hoạt động."] },
    ],
  },
  refund: {
    title: "Chính sách hoàn tiền",
    updated: UPDATED,
    sections: [
      { h: "Điều kiện", items: ["Hoàn 100% trong 7 ngày kể từ khi xác nhận thanh toán nếu nội dung không đúng mô tả trên trang khóa học.", "Không hoàn tiền khi đã hoàn thành trên 50% số bài học của khóa."] },
      { h: "Cách yêu cầu", items: [`Gửi email tới ${site.contact.email} kèm mã đơn và lý do. Chúng tôi phản hồi trong 3 ngày làm việc và hoàn tiền về tài khoản ngân hàng bạn đã chuyển.`] },
    ],
  },
};

export function generateStaticParams() { return Object.keys(policies).map((slug) => ({ slug })); }

export function generateMetadata({ params }: { params: { slug: string } }) {
  return { title: policies[params.slug]?.title ?? "Chính sách" };
}

export default function PolicyPage({ params }: { params: { slug: string } }) {
  const p = policies[params.slug];
  if (!p) notFound();
  return (
    <>
      <PageHeader eyebrow="Chính sách" title={p.title} subtitle={`Cập nhật lần cuối: ${p.updated}`} />
      <div className="container-x max-w-3xl py-12">
        {p.intro && <p className="mb-8 leading-7 text-slate-700">{p.intro}</p>}
        <div className="space-y-6">
          {p.sections.map((s) => (
            <section key={s.h} className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="font-semibold text-slate-900">{s.h}</h2>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                {s.items.map((t, i) => <li key={i} className="flex gap-2"><span className="text-slate-400">•</span><span>{t}</span></li>)}
              </ul>
            </section>
          ))}
        </div>
        {p.actions && (
          <div className="mt-8 flex flex-wrap gap-3">
            {p.actions.map((a) => <Link key={a.href} href={a.href} className="btn-outline">{a.label}</Link>)}
          </div>
        )}
        <nav className="mt-10 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
          {site.footerLinks.map((l) => (
            <Link key={l.href} href={l.href} className={l.href === `/policy/${params.slug}` ? "font-semibold text-brand-700" : "hover:text-slate-800"}>{l.label}</Link>
          ))}
        </nav>
      </div>
    </>
  );
}
