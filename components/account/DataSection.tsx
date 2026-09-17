"use client";
import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { authApi } from "@/lib/api";
import Section from "./Section";

/** Quyền với dữ liệu cá nhân: tải về toàn bộ dữ liệu (commit sau: xoá tài khoản). */
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
    <Section title="Dữ liệu cá nhân" description="Bạn có quyền xem, tải về và yêu cầu xoá dữ liệu mà LearnHub lưu về mình.">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="text-sm text-slate-600">
          <p className="font-medium text-slate-800">Tải toàn bộ dữ liệu của tôi</p>
          <p className="mt-1">Gồm hồ sơ, khóa đã ghi danh, tiến độ học, kết quả trắc nghiệm, đơn hàng, lượt AI Check và tin nhắn liên hệ. Không gồm mật khẩu.</p>
          {msg && <p className={`mt-2 text-sm ${msg.ok ? "text-emerald-600" : "text-rose-600"}`}>{msg.text}</p>}
        </div>
        <button onClick={download} disabled={busy} className="btn-outline shrink-0 disabled:opacity-60">{busy ? "Đang tạo file…" : "⬇ Tải JSON"}</button>
      </div>
    </Section>
  );
}
