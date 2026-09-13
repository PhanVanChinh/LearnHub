"use client";
import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import GoogleButton, { GOOGLE_CLIENT_ID } from "@/components/GoogleButton";
import { authApi } from "@/lib/api";
import Section from "./Section";

export default function GoogleSection() {
  const { user, setUser } = useAuth();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (!user) return null;

  const unlink = async () => {
    if (!confirm("Gỡ liên kết Google? Bạn vẫn đăng nhập được bằng email và mật khẩu.")) return;
    setBusy(true); setError("");
    try { setUser(await authApi.unlinkGoogle()); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Section title="Đăng nhập bằng Google" description="Liên kết để đăng nhập một chạm bằng tài khoản Google của bạn.">
      {user.has_google ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-emerald-50 text-lg">✓</span>
            <div>
              <p className="text-sm font-medium text-slate-800">Đã liên kết Google</p>
              <p className="text-xs text-slate-500">
                {user.has_password === false ? "Đặt mật khẩu ở mục trên trước khi gỡ liên kết." : "Bạn có thể đăng nhập bằng Google hoặc mật khẩu."}
              </p>
            </div>
          </div>
          <button onClick={unlink} disabled={busy || user.has_password === false}
            className="btn border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 disabled:opacity-50">
            {busy ? "Đang gỡ…" : "Gỡ liên kết"}
          </button>
        </div>
      ) : GOOGLE_CLIENT_ID ? (
        <div className="flex justify-start">
          <GoogleButton text="continue_with" busyText="Đang liên kết…"
            onCredential={async (credential) => setUser(await authApi.linkGoogle(credential))}
            onSuccess={() => setError("")} onError={setError} />
        </div>
      ) : (
        <p className="text-sm text-slate-500">Đăng nhập Google chưa được cấu hình trên hệ thống này.</p>
      )}
      {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
    </Section>
  );
}
