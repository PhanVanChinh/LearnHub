"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { site } from "@/lib/site";
import Logo from "./Logo";

export default function Footer() {
  const pathname = usePathname();
  if (pathname.startsWith("/learn/")) return null; // trang học: nền tối toàn màn hình, không footer để tập trung
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="container-x grid gap-10 py-12 md:grid-cols-3">
        <div>
          <Logo />
          <p className="mt-4 max-w-sm text-sm leading-6 text-slate-600">{site.description}</p>
        </div>
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-900">Chính sách</h4>
          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            {site.footerLinks.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="hover:text-brand-700">{l.label}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-900">Liên hệ</h4>
          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            <li>📍 {site.contact.address}</li>
            <li>📞 <a href={`tel:${site.contact.phone}`} className="hover:text-brand-700">{site.contact.phone}</a></li>
            <li>✉️ <a href={`mailto:${site.contact.email}`} className="hover:text-brand-700">{site.contact.email}</a></li>
          </ul>
          <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Website đang trong quá trình hoàn thiện
          </div>
        </div>
      </div>
      <div className="border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} {site.name}. All rights reserved.
      </div>
    </footer>
  );
}
