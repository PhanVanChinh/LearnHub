"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import Section from "./Section";
import { ApiError, Certificate, certificatesApi } from "@/lib/api";

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

/** Mục "Chứng nhận của tôi" trong trang tài khoản: mọi chứng nhận đã nhận, xem / tải / sao chép link xác thực.
 *  Trước đây mã chỉ hiện một lần trong trang học; quên mã là không tìm lại được. */
export default function CertificatesSection() {
  const [certs, setCerts] = useState<Certificate[] | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    certificatesApi.mine()
      .then((list) => alive && setCerts(list))
      .catch((e: ApiError) => alive && (setCerts([]), setError(e.status === 0 ? e.message : "Không tải được danh sách chứng nhận.")));
    return () => { alive = false; };
  }, []);

  const copy = async (c: Certificate) => {
    try {
      await navigator.clipboard.writeText(c.verify_url);
      setCopied(c.code);
      setTimeout(() => setCopied((cur) => (cur === c.code ? null : cur)), 2000);
    } catch { /* trình duyệt chặn clipboard: người dùng vẫn copy tay được từ trang chứng nhận */ }
  };

  return (
    <Section title="Chứng nhận của tôi" description="Chứng nhận được cấp khi hoàn thành 100% một khóa học. Link xác thực công khai, gửi được cho nhà tuyển dụng.">
      <div id="certificates">
        {certs === null && <div className="h-16 animate-pulse rounded-xl bg-slate-100" />}
        {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
        {certs && certs.length === 0 && !error && (
          <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            <p className="text-3xl">🎓</p>
            <p className="mt-2">Bạn chưa có chứng nhận nào.</p>
            <Link href="/my-courses" className="mt-3 inline-block font-semibold text-brand-700 hover:underline">Học tiếp các khóa của tôi →</Link>
          </div>
        )}
        {certs && certs.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {certs.map((c) => (
              <li key={c.code} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <Link href={`/courses/${c.course_slug}`} className="block truncate font-medium text-slate-900 hover:text-brand-700">{c.course_title}</Link>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Mã <span className="font-mono text-slate-700">{c.code}</span> · cấp ngày {fmtDate(c.issued_at)} · {c.lessons} bài
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button onClick={() => copy(c)} className="btn-outline !px-3 !py-1.5 !text-xs">{copied === c.code ? "✓ Đã sao chép" : "Sao chép link"}</button>
                  <Link href={`/certificate?code=${c.code}`} className="btn-primary !px-3 !py-1.5 !text-xs">Xem & tải</Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  );
}
