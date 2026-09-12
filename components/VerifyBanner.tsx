"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";

/** Dải nhắc xác thực email, hiện trên mọi trang khi tài khoản chưa xác thực. */
export default function VerifyBanner() {
  const { user } = useAuth();
  const pathname = usePathname();
  if (!user || user.email_verified || pathname.startsWith("/verify")) return null;
  return (
    <div className="border-b border-amber-200 bg-amber-50 text-sm text-amber-900">
      <div className="container-x flex flex-wrap items-center justify-between gap-2 py-2">
        <span>✉️ Bạn chưa xác thực email <b>{user.email}</b>. Xác thực để ghi danh khóa học và lưu tiến độ.</span>
        <Link href={`/verify?next=${encodeURIComponent(pathname)}`} className="font-semibold text-amber-800 underline hover:text-amber-950">Xác thực ngay →</Link>
      </div>
    </div>
  );
}
