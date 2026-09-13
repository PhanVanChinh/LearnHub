"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import PageHeader from "@/components/PageHeader";
import ProfileSection from "./ProfileSection";
import PasswordSection from "./PasswordSection";
import GoogleSection from "./GoogleSection";
import SecuritySection from "./SecuritySection";

/** Trang /account: khung chung, từng mục là một section riêng để dễ mở rộng. */
export default function AccountView() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login?next=/account");
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <>
        <PageHeader eyebrow="Tài khoản" title="Hồ sơ của tôi" />
        <div className="container-x py-10"><div className="h-40 animate-pulse rounded-2xl bg-slate-100" /></div>
      </>
    );
  }

  return (
    <>
      <PageHeader eyebrow="Tài khoản" title="Hồ sơ của tôi" subtitle="Quản lý thông tin cá nhân và bảo mật đăng nhập." />
      <div className="container-x grid gap-6 py-10 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <ProfileSection />
          <PasswordSection />
          <GoogleSection />
          <SecuritySection />
        </div>
        <aside className="space-y-6 lg:self-start">
          <AccountSummary />
        </aside>
      </div>
    </>
  );
}

function AccountSummary() {
  const { user } = useAuth();
  if (!user) return null;
  const initial = user.full_name.trim().charAt(0).toUpperCase() || "U";
  const since = new Date(user.created_at).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
      <div className="flex items-center gap-4">
        {user.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatar_url} alt="" referrerPolicy="no-referrer" className="h-16 w-16 rounded-full object-cover" />
        ) : (
          <span className="grid h-16 w-16 place-items-center rounded-full bg-brand-600 text-2xl font-bold text-white">{initial}</span>
        )}
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900">{user.full_name}</p>
          <p className="truncate text-sm text-slate-500">{user.email}</p>
        </div>
      </div>
      <dl className="mt-5 space-y-2 text-sm">
        <Row k="Email">
          {user.email_verified ? (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">✓ Đã xác thực</span>
          ) : (
            <a href="/verify?next=/account" className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 hover:bg-amber-100">Chưa xác thực →</a>
          )}
        </Row>
        <Row k="Vai trò">{user.role === "admin" ? "Quản trị viên" : "Học viên"}</Row>
        <Row k="Mật khẩu">{user.has_password === false ? <span className="text-amber-700">Chưa đặt</span> : "Đã đặt"}</Row>
        <Row k="Đăng nhập Google">{user.has_google ? "Đã liên kết" : "Chưa liên kết"}</Row>
        <Row k="Thành viên từ">{since}</Row>
      </dl>
    </div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-500">{k}</dt>
      <dd className="text-right font-medium text-slate-800">{children}</dd>
    </div>
  );
}
