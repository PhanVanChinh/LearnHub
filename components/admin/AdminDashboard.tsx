"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import PageHeader from "@/components/PageHeader";
import { adminApi, AdminStats } from "@/lib/api";
import { formatVND } from "@/lib/site";
import CoursesPanel from "./CoursesPanel";
import PublishButton from "./PublishButton";
import EnrollmentsPanel from "./EnrollmentsPanel";
import OrdersPanel from "./OrdersPanel";
import ContactsPanel from "./ContactsPanel";
import UsersPanel from "./UsersPanel";

const TABS = [
  { key: "orders", label: "Đơn hàng" },
  { key: "courses", label: "Khóa học" },
  { key: "users", label: "Người dùng" },
  { key: "enrollments", label: "Ghi danh" },
  { key: "contacts", label: "Liên hệ" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export default function AdminDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("orders");
  const [stats, setStats] = useState<AdminStats | null>(null);

  const isAdmin = !!user && user.role === "admin";
  const loadStats = useCallback(() => { if (isAdmin) adminApi.stats().then(setStats).catch(() => {}); }, [isAdmin]);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login?next=/admin");
  }, [user, loading, router]);
  useEffect(loadStats, [loadStats]);

  if (loading || !user) return <div className="container-x py-16 text-slate-500">Đang tải…</div>;
  if (!isAdmin) {
    return (
      <div className="container-x py-16">
        <div className="mx-auto max-w-md rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center">
          <p className="text-lg font-semibold text-rose-700">Bạn không có quyền truy cập trang này</p>
          <p className="mt-2 text-sm text-rose-600">Chỉ tài khoản admin mới vào được khu quản trị.</p>
        </div>
      </div>
    );
  }

  const cards = stats ? [
    { label: "Người dùng", value: stats.users.toLocaleString("vi-VN"), sub: `${stats.admins} admin` },
    { label: "Khóa học", value: stats.courses.toLocaleString("vi-VN"), sub: `${stats.free_courses} miễn phí · ${stats.paid_courses} trả phí` },
    { label: "Ghi danh", value: stats.enrollments.toLocaleString("vi-VN"), sub: `${stats.total_views.toLocaleString("vi-VN")} lượt xem toàn site` },
    { label: "Doanh thu", value: formatVND(stats.revenue), sub: `${stats.paid_orders} đơn đã thanh toán · ${stats.pending_orders} đơn chờ` },
  ] : [];

  return (
    <>
      <PageHeader eyebrow="Quản trị" title="Bảng điều khiển" subtitle="Quản lý khóa học, người dùng và quyền truy cập." />
      <div className="container-x py-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(cards.length ? cards : Array(4).fill(null)).map((c, i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
              {c ? (<>
                <p className="text-sm text-slate-500">{c.label}</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{c.value}</p>
                <p className="mt-1 text-xs text-slate-500">{c.sub}</p>
              </>) : <div className="h-16 animate-pulse rounded-lg bg-slate-100" />}
            </div>
          ))}
        </div>

        <div className="mt-6"><PublishButton /></div>

        <div className="mt-8 flex gap-1 border-b border-slate-200">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${tab === t.key ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
              {t.label}
              {t.key === "orders" && !!stats?.pending_orders && (
                <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-700">{stats.pending_orders}</span>
              )}
              {t.key === "contacts" && !!stats?.new_contacts && (
                <span className="ml-1.5 rounded-full bg-brand-100 px-1.5 py-0.5 text-xs font-semibold text-brand-700">{stats.new_contacts}</span>
              )}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {tab === "orders" && <OrdersPanel onChanged={loadStats} />}
          {tab === "contacts" && <ContactsPanel onChanged={loadStats} />}
          {tab === "courses" && <CoursesPanel onChanged={loadStats} />}
          {tab === "users" && <UsersPanel onChanged={loadStats} />}
          {tab === "enrollments" && <EnrollmentsPanel onChanged={loadStats} />}
        </div>
      </div>
    </>
  );
}
