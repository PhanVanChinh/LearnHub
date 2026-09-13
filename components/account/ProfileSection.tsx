"use client";
import { FormEvent, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { ApiError, authApi } from "@/lib/api";
import Section from "./Section";

export default function ProfileSection() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user?.full_name ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const trimmed = name.replace(/\s+/g, " ").trim();
  const dirty = !!user && trimmed !== user.full_name;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!trimmed) return setError("Họ và tên không được để trống");
    setBusy(true); setError(""); setSaved(false);
    try {
      const u = await authApi.updateMe({ full_name: trimmed });
      setUser(u);
      setName(u.full_name);
      setSaved(true);
    } catch (err) {
      const ae = err as ApiError;
      setError(ae.errors?.full_name || ae.message);
    } finally { setBusy(false); }
  };

  return (
    <Section title="Thông tin cá nhân" description="Tên hiển thị trên trang học và trong email hệ thống gửi cho bạn.">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="full_name" className="text-sm font-medium text-slate-700">Họ và tên</label>
          <input id="full_name" value={name} maxLength={255} onChange={(e) => { setName(e.target.value); setSaved(false); setError(""); }}
            className={`input mt-1 ${error ? "!border-rose-400 !ring-rose-100" : ""}`} />
          {error && <p className="mt-1 text-sm text-rose-600">{error}</p>}
        </div>
        <div>
          <label htmlFor="email" className="text-sm font-medium text-slate-700">Email</label>
          <input id="email" value={user?.email ?? ""} disabled className="input mt-1 bg-slate-50 text-slate-500" />
          <p className="mt-1 text-xs text-slate-500">Email dùng để đăng nhập, hiện chưa hỗ trợ thay đổi.</p>
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" disabled={busy || !dirty} className="btn-primary disabled:opacity-50">{busy ? "Đang lưu…" : "Lưu thay đổi"}</button>
          {saved && <span className="text-sm text-emerald-600">✓ Đã lưu</span>}
        </div>
      </form>
    </Section>
  );
}
