"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { authApi, ApiError } from "@/lib/api";
import { passwordValid } from "@/lib/password";
import Logo from "./Logo";
import NewPasswordFields from "./NewPasswordFields";

export default function ResetPasswordForm() {
  const token = useSearchParams().get("token") || "";
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [touched, setTouched] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const valid = passwordValid(pw) && confirm === pw;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    setBusy(true); setError("");
    try {
      await authApi.resetPassword(token, pw);
      setDone(true);
    } catch (err) {
      const ae = err as ApiError;
      setError(ae.errors?.new_password || ae.message);
    } finally {
      setBusy(false);
    }
  };

  const Card = ({ children }: { children: React.ReactNode }) => (
    <div className="container-x flex justify-center py-16">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-card">
        <div className="flex justify-center"><Logo /></div>
        {children}
      </div>
    </div>
  );

  if (!token) {
    return (
      <Card>
        <h1 className="mt-6 text-center text-2xl font-bold text-slate-900">Link không hợp lệ</h1>
        <p className="mt-2 text-center text-sm text-slate-500">Thiếu mã đặt lại. Hãy mở đúng link trong email hoặc yêu cầu link mới.</p>
        <Link href="/forgot-password" className="btn-primary mt-6 w-full">Yêu cầu link mới</Link>
      </Card>
    );
  }
  if (done) {
    return (
      <Card>
        <h1 className="mt-6 text-center text-2xl font-bold text-slate-900">Đã đặt lại mật khẩu 🎉</h1>
        <p className="mt-2 text-center text-sm text-slate-500">Mọi phiên đăng nhập cũ đã bị đăng xuất. Hãy đăng nhập lại bằng mật khẩu mới.</p>
        <Link href="/login" className="btn-primary mt-6 w-full">Đăng nhập</Link>
      </Card>
    );
  }
  return (
    <Card>
      <h1 className="mt-6 text-center text-2xl font-bold text-slate-900">Đặt lại mật khẩu</h1>
      <p className="mt-1 text-center text-sm text-slate-500">Chọn mật khẩu mới cho tài khoản của bạn.</p>
      <form onSubmit={submit} noValidate className="mt-6 space-y-4">
        <NewPasswordFields password={pw} confirm={confirm} onPassword={setPw} onConfirm={setConfirm} touched={touched} onBlur={() => setTouched(true)} autoFocus />
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <button type="submit" disabled={busy} className="btn-primary w-full !py-2.5 disabled:opacity-60">{busy ? "Đang lưu…" : "Đặt lại mật khẩu"}</button>
      </form>
    </Card>
  );
}
