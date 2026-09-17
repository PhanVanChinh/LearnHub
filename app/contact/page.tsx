import ContactForm from "@/components/ContactForm";
import PageHeader from "@/components/PageHeader";
import { site } from "@/lib/site";

export const metadata = { title: "Liên hệ" };

export default function ContactPage() {
  return (
    <>
      <PageHeader eyebrow="Hỗ trợ" title="Liên hệ với chúng tôi" subtitle="Phản hồi trong vòng 24 giờ làm việc." />
      <div className="container-x grid gap-8 py-12 lg:grid-cols-2">
        <ContactForm />
        <div className="space-y-4">
          {[
            ["📍 Địa chỉ", site.contact.address],
            ["📞 Hotline", site.contact.phone],
            ["✉️ Email", site.contact.email],
            ["🕒 Giờ làm việc", "8:00 – 22:00 hằng ngày"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-slate-900">{k}</p>
              <p className="mt-1 text-slate-600">{v}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
