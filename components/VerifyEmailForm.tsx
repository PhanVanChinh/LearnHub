"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { authApi, ApiError, VerificationStatus } from "@/lib/api";
import { useAuth } from "./AuthProvider";
import Logo from "./Logo";

export default function VerifyEmailForm() {
  const { user, loading, setUser } = useAuth();
  const router = useRouter();
  const next = useSearchParams().get("next") || "/";
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<VerificationStatus | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) return router.replace(`/login?next=${encodeURIComponent(`/verify?next=${next}`)}`);
    if (user.email_verified) return router.replace(next);
    authApi.verification().then((s) => { setStatus(s); setCooldown(s.cooldown_seconds); }).catch(() => {});
    inputRef.current?.focus();
  }, [user, loading, next, router]);

  // đếm ngược nút gửi lại
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (code.length !== 6 || busy) return;
    setBusy(true); setError(""); setInfo("");
    try {
      const u = await authApi.confirmVerification(code);
      setUser(u);
      router.replace(next);
    } catch (err) {
      setError((err as ApiError).message);
      setCode("");
      inputRef.current?.focus();
    } finally {
      setBusy(false);
    }
  };
  // tự gửi khi đủ 6 số
  useEffect(() => { if (code.length === 6) void submit(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [code]);

  const resend = async () => {
    if (cooldown > 0 || busy) return;
    setBusy(true); setError(""); setInfo("");
    try {
      const s = await authApi.resendVerification();
      setStatus(s); setCooldown(s.cooldown_seconds);
      setInfo(s.mail_provider === "console"
        ? "Chế độ dev: mã mới đã được in ra terminal backend."
        : `Đã gửi mã mới tới ${user?.email}. Kiểm tra cả mục Spam.`);
    } catch (err) {
      const ae = err as ApiError;
      setError(ae.message);
      const m = ae.message.match(/(\d+) giây/);
      if (ae.status === 429 && m) setCooldown(Number(m[1]));
    } finally {
      setBusy(false);
    }
  };

  if (loading || !user) return <div className="container-x py-16 text-center text-slate-500">Đang tải…</div>;

  return (
    <div className="container-x flex justify-center py-16">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-card">
        <div className="flex justify-center"><Logo /></div>
        <h1 className="mt-6 text-center text-2xl font-bold text-slate-900">Xác thực email</h1>
        <p className="mt-2 text-center text-sm text-slate-500">
          Nhập mã 6 số đã gửi tới <b className="text-slate-800">{user.email}</b>
        </p>
        {status?.mail_provider === "console" && (
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-center text-xs text-slate-500">
            Chế độ dev (chưa cấu hình Resend): mã được in ở terminal đang chạy backend.
          </p>
        )}
        <form onSubmit={submit} className="mt-6">
          <input
            ref={inputRef}
            className="input text-center text-3xl font-bold tracking-[0.6em]"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="••••••"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            disabled={busy}
          />
          {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          {info && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{info}</p>}
          <button type="submit" disabled={busy || code.length !== 6} className="btn-primary mt-4 w-full !py-2.5 disabled:opacity-60">
            {busy ? "Đang kiểm tra…" : "Xác nhận"}
          </button>
        </form>
        <div className="mt-5 flex items-center justify-between text-sm">
          <button onClick={resend} disabled={cooldown > 0 || busy} className="font-medium text-brand-700 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline">
            {cooldown > 0 ? `Gửi lại mã sau ${cooldown}s` : "Gửi lại mã"}
          </button>
          <button onClick={() => router.push(next)} className="text-slate-500 hover:text-slate-800">Để sau</button>
        </div>
      </div>
    </div>
  );
}
