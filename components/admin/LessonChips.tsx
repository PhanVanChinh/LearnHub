// Dùng chung cho các trình soạn theo bài (nội dung, trắc nghiệm, tài liệu): cùng đọc tiêu đề từ ô "Danh sách bài"
// và cùng một bài đang chọn, nên admin chọn bài một lần rồi soạn cả ba phần.

/** Tiêu đề các bài từ văn bản "Tiêu đề | Thời lượng | ..." mỗi dòng. */
export const lessonTitles = (lessonsText: string) =>
  lessonsText.split("\n").map((l) => l.split("|")[0].trim()).filter(Boolean);

/** Bài đang chọn, kẹp lại khi admin xóa bớt dòng ở danh sách bài. */
export const clampLesson = (lesson: number, titles: string[]) => Math.min(lesson, Math.max(0, titles.length - 1));

type Props = { titles: string[]; current: number; onSelect: (i: number) => void; suffix: (i: number) => string };

/** Dãy nút chọn bài; `suffix` thêm dấu hiệu bài đã có nội dung (" · 📖", " · 3 câu"). */
export default function LessonChips({ titles, current, onSelect, suffix }: Props) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {titles.map((t, i) => (
        <button key={i} type="button" onClick={() => onSelect(i)}
          className={`chip !py-1 text-xs ${i === current ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-brand-300"}`}>
          {i + 1}. {t.length > 24 ? t.slice(0, 24) + "…" : t}{suffix(i)}
        </button>
      ))}
    </div>
  );
}
