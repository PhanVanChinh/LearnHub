"use client";
import { useState } from "react";
import LessonContent from "@/components/LessonContent";
import { Field } from "./ui";
import LessonChips, { clampLesson, lessonTitles } from "./LessonChips";

const CONTENT_PLACEHOLDER = `## Mục tiêu bài học
- Hiểu khái niệm con trỏ
- Viết được hàm hoán đổi hai số

Đoạn văn bình thường, **in đậm**, *in nghiêng*, [link](https://example.com).

\`\`\`c
void swap(int *a, int *b) { int t = *a; *a = *b; *b = t; }
\`\`\`

| Toán tử | Ý nghĩa |
|---|---|
| & | lấy địa chỉ |
| * | trỏ tới |`;

/** Soạn nội dung bài đọc (Markdown) cho từng bài, xem trước đúng như trang học. Cùng ô chọn bài với trắc nghiệm / tài liệu. */
export default function ContentEditor({ lessonsText, content, setContent, lesson, setLesson }: {
  lessonsText: string; content: Record<number, string>; setContent: (v: Record<number, string>) => void;
  lesson: number; setLesson: (i: number) => void;
}) {
  const [preview, setPreview] = useState(false);
  const titles = lessonTitles(lessonsText);
  const idx = clampLesson(lesson, titles);
  const text = content[idx] ?? "";
  if (titles.length === 0) return null;
  return (
    <Field label="Nội dung bài đọc (Markdown)" hint="Chọn bài rồi soạn. Hỗ trợ tiêu đề #, danh sách, **đậm**, bảng, code ```. Bài khóa: người chưa ghi danh không thấy nội dung, chỉ thấy có bài đọc.">
      <LessonChips titles={titles} current={idx} onSelect={setLesson} suffix={(i) => ((content[i] ?? "").trim() ? " · 📖" : "")} />
      <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
        <span>{text.length.toLocaleString("vi-VN")} / 50.000 ký tự</span>
        <button type="button" onClick={() => setPreview(!preview)} className="font-medium text-brand-700 hover:underline">{preview ? "Soạn thảo" : "Xem trước"}</button>
      </div>
      {preview ? (
        <div className="mt-1 rounded-xl bg-slate-950 p-3">
          {text.trim() ? <LessonContent markdown={text} /> : <p className="p-4 text-sm text-slate-400">Chưa có nội dung.</p>}
        </div>
      ) : (
        <textarea className="input mt-1 font-mono text-xs" rows={10} value={text} placeholder={CONTENT_PLACEHOLDER} maxLength={50_000}
          onChange={(e) => setContent({ ...content, [idx]: e.target.value })} />
      )}
    </Field>
  );
}
