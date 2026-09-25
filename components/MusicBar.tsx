"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Track } from "@/lib/music.server";

const KEY = "learnhub_music";
const DEFAULT_VOLUME = 0.35;

/** Thanh nhạc nền mỏng trên cùng: chỉ bật / tạm dừng, bài chọn ngẫu nhiên, hết bài tự sang bài khác.
 *  Trình duyệt chặn tự phát có tiếng → chỉ phát sau khi người dùng bấm. Nằm trong layout nên đổi trang không ngắt nhạc. */
export default function MusicBar({ tracks }: { tracks: Track[] }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [index, setIndex] = useState(() => Math.floor(Math.random() * Math.max(1, tracks.length)));
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState(false);

  // Nhớ lựa chọn tắt tiếng giữa các lần vào web (không tự phát lại — trình duyệt không cho)
  useEffect(() => {
    try { setMuted(localStorage.getItem(KEY) === "muted"); } catch { /* bỏ qua */ }
  }, []);

  const pickNext = useCallback(() => {
    if (tracks.length < 2) return setIndex(0);
    setIndex((cur) => { let n = cur; while (n === cur) n = Math.floor(Math.random() * tracks.length); return n; });
  }, [tracks.length]);

  const toggle = async () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) { el.pause(); setPlaying(false); return; }
    setError(false);
    el.volume = DEFAULT_VOLUME;
    try { await el.play(); setPlaying(true); } catch { setError(true); }
  };
  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    if (audioRef.current) audioRef.current.muted = next;
    try { localStorage.setItem(KEY, next ? "muted" : "on"); } catch { /* bỏ qua */ }
  };

  if (!tracks.length) return null;
  const track = tracks[Math.min(index, tracks.length - 1)];

  return (
    <div className="sticky top-0 z-50 border-b border-brand-800/40 bg-brand-900 text-white">
      <div className="container-x flex h-9 items-center gap-3 text-xs">
        <button onClick={toggle} aria-label={playing ? "Tạm dừng nhạc nền" : "Phát nhạc nền"} aria-pressed={playing}
          className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/15 transition hover:bg-white/25">
          {playing ? "❚❚" : "▶"}
        </button>
        <span className="min-w-0 flex-1 truncate text-white/80">
          {error ? "Không phát được bài này, thử lại hoặc chọn bài khác." : playing ? <>🎵 Đang phát: <b className="font-medium text-white">{track.title}</b></> : "🎵 Nhạc nền khi học"}
        </span>
        {playing && (
          <>
            <button onClick={pickNext} aria-label="Bài khác" className="shrink-0 rounded px-2 py-0.5 text-white/70 transition hover:bg-white/10 hover:text-white">Bài khác</button>
            <button onClick={toggleMute} aria-label={muted ? "Bật tiếng" : "Tắt tiếng"} aria-pressed={muted}
              className="shrink-0 rounded px-2 py-0.5 text-white/70 transition hover:bg-white/10 hover:text-white">{muted ? "🔇" : "🔊"}</button>
          </>
        )}
      </div>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- nhạc nền không lời thoại, phụ đề không có nội dung để mô tả */}
      <audio ref={audioRef} src={track.src} muted={muted} preload="none"
        onEnded={() => { pickNext(); }} onError={() => { if (playing) setError(true); }} />
    </div>
  );
}
