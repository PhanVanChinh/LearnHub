"use client";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthProvider";

/** Client ID công khai; bỏ trống → không hiện nút Google. */
export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (opts: Record<string, unknown>) => void;
          renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
          cancel: () => void;
        };
      };
    };
  }
}

let gsiPromise: Promise<void> | null = null;
function loadGsi() {
  gsiPromise ??= new Promise<void>((resolve) => {
    if (window.google?.accounts?.id) return resolve();
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    document.head.appendChild(s);
  });
  return gsiPromise;
}

/** Nút "Tiếp tục với Google" (Google Identity Services). Gọi onSuccess sau khi backend cấp token. */
export default function GoogleButton({ onSuccess, onError, text = "continue_with" }: {
  onSuccess: () => void; onError: (msg: string) => void; text?: "signin_with" | "signup_with" | "continue_with";
}) {
  const { loginWithGoogle } = useAuth();
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !ref.current) return;
    let cancelled = false;
    loadGsi().then(() => {
      if (cancelled || !ref.current || !window.google) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (resp: { credential: string }) => {
          setBusy(true);
          try { await loginWithGoogle(resp.credential); onSuccess(); }
          catch (e) { onError((e as Error).message); }
          finally { setBusy(false); }
        },
        ux_mode: "popup",
        auto_select: false,
      });
      ref.current.innerHTML = "";
      window.google.accounts.id.renderButton(ref.current, {
        type: "standard", theme: "outline", size: "large", shape: "pill", text, locale: "vi", width: 360,
      });
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  if (!GOOGLE_CLIENT_ID) return null;
  return (
    <div className="relative">
      <div ref={ref} className="flex min-h-[44px] justify-center" />
      {busy && <div className="absolute inset-0 grid place-items-center rounded-full bg-white/70 text-sm text-slate-600">Đang đăng nhập…</div>}
    </div>
  );
}
