"use client";
import Link from "next/link";
import { useState } from "react";
import { ApiError, Certificate, certificatesApi } from "@/lib/api";

/** Trong sidebar trang học khi đã 100%: nhận (hoặc mở) chứng nhận. */
export default function CertificateButton({ slug }: { slug: string }) {
  const [cert, setCert] = useState<Certificate | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const issue = async () => {
    setBusy(true); setError("");
    try { setCert(await certificatesApi.issue(slug)); } catch (e) { setError((e as ApiError).message); } finally { setBusy(false); }
  };
  if (cert) {
    return (
      <Link href={`/certificate?code=${cert.code}`} className="mt-3 block rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-2 text-xs text-emerald-100 hover:bg-emerald-500/25">
        🎓 Chứng nhận <span className="font-mono">{cert.code}</span> · Xem & tải →
      </Link>
    );
  }
  return (
    <div className="mt-3">
      <button onClick={issue} disabled={busy} className="btn w-full !py-2 bg-emerald-600 text-xs text-white hover:bg-emerald-700 disabled:opacity-60">
        {busy ? "Đang cấp…" : "🎓 Nhận chứng nhận hoàn thành"}
      </button>
      {error && <p className="mt-1 text-xs text-rose-300">{error}</p>}
    </div>
  );
}
