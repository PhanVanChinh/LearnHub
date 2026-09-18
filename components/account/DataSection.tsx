"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import PasswordInput from "@/components/PasswordInput";
import { ApiError, authApi } from "@/lib/api";
import Section from "./Section";

/** Quyền với dữ liệu cá nhân: tải về toàn bộ dữ liệu, xoá tài khoản. */
export default function DataSection() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const download = async () => {
    setBusy(true); setMsg(null);
    try {
      const data = await authApi.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `learnhub-du-lieu-${user?.id ?? "me"}.json`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setMsg({ ok: true, text: "Đã tải file JSON về máy." });
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); } finally { setBusy(false); }
  };

  return (
    <Section title="Dữ liệu cá nhân" description="Bạn có quyền xem, tải về và xoá dữ liệu mà LearnHub lưu về mình. Chi tiết trong Chính sách bảo mật.">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="text-sm text-slate-600">
          <p className="font-medium text-slate-800">Tải toàn bộ dữ liệu của tôi</p>
          <p className="mt-1">Gồm hồ sơ, khóa đã ghi danh, tiến độ học, kết quả trắc nghiệm, đơn hàng, lượt AI Check và tin nhắn liên hệ. Không gồm mật khẩu.</p>
          {msg && <p className={`mt-2 text-sm ${msg.ok ? "text-emerald-600" : "text-rose-600"}`}>{msg.text}</p>}
        </div>
        <button onClick={download} disabled={busy} className="btn-outline shrink-0 disabled:opacity-60">{busy ? "Đang tạo file…" : "⬇ Tải JSON"}</button>
      </div>
      <DeleteAccount />
      <p className="mt-4 text-xs text-slate-500">
        Đọc <Link href="/policy/privacy" className="text-brand-700 underline">Chính sách bảo mật & dữ liệu cá nhân</Link> để biết chúng tôi lưu gì, bao lâu và chia sẻ với ai.
      </p>
    </Section>
  );
}

function DeleteAccount() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [password, setPassword] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!user) return null;
  const isAdmin = user.role === "admin";
  const needPassword = user.has_password !== false;
  const ready = agree && confirm.trim().toLowerCase() === user.email && (!needPassword || password.length > 0);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true); setError("");
    try {
      await authApi.deleteAccount(confirm.trim(), needPassword ? password : undefined);
      logout();
      router.replace("/?deleted=1");
    } catch (err) { setError((err as ApiError).message); setBusy(false); }
  };

  return (
    <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="text-sm">
          <p className="font-medium text-rose-800">Xoá tài khoản</p>
          <p className="mt-1 text-rose-700/80">
            Xoá vĩnh viễn hồ sơ, khóa đã ghi danh, tiến độ, kết quả trắc nghiệm và lượt AI Check. Đơn hàng đã thanh toán được giữ ở dạng ẩn danh theo quy định kế toán.
          </p>
          {isAdmin && <p className="mt-1 text-xs text-rose-700">Tài khoản quản trị không tự xoá được; hãy nhờ admin khác hạ quyền trước.</p>}
        </div>
        {!open && <button onClick={() => setOpen(true)} disabled={isAdmin} className="btn shrink-0 border border-rose-300 bg-white text-rose-700 hover:bg-rose-100 disabled:opacity-50">Xoá tài khoản…</button>}
      </div>
      {open && (
        <form onSubmit={submit} className="mt-4 space-y-3">
          <p className="text-xs text-rose-700">Hành động không thể hoàn tác. Nên <b>tải dữ liệu</b> về trước.</p>
          <div>
            <label className="text-xs font-medium text-slate-700">Gõ email của bạn để xác nhận: <span className="font-mono">{user.email}</span></label>
            <input className="input mt-1" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" placeholder={user.email} />
          </div>
          {needPassword && (
            <div>
              <label className="text-xs font-medium text-slate-700">Mật khẩu hiện tại</label>
              <PasswordInput className="mt-1" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </div>
          )}
          <label className="flex items-start gap-2 text-xs text-slate-700">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5" />
            Tôi hiểu rằng dữ liệu học tập sẽ bị xoá và không khôi phục được.
          </label>
          {error && <p className="rounded-lg bg-rose-100 px-3 py-2 text-sm text-rose-800">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={!ready || busy} className="btn bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50">{busy ? "Đang xoá…" : "Xoá vĩnh viễn"}</button>
            <button type="button" onClick={() => { setOpen(false); setError(""); }} className="btn-outline">Huỷ</button>
          </div>
        </form>
      )}
    </div>
  );
}
