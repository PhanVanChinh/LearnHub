import type { Lesson } from "@/data/courses";
import Emoji from "@/components/Emoji";

type Props = {
  lessons: Lesson[];
  index: number;
  enrolled: boolean;
  isDone: (i: number) => boolean;
  hasVideo: (i: number) => boolean;
  onSelect: (i: number) => void;
};

// Danh sách bài của trang học: dùng chung cho sidebar desktop và khối gập trên mobile
export default function LessonList({ lessons, index, enrolled, isDone, hasVideo, onSelect }: Props) {
  return (
    <ol className="max-h-[70vh] divide-y divide-white/10 overflow-y-auto">
      {lessons.map((l, i) => {
        const locked = !l.free && !enrolled;
        const isActive = i === index;
        return (
          <li key={`${i}-${l.title}`}>
            <button onClick={() => onSelect(i)}
              className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-white/10 ${isActive ? "bg-brand-600/30" : ""}`}>
              <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${isActive ? "bg-brand-500 text-white" : isDone(i) ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-slate-300"}`}>
                {isActive ? <Emoji label="Đang xem">▶</Emoji> : isDone(i) ? <Emoji label="Đã hoàn thành">✓</Emoji> : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-sm ${isActive ? "font-semibold text-white" : "text-slate-200"}`}>{l.title}</span>
                <span className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                  <span>{hasVideo(i) ? <Emoji label="Video">🎬</Emoji> : l.quizCount ? <Emoji label="Trắc nghiệm">📝</Emoji> : l.content || l.hasContent ? <Emoji label="Bài đọc">📖</Emoji> : l.attachments?.length ? <Emoji label="Tài liệu">📚</Emoji> : <Emoji label="Bài học">📄</Emoji>} {l.duration}</span>
                  {!!l.quizCount && <span>{l.quizCount} câu</span>}
                  {!!l.attachments?.length && <span><Emoji>📎</Emoji> {l.attachments.length}<span className="sr-only"> tài liệu</span></span>}
                  {l.free && <span className="rounded-full bg-emerald-500/20 px-1.5 text-emerald-300">Xem thử</span>}
                  {locked && <Emoji label="Cần ghi danh">🔒</Emoji>}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
