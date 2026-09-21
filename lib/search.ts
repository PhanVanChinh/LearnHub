// Tìm kiếm phía client trên toàn bộ dữ liệu khóa học đã có trong trang (22 khóa, vài trăm bài): không cần backend.
// Khớp không phân biệt dấu / hoa thường: "may tinh" tìm được "Máy tính".
import type { Course } from "@/data/courses";

export const fold = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

export type Match =
  | { where: "title" | "short" | "description" }
  | { where: "lesson"; index: number; title: string }
  | { where: "attachment"; index: number; lessonTitle: string; name: string };

export type SearchHit = { course: Course; match: Match; score: number };

/** Trả các khóa khớp `query`, kèm vị trí khớp tốt nhất để hiển thị "khớp ở bài 3: …". Không query → tất cả, không match. */
export function searchCourses(courses: Course[], query: string): SearchHit[] {
  const kw = fold(query.trim());
  if (!kw) return courses.map((course) => ({ course, match: { where: "title" }, score: 0 }));
  const terms = kw.split(/\s+/).filter(Boolean);
  const has = (text: string) => { const t = fold(text); return terms.every((w) => t.includes(w)); };

  const hits: SearchHit[] = [];
  for (const course of courses) {
    if (has(course.title)) { hits.push({ course, match: { where: "title" }, score: 3 }); continue; }
    if (has(course.short)) { hits.push({ course, match: { where: "short" }, score: 2 }); continue; }
    const li = course.lessons.findIndex((l) => has(l.title));
    if (li >= 0) { hits.push({ course, match: { where: "lesson", index: li, title: course.lessons[li].title }, score: 2 }); continue; }
    let found: SearchHit | null = null;
    course.lessons.some((l, i) => {
      const a = l.attachments?.find((x) => has(x.name));
      if (a) { found = { course, match: { where: "attachment", index: i, lessonTitle: l.title, name: a.name }, score: 1 }; return true; }
      return false;
    });
    if (found) { hits.push(found); continue; }
    if (has(course.description)) hits.push({ course, match: { where: "description" }, score: 1 });
  }
  return hits.sort((a, b) => b.score - a.score);
}

/** Tô đậm phần khớp (không phân biệt dấu) — trả mảng đoạn để render. */
export function highlight(text: string, query: string): { text: string; hit: boolean }[] {
  const terms = fold(query.trim()).split(/\s+/).filter(Boolean);
  if (!terms.length) return [{ text, hit: false }];
  const folded = fold(text);
  if (folded.length !== text.length) return [{ text, hit: false }]; // NFD làm lệch chỉ số với ký tự lạ → bỏ tô
  const marks = new Array<boolean>(text.length).fill(false);
  for (const w of terms) { let i = folded.indexOf(w); while (i >= 0) { for (let k = i; k < i + w.length; k++) marks[k] = true; i = folded.indexOf(w, i + 1); } }
  const out: { text: string; hit: boolean }[] = [];
  for (let i = 0; i < text.length; i++) {
    const last = out[out.length - 1];
    if (last && last.hit === marks[i]) last.text += text[i]; else out.push({ text: text[i], hit: marks[i] });
  }
  return out;
}
