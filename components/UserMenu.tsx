"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthProvider";

export default function UserMenu({ mobile = false }: { mobile?: boolean }) {
  const { user, loading, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  // Đóng khi: bấm / chạm ra ngoài (thay cho onMouseLeave — màn cảm ứng không có "rời chuột"), đổi trang.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!wrapRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);
  useEffect(() => setOpen(false), [pathname]);
  /** Escape: đóng và trả focus về nút mở menu để người dùng bàn phím không mất vị trí. */
  const closeToButton = () => { setOpen(false); buttonRef.current?.focus(); };

  // Mẫu menu WAI-ARIA: mở bằng bàn phím → focus mục đầu; ↑↓ vòng giữa các mục, Home/End về đầu/cuối.
  const menuRef = useRef<HTMLDivElement>(null);
  const focusAt = (pick: (items: HTMLElement[], cur: number) => number) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    if (!items.length) return;
    items[pick(items, items.indexOf(document.activeElement as HTMLElement))]?.focus();
  };
  const [focusFirst, setFocusFirst] = useState(false);
  useEffect(() => {
    if (open && focusFirst) { focusAt(() => 0); setFocusFirst(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, focusFirst]);
  const onMenuKey = (e: React.KeyboardEvent) => {
    const keys: Record<string, (items: HTMLElement[], cur: number) => number> = {
      ArrowDown: (it, c) => (c + 1) % it.length,
      ArrowUp: (it, c) => (c <= 0 ? it.length - 1 : c - 1),
      Home: () => 0,
      End: (it) => it.length - 1,
    };
    if (e.key === "Escape") { closeToButton(); return; }
    const pick = keys[e.key];
    if (pick) { e.preventDefault(); focusAt(pick); }
  };

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
  const Avatar = ({ cls }: { cls: string }) =>
    user.avatar_url ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={user.avatar_url} alt="" referrerPolicy="no-referrer" className={`${cls} rounded-full object-cover`} />
    ) : (
      <span className={`${cls} grid place-items-center rounded-full bg-brand-600 font-semibold text-white`}>{initial}</span>
    );
  if (mobile) {
    const item = "block rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"; // cùng kiểu các mục điều hướng mobile
    return (
      <div className="mt-2 border-t border-slate-200 pt-2">
        <div className="flex items-center gap-2 px-3 py-2 text-sm">
          <Avatar cls="h-8 w-8" />
          <span className="min-w-0">
            <span className="block truncate font-medium">{user.full_name}</span>
            <span className="block truncate text-xs text-slate-500">{user.email}</span>
          </span>
        </div>
        <Link href="/my-courses" className={item}>Khóa học của tôi</Link>
        <Link href="/orders" className={item}>Đơn hàng của tôi</Link>
        <Link href="/account" className={item}>Tài khoản</Link>
        {user.role === "admin" && <Link href="/admin" className={`${item} text-amber-700 hover:bg-amber-50`}>Quản trị</Link>}
        <button onClick={logout} className={`${item} w-full text-left text-rose-600 hover:bg-rose-50`}>Đăng xuất</button>
      </div>
    );
  }

  return (
    // Focus rời hẳn khỏi menu (Tab qua mục cuối) → đóng
    <div ref={wrapRef} className="relative" onBlur={(e) => { if (open && !e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false); }}>
      <button ref={buttonRef} onClick={(e) => { setOpen(!open); if (e.detail === 0) setFocusFirst(true); /* detail=0: bấm bằng bàn phím */ }}
        onKeyDown={(e) => {
          if (e.key === "Escape" && open) closeToButton();
          if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setFocusFirst(true); }
        }} aria-haspopup="menu" aria-expanded={open} aria-label={`Tài khoản ${user.full_name}`}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium hover:bg-slate-100">
        <Avatar cls="h-8 w-8" />
        <span className="max-w-[10rem] truncate">{user.full_name}</span>
        {user.role === "admin" && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">admin</span>}
      </button>
      {open && (
        <div ref={menuRef} role="menu" aria-label="Tài khoản" tabIndex={-1} onKeyDown={onMenuKey} className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div role="presentation" className="border-b border-slate-100 px-4 py-3 text-xs text-slate-500">{user.email}</div>
          <Link href="/my-courses" role="menuitem" tabIndex={-1} onClick={() => setOpen(false)} className="block px-4 py-2.5 text-sm hover:bg-slate-50 focus:bg-slate-50 focus:outline-none">Khóa học của tôi</Link>
          <Link href="/orders" role="menuitem" tabIndex={-1} onClick={() => setOpen(false)} className="block px-4 py-2.5 text-sm hover:bg-slate-50 focus:bg-slate-50 focus:outline-none">Đơn hàng của tôi</Link>
          <Link href="/account" role="menuitem" tabIndex={-1} onClick={() => setOpen(false)} className="block px-4 py-2.5 text-sm hover:bg-slate-50 focus:bg-slate-50 focus:outline-none">Tài khoản</Link>
          {user.role === "admin" && (
            <Link href="/admin" role="menuitem" tabIndex={-1} onClick={() => setOpen(false)} className="block px-4 py-2.5 text-sm font-medium text-amber-700 hover:bg-amber-50 focus:bg-amber-50 focus:outline-none">Quản trị</Link>
          )}
          <button role="menuitem" tabIndex={-1} onClick={() => { logout(); setOpen(false); }} className="block w-full px-4 py-2.5 text-left text-sm text-rose-600 hover:bg-rose-50 focus:bg-rose-50 focus:outline-none">Đăng xuất</button>
        </div>
      )}
    </div>
  );
}
