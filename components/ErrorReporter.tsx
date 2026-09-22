"use client";
import { useEffect } from "react";
import { reportClientError } from "@/lib/api";

const MAX_PER_SESSION = 5;
const IGNORE = [/ResizeObserver loop/, /Script error\.?$/, /Load failed/, /NetworkError/, /Failed to fetch/]; // nhiễu, không phải bug của ta

/** Bắt lỗi JS chưa xử lý và promise bị từ chối → gửi về backend để có dấu vết khi người dùng gặp lỗi. */
export default function ErrorReporter() {
  useEffect(() => {
    let sent = 0;
    const seen = new Set<string>();
    const send = (message: string, stack: string | undefined, source: string) => {
      if (sent >= MAX_PER_SESSION || IGNORE.some((re) => re.test(message))) return;
      const key = message.slice(0, 200);
      if (seen.has(key)) return;
      seen.add(key); sent++;
      reportClientError({ message: message.slice(0, 1000), stack: (stack ?? "").slice(0, 4000), source });
    };
    const onError = (e: ErrorEvent) => send(e.message || String(e.error), e.error?.stack, "window.onerror");
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      send(r instanceof Error ? r.message : String(r), r instanceof Error ? r.stack : undefined, "unhandledrejection");
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => { window.removeEventListener("error", onError); window.removeEventListener("unhandledrejection", onRejection); };
  }, []);
  return null;
}
