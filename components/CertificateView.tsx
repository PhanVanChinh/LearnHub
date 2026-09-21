"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { ApiError, Certificate, certificatesApi } from "@/lib/api";
import { site } from "@/lib/site";

const utc = (iso: string) => new Date(/Z|[+-]\d\d:\d\d$/.test(iso) ? iso : iso + "Z");
const fmtDate = (iso: string) => utc(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

/** /certificate?code=LH-CERT-… : xem + xác thực công khai + tải PNG. Không có code → ô nhập mã. */
export default function CertificateView() {
  const initial = useSearchParams().get("code") ?? "";
  const [code, setCode] = useState(initial);
  const [cert, setCert] = useState<Certificate | null | undefined>(initial ? undefined : null);
  const [error, setError] = useState("");

  const lookup = async (c: string) => {
    if (!c.trim()) return;
    setCert(undefined); setError("");
    try { setCert(await certificatesApi.verify(c)); window.history.replaceState(null, "", `/certificate?code=${encodeURIComponent(c.trim().toUpperCase())}`); }
    catch (e) { setCert(null); setError((e as ApiError).message); }
  };
  useEffect(() => { if (initial) void lookup(initial); }, [initial]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = (e: FormEvent) => { e.preventDefault(); void lookup(code); };

  return (
    <div className="container-x py-12">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold text-slate-900">Chứng nhận hoàn thành</h1>
        <form onSubmit={submit} className="mt-4 flex gap-2">
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Nhập mã, ví dụ LH-CERT-7K3M9PQ2" className="input font-mono uppercase" />
          <button type="submit" className="btn-primary shrink-0">Xác thực</button>
        </form>
        {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        {cert === undefined && initial && <div className="mt-6 aspect-[1.414] animate-pulse rounded-2xl bg-slate-100" />}
        {cert && <CertificateCard cert={cert} />}
        {cert === null && !error && (
          <p className="mt-6 text-sm text-slate-500">Nhập mã in trên chứng nhận để kiểm tra tính hợp lệ. Mã có dạng LH-CERT- theo sau 8 ký tự.</p>
        )}
      </div>
    </div>
  );
}

function CertificateCard({ cert }: { cert: Certificate }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const verifyUrl = typeof window !== "undefined" ? `${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/certificate?code=${cert.code}` : cert.verify_url;

  const download = () => {
    const c = canvasRef.current; if (!c) return;
    const W = 1600, H = 1131; c.width = W; c.height = H;
    const ctx = c.getContext("2d")!;
    // nền + viền
    const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, "#eef4ff"); g.addColorStop(1, "#ffffff");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "#1b45f5"; ctx.lineWidth = 14; ctx.strokeRect(40, 40, W - 80, H - 80);
    ctx.strokeStyle = "#bcd3ff"; ctx.lineWidth = 3; ctx.strokeRect(70, 70, W - 140, H - 140);
    const center = (t: string, y: number, font: string, color: string) => { ctx.font = font; ctx.fillStyle = color; ctx.textAlign = "center"; ctx.fillText(t, W / 2, y); };
    const fit = (t: string, max: number, size: number) => { let s = size; ctx.font = `bold ${s}px system-ui, sans-serif`; while (ctx.measureText(t).width > max && s > 28) { s -= 2; ctx.font = `bold ${s}px system-ui, sans-serif`; } return s; };
    center(site.name.toUpperCase(), 190, "bold 40px system-ui, sans-serif", "#1b45f5");
    center("CHỨNG NHẬN HOÀN THÀNH", 290, "bold 64px system-ui, sans-serif", "#0f172a");
    center("Chứng nhận rằng", 390, "30px system-ui, sans-serif", "#475569");
    const ns = fit(cert.holder_name, W - 300, 80); center(cert.holder_name, 500, `bold ${ns}px system-ui, sans-serif`, "#0f172a");
    ctx.strokeStyle = "#1b45f5"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(W / 2 - 300, 530); ctx.lineTo(W / 2 + 300, 530); ctx.stroke();
    center("đã hoàn thành toàn bộ nội dung khóa học", 600, "30px system-ui, sans-serif", "#475569");
    const ts = fit(cert.course_title, W - 240, 52); center(cert.course_title, 690, `bold ${ts}px system-ui, sans-serif`, "#1434e1");
    center(`${cert.lessons} bài học · Cấp ngày ${fmtDate(cert.issued_at)}`, 770, "28px system-ui, sans-serif", "#475569");
    center(`Mã xác thực: ${cert.code}`, 950, "bold 30px ui-monospace, monospace", "#0f172a");
    center(`Kiểm tra tại ${verifyUrl}`, 1000, "22px system-ui, sans-serif", "#64748b");
    const a = document.createElement("a"); a.href = c.toDataURL("image/png"); a.download = `chung-nhan-${cert.code}.png`; a.click();
  };
  const copy = () => { navigator.clipboard?.writeText(verifyUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {}); };

  return (
    <div className="mt-6">
      <div className={`rounded-2xl border-4 p-1 ${cert.valid ? "border-brand-600" : "border-slate-300"}`}>
        <div className="rounded-xl border border-brand-200 bg-gradient-to-br from-brand-50 to-white px-6 py-10 text-center sm:px-12">
          <p className="text-sm font-bold tracking-widest text-brand-700">{site.name.toUpperCase()}</p>
          <h2 className="mt-4 text-3xl font-extrabold text-slate-900 sm:text-4xl">CHỨNG NHẬN HOÀN THÀNH</h2>
          <p className="mt-6 text-slate-500">Chứng nhận rằng</p>
          <p className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">{cert.holder_name}</p>
          <div className="mx-auto mt-3 h-0.5 w-40 bg-brand-600" />
          <p className="mt-6 text-slate-500">đã hoàn thành toàn bộ nội dung khóa học</p>
          <p className="mt-2 text-xl font-bold text-brand-800 sm:text-2xl">{cert.course_title}</p>
          <p className="mt-4 text-sm text-slate-500">{cert.lessons} bài học · Cấp ngày {fmtDate(cert.issued_at)}</p>
          <p className="mt-8 font-mono text-sm font-semibold text-slate-800">Mã xác thực: {cert.code}</p>
        </div>
      </div>
      <div className={`mt-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${cert.valid ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
        <span className="text-lg">{cert.valid ? "✅" : "⚠️"}</span>
        <span>{cert.valid ? `Chứng nhận hợp lệ, do ${site.name} cấp cho ${cert.holder_name}.` : "Tài khoản của người nhận đã bị khoá hoặc xoá; chứng nhận không còn xác thực được."}</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={download} className="btn-primary">⬇ Tải ảnh PNG</button>
        <button onClick={copy} className="btn-outline">{copied ? "✓ Đã sao chép" : "Sao chép link xác thực"}</button>
        <Link href={`/courses/${cert.course_slug}`} className="btn-outline">Xem khóa học</Link>
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
