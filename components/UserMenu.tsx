"use client";
import Link from "next/link";
import { useState } from "react";
import { useAuth } from "./AuthProvider";

export default function UserMenu({ mobile = false }: { mobile?: boolean }) {
  const { user, loading, logout } = useAuth();
  const [open, setOpen] = useState(false);

  if (loading) return <div className="h-9 w-24 animate-pulse rounded-lg bg-slate-100" />;

  if (!user) {
    return (
      <div className={mobile ? "mt-2 flex gap-2" : "flex items-center gap-2"}>
        <Link href="/login" className={`btn-outline ${mobile ? "flex-1" : ""}`}>Đăng nhập</Link>
        <Link href="/register" className={`btn-primary ${mobile ? "flex-1" : ""}`}>Đăng ký</Link>
      </div>
    );
  }

  const initial = user.full_name.trim().charAt(0).toUpperCase() || "U";
  if (mobile) {
    return (
      <div className="mt-2 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-600 font-semibold text-white">{initial}</span>
          <span className="font-medium">{user.full_name}</span>
        </div>
        <div className="flex items-center gap-3 text-sm font-medium">
          {user.role === "admin" && <Link href="/admin" className="text-amber-700">Quản trị</Link>}
          <button onClick={logout} className="text-rose-600">Đăng xuất</button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium hover:bg-slate-100">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-600 font-semibold text-white">{initial}</span>
        <span className="max-w-[10rem] truncate">{user.full_name}</span>
        {user.role === "admin" && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">admin</span>}
      </button>
      {open && (
        <div onMouseLeave={() => setOpen(false)} className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 px-4 py-3 text-xs text-slate-500">{user.email}</div>
          <Link href="/my-courses" onClick={() => setOpen(false)} className="block px-4 py-2.5 text-sm hover:bg-slate-50">Khóa học của tôi</Link>
          {user.role === "admin" && (
            <Link href="/admin" onClick={() => setOpen(false)} className="block px-4 py-2.5 text-sm font-medium text-amber-700 hover:bg-amber-50">Quản trị</Link>
          )}
          <button onClick={() => { logout(); setOpen(false); }} className="block w-full px-4 py-2.5 text-left text-sm text-rose-600 hover:bg-rose-50">Đăng xuất</button>
        </div>
      )}
    </div>
  );
}
