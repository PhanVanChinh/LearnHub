"use client";
import Link from "next/link";
import { useEffect } from "react";
import { ApiError, reportClientError } from "@/lib/api";

/** Ranh giới lỗi cho mọi route (trừ layout gốc — xem global-error.tsx). Báo lỗi về backend và cho thử lại. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientError({ message: error.message, stack: error.stack, source: "app/error" });
  }, [error]);
  const requestId = error instanceof ApiError ? error.requestId : null;
  const offline = error instanceof ApiError && error.status === 0;

  return (
    <div className="container-x py-24 text-center">
      <p className="text-6xl">{offline ? "📡" : "😵"}</p>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">{offline ? "Không kết nối được máy chủ" : "Có lỗi xảy ra"}</h1>
      <p className="mx-auto mt-2 max-w-md text-slate-600">
        {offline ? "Kiểm tra mạng của bạn rồi thử lại. Nếu vẫn lỗi, máy chủ có thể đang bảo trì." : "Chúng tôi đã ghi nhận sự cố. Hãy thử tải lại; nếu lỗi lặp lại, liên hệ hỗ trợ kèm mã bên dưới."}
      </p>
      {(requestId || error.digest) && (
        <p className="mt-3 font-mono text-xs text-slate-400">Mã tra cứu: {requestId ?? error.digest}</p>
      )}
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button onClick={reset} className="btn-primary">Thử lại</button>
        <Link href="/" className="btn-outline">Về trang chủ</Link>
        <Link href="/contact" className="btn-outline">Liên hệ hỗ trợ</Link>
      </div>
    </div>
  );
}
