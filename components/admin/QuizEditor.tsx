"use client";
import { parseQuizText } from "@/lib/quizText";
import { Field } from "./ui";
import LessonChips, { clampLesson, lessonTitles } from "./LessonChips";

const QUIZ_PLACEHOLDER = `đạt: 70
1. Triết học Mác – Lênin ra đời vào thời gian nào?
A. Đầu thế kỷ XVIII
B. Những năm 40 của thế kỷ XIX *
C. Đầu thế kỷ XX
> Gắn với hoạt động của C. Mác và Ph. Ăngghen từ những năm 1840.

2. Câu tiếp theo...
A. ...
B. ... *`;

/** Soạn trắc nghiệm cho từng bài bằng văn bản (xem định dạng ở lib/quizText.ts). Kiểm tra lỗi ngay khi gõ. */
export default function QuizEditor({ lessonsText, quizText, setQuizText, lesson, setLesson }: {
  lessonsText: string; quizText: Record<number, string>; setQuizText: (v: Record<number, string>) => void;
  lesson: number; setLesson: (i: number) => void;
}) {
  const titles = lessonTitles(lessonsText);
  const idx = clampLesson(lesson, titles);
  const text = quizText[idx] ?? "";
  let status = "";
  let bad = false;
  if (text.trim()) {
    try { const q = parseQuizText(text); status = q ? `✓ ${q.questions.length} câu · đạt ${q.pass_percent}%` : ""; }
    catch (e) { status = (e as Error).message; bad = true; }
  }
  const counts = titles.map((_, i) => { try { return parseQuizText(quizText[i] ?? "")?.questions.length ?? 0; } catch { return 0; } });
  if (titles.length === 0) return null;
  return (
    <Field label="Trắc nghiệm theo bài" hint="Chọn bài rồi soạn câu hỏi. Dấu * ở cuối phương án = đáp án đúng; dòng > là giải thích. Đạt ngưỡng → bài tự đánh dấu hoàn thành.">
      <LessonChips titles={titles} current={idx} onSelect={setLesson} suffix={(i) => (counts[i] ? ` · ${counts[i]} câu` : "")} />
      <textarea className={`input mt-2 font-mono text-xs ${bad ? "!border-rose-400" : ""}`} rows={8} value={text} placeholder={QUIZ_PLACEHOLDER}
        onChange={(e) => setQuizText({ ...quizText, [idx]: e.target.value })} />
      {status && <p className={`mt-1 text-xs ${bad ? "text-rose-600" : "text-emerald-600"}`}>{status}</p>}
    </Field>
  );
}
