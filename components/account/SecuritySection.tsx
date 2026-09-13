"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import Section from "./Section";

const fmt = (iso?: string | null) => {
  if (!iso) return "—";
  // Backend lưu UTC không có hậu tố Z → thêm vào để trình duyệt đổi sang giờ máy
  const d = new Date(/Z|[+-]\d\d:\d\d$/.test(iso) ? iso : iso + "Z");
  return d.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

export default function SecuritySection() {
  const { user, logout, logoutAll } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (!user) return null;

  const doLogoutAll = async () => {
    if (!confirm("Đăng xuất khỏi mọi thiết bị khác? Thiết bị này vẫn giữ đăng nhập.")) return;
    setBusy(true); setMsg(null);
    try { await logoutAll(); setMsg({ ok: true, text: "Đã đăng xuất các thiết bị khác. Phiên trên thiết bị này vẫn hoạt động." }); }
    catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    finally { setBusy(false); }
  };
  const doLogout = () => { logout(); router.replace("/"); };

  return (
    <Section title="Bảo mật & phiên đăng nhập" description="Nếu nghi ngờ tài khoản bị dùng ở nơi khác, hãy đổi mật khẩu rồi đăng xuất mọi thiết bị.">
      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        <Stat k="Đăng nhập gần nhất" v={fmt(user.last_login_at)} />
        <Stat k="Đổi mật khẩu lần cuối" v={user.password_changed_at ? fmt(user.password_changed_at) : "Chưa đổi"} />
        <Stat k="Đăng xuất mọi thiết bị lần cuối" v={user.sessions_revoked_at ? fmt(user.sessions_revoked_at) : "Chưa dùng"} />
      </dl>
      {msg && <p className={`mt-4 rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{msg.text}</p>}
      <div className="mt-5 flex flex-wrap gap-3">
        <button onClick={doLogoutAll} disabled={busy} className="btn-outline disabled:opacity-60">{busy ? "Đang xử lý…" : "Đăng xuất mọi thiết bị khác"}</button>
        <button onClick={doLogout} className="btn border border-rose-200 bg-white text-rose-600 hover:bg-rose-50">Đăng xuất thiết bị này</button>
      </div>
    </Section>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <dt className="text-xs text-slate-500">{k}</dt>
      <dd className="mt-1 font-medium text-slate-800">{v}</dd>
    </div>
  );
}
