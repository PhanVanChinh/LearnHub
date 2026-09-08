"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import Logo from "./Logo";
import { useAuth } from "./AuthProvider";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const login = mode === "login";
  const { user, login: doLogin, register: doRegister } = useAuth();
  const router = useRouter();
  const next = useSearchParams().get("next") || "/";
  const [form, setForm] = useState({ full_name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (user) router.replace(next); }, [user, next, router]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      if (login) await doLogin(form.email, form.password);
      else await doRegister(form.full_name, form.email, form.password);
      router.replace(next);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="container-x flex justify-center py-16">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-card">
        <div className="flex justify-center"><Logo /></div>
        <h1 className="mt-6 text-center text-2xl font-bold text-slate-900">{login ? "Đăng nhập" : "Tạo tài khoản"}</h1>
        <p className="mt-1 text-center text-sm text-slate-500">{login ? "Chào mừng bạn quay lại!" : "Miễn phí, chỉ mất 30 giây."}</p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          {!login && <input className="input" placeholder="Họ và tên" value={form.full_name} onChange={set("full_name")} required />}
          <input className="input" type="email" placeholder="Email" value={form.email} onChange={set("email")} required autoComplete="email" />
          <input className="input" type="password" placeholder="Mật khẩu (tối thiểu 6 ký tự)" value={form.password} onChange={set("password")} required minLength={6} autoComplete={login ? "current-password" : "new-password"} />
          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          <button type="submit" disabled={busy} className="btn-primary w-full !py-2.5 disabled:opacity-60">
            {busy ? "Đang xử lý…" : login ? "Đăng nhập" : "Đăng ký"}
          </button>
        </form>
        {login && (
          <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-center text-xs text-slate-500">
            Tài khoản demo: <code>admin@example.com</code> / <code>admin123</code>
          </p>
        )}
        <p className="mt-6 text-center text-sm text-slate-600">
          {login ? "Chưa có tài khoản? " : "Đã có tài khoản? "}
          <Link href={login ? "/register" : "/login"} className="font-semibold text-brand-700 hover:underline">{login ? "Đăng ký" : "Đăng nhập"}</Link>
        </p>
      </div>
    </div>
  );
}
