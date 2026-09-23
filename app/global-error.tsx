"use client";
import { useEffect } from "react";
import { reportClientError } from "@/lib/api";

/** Lỗi trong layout gốc: phải tự render <html>/<body> vì layout đã hỏng. Giữ tối giản, không phụ thuộc component khác. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { reportClientError({ message: error.message, stack: error.stack, source: "app/global-error" }); }, [error]);
  return (
    <html lang="vi">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#f8fafc", color: "#0f172a", margin: 0 }}>
        <div style={{ maxWidth: 480, margin: "15vh auto", padding: 24, textAlign: "center" }}>
          <p style={{ fontSize: 56, margin: 0 }}>😵</p>
          <h1 style={{ fontSize: 22, margin: "12px 0 8px" }}>LearnHub gặp lỗi không mong muốn</h1>
          <p style={{ color: "#475569" }}>Sự cố đã được ghi nhận. Hãy tải lại trang.</p>
          {error.digest && <p style={{ fontFamily: "monospace", fontSize: 12, color: "#94a3b8" }}>Mã: {error.digest}</p>}
          <button onClick={reset} style={{ marginTop: 16, background: "#1b45f5", color: "#fff", border: 0, borderRadius: 10, padding: "10px 20px", fontWeight: 600, cursor: "pointer" }}>Tải lại</button>
        </div>
      </body>
    </html>
  );
}
