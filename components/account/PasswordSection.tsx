"use client";
import { FormEvent, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import NewPasswordFields from "@/components/NewPasswordFields";
import PasswordInput from "@/components/PasswordInput";
import { ApiError } from "@/lib/api";
import { passwordValid } from "@/lib/password";
import Section from "./Section";

export default function PasswordSection() {
  const { user } = useAuth();
  if (user && user.has_password === false) return <SetPasswordForm />;
  return <ChangePasswordForm />;
}

/** Tài khoản Google chưa có mật khẩu: đặt lần đầu, không cần mật khẩu hiện tại. */
function SetPasswordForm() {
  const { user, setPassword } = useAuth();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const email = user?.email ?? "";
  const valid = passwordValid(pw, email) && confirm === pw;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    setBusy(true); setError("");
    try {
      await setPassword(pw); // user.has_password đổi → component cha tự chuyển sang form đổi mật khẩu
    } catch (err) {
      const ae = err as ApiError;
      setError(ae.errors?.new_password || ae.message);
      setBusy(false);
    }
  };

  return (
    <Section title="Đặt mật khẩu" description="Tài khoản của bạn hiện chỉ đăng nhập bằng Google. Đặt mật khẩu để có thể đăng nhập bằng email khi cần.">
      <form onSubmit={submit} noValidate className="space-y-4">
        <NewPasswordFields password={pw} confirm={confirm} onPassword={(v) => { setPw(v); setError(""); }} onConfirm={setConfirm}
          touched={touched} onBlur={() => setTouched(true)} email={email} placeholder="Mật khẩu" />
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <button type="submit" disabled={busy} className="btn-primary disabled:opacity-60">{busy ? "Đang lưu…" : "Đặt mật khẩu"}</button>
      </form>
    </Section>
  );
}

function ChangePasswordForm() {
  const { user, changePassword } = useAuth();
  const [current, setCurrent] = useState("");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const email = user?.email ?? "";
  const valid = !!current && passwordValid(pw, email) && confirm === pw && pw !== current;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!valid) {
      if (current && pw === current) setError("Mật khẩu mới phải khác mật khẩu hiện tại");
      return;
    }
    setBusy(true); setError(""); setDone(false);
    try {
      await changePassword(current, pw);
      setCurrent(""); setPw(""); setConfirm(""); setTouched(false);
      setDone(true);
    } catch (err) {
      const ae = err as ApiError;
      setError(ae.errors?.new_password || ae.errors?.current_password || ae.message);
    } finally { setBusy(false); }
  };

  return (
    <Section title="Đổi mật khẩu" description="Sau khi đổi, mọi thiết bị khác sẽ bị đăng xuất. Thiết bị này vẫn giữ đăng nhập.">
      <form onSubmit={submit} noValidate className="space-y-4">
        <PasswordInput placeholder="Mật khẩu hiện tại" value={current} autoComplete="current-password"
          onChange={(e) => { setCurrent(e.target.value); setError(""); setDone(false); }} invalid={touched && !current} />
        <NewPasswordFields password={pw} confirm={confirm} onPassword={(v) => { setPw(v); setError(""); setDone(false); }} onConfirm={setConfirm}
          touched={touched} onBlur={() => setTouched(true)} email={email} />
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        {done && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">✓ Đã đổi mật khẩu. Các thiết bị khác đã bị đăng xuất.</p>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button type="submit" disabled={busy} className="btn-primary disabled:opacity-60">{busy ? "Đang lưu…" : "Đổi mật khẩu"}</button>
          <a href="/forgot-password" className="text-sm text-brand-700 hover:underline">Quên mật khẩu hiện tại?</a>
        </div>
      </form>
    </Section>
  );
}
