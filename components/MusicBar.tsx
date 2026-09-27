"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Track } from "@/lib/music.server";

const KEY = "learnhub_music";
const DEFAULT_VOLUME = 0.35;
const PEEK_MS = 4000; // sau khi chạm/bấm, giữ thanh mở rộng bấy nhiêu lâu rồi tự thu gọn
const FADE_MS = 600; // âm lượng tăng/giảm dần khi phát/dừng để không bị giật

type Saved = { muted?: boolean; volume?: number };

/** Đọc cài đặt đã lưu. Tương thích định dạng cũ ("muted" / "on"). */
function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw || raw === "on") return {};
    if (raw === "muted") return { muted: true };
    return JSON.parse(raw) as Saved;
  } catch { return {}; }
}
function save(patch: Saved) {
  try { localStorage.setItem(KEY, JSON.stringify({ ...load(), ...patch })); } catch { /* bỏ qua */ }
}

/** Nút nhạc nền nổi ở góc dưới phải: bấm để bật/tạm dừng, rê chuột / focus / chạm thì mở rộng thành thanh
 *  có tên bài, nút đổi bài, tắt tiếng và thanh trượt âm lượng (mức đã chọn được nhớ giữa các lần vào web).
 *  Đang phát mà thu gọn thì nút hiện sóng nhạc thay cho biểu tượng. Tên bài được đăng ký với hệ điều hành
 *  (Media Session) nên hiện trên màn hình khoá và điều khiển được bằng phím media / tai nghe. Bài chọn ngẫu nhiên, hết bài tự sang bài khác.
 *  Nằm trong layout nên đổi trang không ngắt nhạc. Trình duyệt chặn tự phát có tiếng → chỉ phát sau khi người dùng bấm. */
export default function MusicBar({ tracks }: { tracks: Track[] }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [index, setIndex] = useState(() => Math.floor(Math.random() * Math.max(1, tracks.length)));
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(DEFAULT_VOLUME);
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [peek, setPeek] = useState(false);
  const [error, setError] = useState(false);
  const playingRef = useRef(false);
  const volumeRef = useRef(DEFAULT_VOLUME);
  const failed = useRef(new Set<string>());
  const peekTimer = useRef<ReturnType<typeof setTimeout>>();
  const fadeFrame = useRef<number | null>(null);
  playingRef.current = playing;
  volumeRef.current = volume;

  const cancelFade = useCallback(() => {
    if (fadeFrame.current !== null) cancelAnimationFrame(fadeFrame.current);
    fadeFrame.current = null;
  }, []);
  /** Đưa âm lượng của <audio> từ mức hiện tại về `to` trong FADE_MS, xong thì gọi onDone. */
  const fade = useCallback((el: HTMLAudioElement, to: number, onDone?: () => void) => {
    cancelFade();
    const from = el.volume;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / FADE_MS);
      el.volume = from + (to - from) * t;
      if (t < 1) fadeFrame.current = requestAnimationFrame(step);
      else { fadeFrame.current = null; onDone?.(); }
    };
    fadeFrame.current = requestAnimationFrame(step);
  }, [cancelFade]);
  useEffect(() => cancelFade, [cancelFade]);

  /** Mở rộng một lúc sau mỗi thao tác — cách duy nhất để chạm tới các nút phụ trên màn hình cảm ứng. */
  const showBriefly = useCallback(() => {
    setPeek(true);
    clearTimeout(peekTimer.current);
    peekTimer.current = setTimeout(() => setPeek(false), PEEK_MS);
  }, []);
  useEffect(() => () => clearTimeout(peekTimer.current), []);

  useEffect(() => {
    const s = load();
    setMuted(!!s.muted);
    if (typeof s.volume === "number" && s.volume >= 0 && s.volume <= 1) setVolume(s.volume);
  }, []);

  const pickNext = useCallback(() => {
    showBriefly();
    if (tracks.length < 2) return setIndex(0);
    setIndex((cur) => { let n = cur; while (n === cur) n = Math.floor(Math.random() * tracks.length); return n; });
  }, [tracks.length, showBriefly]);

  const play = useCallback(async () => {
    const el = audioRef.current;
    if (!el || playingRef.current) return;
    showBriefly();
    setError(false);
    el.volume = 0;
    try { await el.play(); setPlaying(true); fade(el, volumeRef.current); } catch { setError(true); }
  }, [showBriefly, fade]);
  const pause = useCallback(() => {
    const el = audioRef.current;
    if (!el || !playingRef.current) return;
    showBriefly();
    setPlaying(false);
    fade(el, 0, () => { el.pause(); el.volume = volumeRef.current; });
  }, [showBriefly, fade]);
  const toggle = () => (playing ? pause() : play());
  const setMutedPersist = (next: boolean) => {
    setMuted(next);
    if (audioRef.current) audioRef.current.muted = next;
    save({ muted: next });
  };
  const toggleMute = () => { showBriefly(); setMutedPersist(!muted); };
  /** Kéo thanh trượt: đổi âm lượng ngay, đang tắt tiếng mà kéo lên thì tự bật tiếng. */
  const changeVolume = (v: number) => {
    showBriefly();
    setVolume(v);
    if (playing && audioRef.current) { cancelFade(); audioRef.current.volume = v; }
    if (muted && v > 0) setMutedPersist(false);
    save({ volume: v });
  };

  const track = tracks[Math.min(index, tracks.length - 1)];
  const src = track?.src;

  // Đổi src của <audio> làm trình duyệt dừng phát, nên đang phát thì phải gọi play() lại cho bài mới.
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !src || !playingRef.current) return;
    el.play().catch(() => setError(true));
  }, [src]);

  // Media Session: tên bài trên màn hình khoá / trung tâm điều khiển, phím media và tai nghe điều khiển được.
  const title = track?.title;
  useEffect(() => {
    if (!title || !("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({ title, artist: "Nhạc nền LearnHub" });
    navigator.mediaSession.playbackState = playing ? "playing" : "paused";
  }, [title, playing]);
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    ms.setActionHandler("play", play);
    ms.setActionHandler("pause", pause);
    ms.setActionHandler("nexttrack", pickNext);
    return () => { ms.setActionHandler("play", null); ms.setActionHandler("pause", null); ms.setActionHandler("nexttrack", null); };
  }, [play, pause, pickNext]);

  /** File hỏng hoặc không tải được: nhảy sang bài khác, chỉ báo lỗi khi mọi bài đều hỏng. */
  const onError = () => {
    if (!playingRef.current || !src) return;
    failed.current.add(src);
    if (tracks.length > 1 && failed.current.size < tracks.length) pickNext();
    else { setPlaying(false); setError(true); }
  };

  if (!tracks.length) return null;
  const open = hover || focus || peek; // đang phát vẫn thu gọn để không che nội dung; nút hiện sóng nhạc thay biểu tượng
  const tab = open ? 0 : -1; // thu gọn thì các nút phụ không nhận Tab (đang ẩn, không nên focus vào)
  const silent = muted || volume === 0;

  return (
    <div className="fixed bottom-4 right-4 z-40 print:hidden" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      onFocus={() => setFocus(true)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocus(false); }}>
      <div className={`flex items-center gap-1 rounded-full border border-slate-200/70 bg-white/85 py-1 pl-1 shadow-lg shadow-slate-900/10 backdrop-blur-md transition-all duration-300 ${open ? "pr-2" : "pr-1"}`}>
        <button onClick={toggle} aria-label={playing ? "Tạm dừng nhạc nền" : "Phát nhạc nền"} aria-pressed={playing}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-md transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400">
          {playing ? (open ? <PauseIcon /> : <Equalizer className="bg-white" />) : <PlayIcon />}
        </button>

        {/* Phần mở rộng: chiếm chỗ 0 khi thu gọn nên không che nội dung */}
        <div className={`flex items-center gap-1 overflow-hidden transition-all duration-300 ${open ? "max-w-[20rem] opacity-100" : "max-w-0 opacity-0"}`}>
          {playing && !silent && <Equalizer className="bg-brand-500" />}
          <span className="max-w-[8rem] truncate px-1 text-xs font-medium text-slate-700" title={track.title}>
            {error ? "Không phát được" : playing ? track.title : "Nhạc nền khi học"}
          </span>
          <button onClick={pickNext} aria-label="Bài khác" title="Bài khác" tabIndex={tab}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"><NextIcon /></button>
          <button onClick={toggleMute} aria-label={muted ? "Bật tiếng" : "Tắt tiếng"} aria-pressed={muted} title={muted ? "Bật tiếng" : "Tắt tiếng"} tabIndex={tab}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800">{silent ? <MutedIcon /> : <SoundIcon />}</button>
          <input type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume} onChange={(e) => changeVolume(Number(e.target.value))}
            aria-label="Âm lượng" tabIndex={tab} title={`Âm lượng ${Math.round((muted ? 0 : volume) * 100)}%`}
            className="mr-1 h-1 w-16 shrink-0 cursor-pointer accent-brand-600" />
        </div>
      </div>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- nhạc nền không lời thoại, phụ đề không có nội dung để mô tả */}
      <audio ref={audioRef} src={track.src} muted={muted} preload="none" onEnded={pickNext} onError={onError} onPlaying={() => failed.current.clear()} />
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
const Equalizer = ({ className }: { className: string }) => (
  <span className="flex h-4 shrink-0 items-end gap-[2px] px-1" aria-hidden="true">
    {[0, 1, 2].map((i) => (
      <span key={i} className={`w-[3px] rounded-full animate-eq ${className}`} style={{ animationDelay: `${i * 0.18}s`, height: "60%" }} />
    ))}
  </span>
);
