"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Track } from "@/lib/music.server";

const KEY = "learnhub_music";
const VOLUME = 0.35;

/** Nút nhạc nền nổi ở góc dưới phải: bấm để bật/tạm dừng, rê chuột (hoặc đang phát) thì mở rộng thành thanh
 *  có tên bài, nút đổi bài và tắt tiếng. Bài chọn ngẫu nhiên, hết bài tự sang bài khác.
 *  Nằm trong layout nên đổi trang không ngắt nhạc. Trình duyệt chặn tự phát có tiếng → chỉ phát sau khi người dùng bấm. */
export default function MusicBar({ tracks }: { tracks: Track[] }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [index, setIndex] = useState(() => Math.floor(Math.random() * Math.max(1, tracks.length)));
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [hover, setHover] = useState(false);
  const [error, setError] = useState(false);

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
    el.volume = VOLUME;
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
  const open = hover || playing; // đang phát thì luôn mở để thấy tên bài và nút điều khiển

  return (
    <div className="fixed bottom-4 right-4 z-40 print:hidden" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <div className={`flex items-center gap-1 rounded-full border border-slate-200/70 bg-white/85 py-1 pl-1 shadow-lg shadow-slate-900/10 backdrop-blur-md transition-all duration-300 ${open ? "pr-2" : "pr-1"}`}>
        <button onClick={toggle} aria-label={playing ? "Tạm dừng nhạc nền" : "Phát nhạc nền"} aria-pressed={playing}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-md transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400">
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>

        {/* Phần mở rộng: chiếm chỗ 0 khi thu gọn nên không che nội dung */}
        <div className={`flex items-center gap-1 overflow-hidden transition-all duration-300 ${open ? "max-w-[15rem] opacity-100" : "max-w-0 opacity-0"}`}>
          {playing && !muted && <Equalizer />}
          <span className="max-w-[8rem] truncate px-1 text-xs font-medium text-slate-700" title={track.title}>
            {error ? "Không phát được" : playing ? track.title : "Nhạc nền khi học"}
          </span>
          <button onClick={pickNext} aria-label="Bài khác" title="Bài khác"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"><NextIcon /></button>
          <button onClick={toggleMute} aria-label={muted ? "Bật tiếng" : "Tắt tiếng"} aria-pressed={muted} title={muted ? "Bật tiếng" : "Tắt tiếng"}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800">{muted ? <MutedIcon /> : <SoundIcon />}</button>
        </div>
      </div>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- nhạc nền không lời thoại, phụ đề không có nội dung để mô tả */}
      <audio ref={audioRef} src={track.src} muted={muted} preload="none" onEnded={pickNext} onError={() => { if (playing) setError(true); }} />
    </div>
  );
}

const NextIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M5 5.5v13a1 1 0 0 0 1.55.83L16 13.1V18a1 1 0 0 0 2 0V6a1 1 0 0 0-2 0v4.9L6.55 4.67A1 1 0 0 0 5 5.5z" /></svg>
);
const SoundIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" stroke="none" /><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
  </svg>
);
const MutedIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" stroke="none" /><path d="m16 9 5 6M21 9l-5 6" />
  </svg>
);
const PlayIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.8-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14z" /></svg>
);
const PauseIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4h3.5v16H7zM13.5 4H17v16h-3.5z" /></svg>
);

/** Ba cột sóng nhạc nhún nhảy khi đang phát (tắt theo cài đặt giảm chuyển động của hệ điều hành). */
const Equalizer = () => (
  <span className="flex h-4 shrink-0 items-end gap-[2px] pl-1" aria-hidden="true">
    {[0, 1, 2].map((i) => (
      <span key={i} className="w-[3px] rounded-full bg-brand-500 animate-eq" style={{ animationDelay: `${i * 0.18}s`, height: "60%" }} />
    ))}
  </span>
);
