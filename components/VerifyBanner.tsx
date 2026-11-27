"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { useAuth } from "./AuthProvider";
import Emoji from "@/components/Emoji";

/** Chiều cao dải (px) lần tải trước, chỉ có khi tài khoản còn chưa xác thực. Script inline trong app/layout.tsx đọc key này
 *  (ghi cứng cùng chuỗi) trước khi vẽ trang để đặt --verify-banner-h → chỗ giữ sẵn, dải hiện ra không đẩy nội dung xuống. */
const VERIFY_BANNER_KEY = "learnhub_verify_banner_h";

/** Dải nhắc xác thực email, hiện trên mọi trang khi tài khoản chưa xác thực. */
export default function VerifyBanner() {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  const show = !!user && !user.email_verified && !pathname.startsWith("/verify");

  useEffect(() => {
    if (loading) return;
    const h = show ? ref.current?.offsetHeight ?? 0 : 0;
    try { h ? localStorage.setItem(VERIFY_BANNER_KEY, String(h)) : localStorage.removeItem(VERIFY_BANNER_KEY); } catch {}
    document.documentElement.style.setProperty("--verify-banner-h", `${h}px`);
  }, [loading, show, pathname]);

  // Chưa biết user: giữ chỗ bằng chiều cao lần trước (0 nếu lần trước không có dải)
  if (loading) return <div style={{ height: "var(--verify-banner-h, 0px)" }} aria-hidden="true" data-testid="verify-banner-placeholder" />;
  if (!show) return null;
  return (
    <div ref={ref} className="border-b border-amber-200 bg-amber-50 text-sm text-amber-900">
      <div className="container-x flex flex-wrap items-center justify-between gap-2 py-2">
        <span><Emoji>✉️</Emoji> Bạn chưa xác thực email <b>{user.email}</b>. Xác thực để ghi danh khóa học và lưu tiến độ.</span>
        <Link href={`/verify?next=${encodeURIComponent(pathname)}`} className="font-semibold text-amber-800 underline hover:text-amber-950">Xác thực ngay →</Link>
      </div>
    </div>
  );
}
