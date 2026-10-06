"use client";
import { useEffect, useRef, useState } from "react";

/* Trình phát YouTube qua IFrame API (domain nocookie) để biết giây đang xem → nhớ vị trí học tiếp.
   API không tải được (bị chặn) → rớt về iframe thường, vẫn xem được, chỉ không nhớ vị trí. */

type YTPlayer = { getCurrentTime(): number; seekTo(s: number, allowSeekAhead: boolean): void; destroy(): void };
type YTNamespace = {
  Player: new (el: HTMLElement, opts: Record<string, unknown>) => YTPlayer;
  PlayerState: { PLAYING: number; PAUSED: number; ENDED: number };
};
declare global {
  interface Window { YT?: YTNamespace; onYouTubeIframeAPIReady?: () => void }
}

const REPORT_EVERY_MS = 15_000;
const API_TIMEOUT_MS = 6_000;
let apiPromise: Promise<YTNamespace> | null = null;

function loadApi(): Promise<YTNamespace> {
  if (typeof window === "undefined") return Promise.reject(new Error("ssr"));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  apiPromise ??= new Promise<YTNamespace>((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT!); };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    s.onerror = () => reject(new Error("iframe_api"));
    document.head.appendChild(s);
    setTimeout(() => reject(new Error("timeout")), API_TIMEOUT_MS);
  });
  return apiPromise;
}

export default function VideoPlayer({ videoId, title, autoplay = false, className = "", startSeconds = 0, onProgress }: {
  videoId: string; title: string; autoplay?: boolean; className?: string;
  /** Tua tới giây này khi mở (đổi giá trị sau khi đã mở → seekTo) */
  startSeconds?: number;
  /** Gọi mỗi 15 giây khi đang phát, khi tạm dừng / hết video / rời trang, với giây đang xem */
  onProgress?: (seconds: number) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    let alive = true;
    const host = hostRef.current;
    if (!host) return;
    // Lúc gỡ (chuyển bài) React đã render bài mới nên onProgressRef trỏ sang bài mới → giây cuối phải báo bằng hàm của bài này
    const atMount = onProgressRef.current;
    const seconds = () => { const p = playerRef.current; try { return p ? Math.floor(p.getCurrentTime()) : null; } catch { return null; } };
    const report = () => { const s = seconds(); if (s !== null) onProgressRef.current?.(s); };
    const stopTimer = () => { clearInterval(timerRef.current); timerRef.current = undefined; };
    const mount = document.createElement("div"); // YT thay thế phần tử này bằng iframe; tạo riêng để React không quản lý nó
    host.appendChild(mount);
    loadApi().then((YT) => {
      if (!alive) return;
      playerRef.current = new YT.Player(mount, {
        videoId, host: "https://www.youtube-nocookie.com", width: "100%", height: "100%",
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1, autoplay: autoplay ? 1 : 0, start: Math.max(0, Math.floor(startSeconds)) },
        events: {
          onStateChange: (e: { data: number }) => {
            if (e.data === YT.PlayerState.PLAYING) { stopTimer(); timerRef.current = setInterval(report, REPORT_EVERY_MS); }
            else { stopTimer(); if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.ENDED) report(); }
          },
        },
      });
    }).catch(() => alive && setFallback(true));
    const onHide = () => report();
    window.addEventListener("pagehide", onHide);
    return () => {
      alive = false;
      window.removeEventListener("pagehide", onHide);
      stopTimer();
      const s = seconds();
      if (s !== null) atMount?.(s); // rời bài: lưu giây cuối cho ĐÚNG bài vừa xem
      try { playerRef.current?.destroy(); } catch { /* bỏ qua */ }
      playerRef.current = null;
      host.innerHTML = "";
    };
    // startSeconds chỉ dùng lúc tạo; đổi sau đó xử lý ở effect dưới
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, autoplay]);

  // Vị trí cần tua tới có sau khi player đã mở (tiến độ tải xong muộn hơn video)
  useEffect(() => {
    if (startSeconds > 0) try { playerRef.current?.seekTo(startSeconds, true); } catch { /* chưa sẵn sàng */ }
  }, [startSeconds]);

  const params = new URLSearchParams({ rel: "0", modestbranding: "1", playsinline: "1", ...(autoplay ? { autoplay: "1" } : {}), ...(startSeconds > 0 ? { start: String(Math.floor(startSeconds)) } : {}) });
  return (
    <div className={`relative aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-card ${className}`}>
      {fallback ? (
        <iframe
          key={videoId}
          src={`https://www.youtube-nocookie.com/embed/${videoId}?${params}`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 h-full w-full"
        />
      ) : (
        <div ref={hostRef} aria-label={title} role="region" className="absolute inset-0 [&>iframe]:h-full [&>iframe]:w-full" />
      )}
    </div>
  );
}

export const youtubeThumb = (videoId: string) => `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
