"use client";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { authApi } from "@/lib/api";
import Logo from "./Logo";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const r = await authApi.forgotPassword(email.trim());
      setSent(r.detail);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container-x flex justify-center py-16">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-card">
        <div className="flex justify-center"><Logo /></div>
        <h1 className="mt-6 text-center text-2xl font-bold text-slate-900">Quên mật khẩu</h1>
        <p className="mt-1 text-center text-sm text-slate-500">Nhập email đã đăng ký, chúng tôi sẽ gửi link đặt lại mật khẩu.</p>
        {sent ? (
          <div className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
            <p>✅ {sent}</p>
            <p className="mt-2 text-emerald-700">Link có hiệu lực 30 phút. Không thấy mail? Kiểm tra mục Spam hoặc thử lại sau 1 phút.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" autoFocus />
            {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
            <button type="submit" disabled={busy} className="btn-primary w-full !py-2.5 disabled:opacity-60">{busy ? "Đang gửi…" : "Gửi link đặt lại"}</button>
          </form>
        )}
        <p className="mt-6 text-center text-sm text-slate-600">
          <Link href="/login" className="font-semibold text-brand-700 hover:underline">← Quay lại đăng nhập</Link>
        </p>
      </div>
    </div>
  );
}
