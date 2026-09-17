"use client";
import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import Turnstile from "./Turnstile";
import { ApiError, contactApi, FieldErrors } from "@/lib/api";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function ContactForm() {
  const { user } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [touched, setTouched] = useState(false);
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [error, setError] = useState("");
  const [sent, setSent] = useState("");
  const [busy, setBusy] = useState(false);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);

  // Đang đăng nhập → điền sẵn tên, email (vẫn sửa được)
  useEffect(() => {
    if (user) setForm((f) => ({ ...f, name: f.name || user.full_name, email: f.email || user.email }));
  }, [user]);

  const clientErrors: FieldErrors = {};
  if (!form.name.trim()) clientErrors.name = "Vui lòng nhập họ và tên";
  if (!EMAIL_RE.test(form.email.trim())) clientErrors.email = "Email không hợp lệ";
  if (form.message.trim().length < 10) clientErrors.message = "Nội dung cần ít nhất 10 ký tự";
  const err = (k: string) => serverErrors[k] || (touched ? clientErrors[k] : "");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (Object.keys(clientErrors).length) return;
    setBusy(true); setError(""); setServerErrors({});
    try {
      const r = await contactApi.send({ ...form, name: form.name.trim(), email: form.email.trim(), captcha_token: captcha });
      setSent(r.detail);
    } catch (e) {
      const ae = e as ApiError;
      if (ae.errors && Object.keys(ae.errors).length) setServerErrors(ae.errors); else setError(ae.message);
      setCaptcha(null); setCaptchaKey((k) => k + 1);
    } finally { setBusy(false); }
  };
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });
  const cls = (k: string) => `input ${err(k) ? "!border-rose-400 !ring-rose-100" : ""}`;

  if (sent) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <p className="text-5xl">📨</p>
        <p className="mt-3 text-lg font-semibold text-emerald-800">Đã gửi!</p>
        <p className="mt-1 text-sm text-emerald-700">{sent}</p>
        <p className="mt-1 text-xs text-emerald-700">Một email xác nhận đã được gửi tới {form.email}.</p>
        <button onClick={() => { setSent(""); setForm({ ...form, subject: "", message: "" }); setTouched(false); }} className="btn-outline mt-5">Gửi tin nhắn khác</button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <input className={cls("name")} placeholder="Họ và tên" value={form.name} onChange={set("name")} autoComplete="name" />
          {err("name") && <p className="mt-1 text-xs text-rose-600">{err("name")}</p>}
        </div>
        <div>
          <input className={cls("email")} type="email" placeholder="Email" value={form.email} onChange={set("email")} autoComplete="email" />
          {err("email") && <p className="mt-1 text-xs text-rose-600">{err("email")}</p>}
        </div>
      </div>
      <input className="input" placeholder="Chủ đề (tuỳ chọn)" value={form.subject} onChange={set("subject")} maxLength={255} />
      <div>
        <textarea className={`${cls("message")} resize-y`} rows={6} placeholder="Nội dung…" value={form.message} onChange={set("message")} maxLength={5000} />
        <div className="mt-1 flex justify-between text-xs">
          <span className="text-rose-600">{err("message")}</span>
          <span className="text-slate-400">{form.message.length}/5000</span>
        </div>
      </div>
      <Turnstile onToken={setCaptcha} resetKey={captchaKey} />
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-60">{busy ? "Đang gửi…" : "Gửi tin nhắn"}</button>
      <p className="text-center text-xs text-slate-500">Chúng tôi phản hồi qua email trong 24 giờ làm việc.</p>
    </form>
  );
}
