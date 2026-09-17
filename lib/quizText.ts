// Định dạng văn bản để admin soạn trắc nghiệm nhanh trong một textarea:
//
//   đạt: 70                      ← (tuỳ chọn) ngưỡng % để hoàn thành bài, mặc định 70
//   1. Câu hỏi thứ nhất?
//   A. Phương án sai
//   B. Phương án đúng *          ← dấu * ở cuối = đáp án đúng (đúng một phương án)
//   C. Phương án sai
//   > Giải thích ngắn (tuỳ chọn)
//
//   2. Câu tiếp theo...
//
// Dòng bắt đầu bằng A./B)/c- ... là phương án; dòng bắt đầu bằng ">" là giải thích; dòng khác mở câu hỏi mới.
import type { Quiz, QuizQuestion } from "./api";

const OPTION_RE = /^([A-Ha-h])[.)\-:]\s*(.*)$/;
const PASS_RE = /^(?:đạt|dat|pass)\s*[:=]\s*(\d{1,3})\s*%?$/i;
const NUMBER_RE = /^\d{1,3}[.)]\s*/;

export function parseQuizText(text: string): Quiz | null {
  const lines = text.split("\n").map((l) => l.trimEnd());
  let pass = 70;
  const questions: QuizQuestion[] = [];
  let cur: QuizQuestion | null = null;
  const flush = () => { if (cur) { questions.push(cur); cur = null; } };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const pm = line.match(PASS_RE);
    if (pm && !cur && questions.length === 0) { pass = Math.min(100, Math.max(0, Number(pm[1]))); continue; }
    const om = cur && line.match(OPTION_RE);
    if (om && cur) {
      let opt = om[2].trim();
      const correct = /\*$/.test(opt);
      if (correct) opt = opt.replace(/\s*\*$/, "");
      if (correct) {
        if (cur.answer >= 0) throw new Error(`Câu ${questions.length + 1} có hơn một đáp án đánh dấu *`);
        cur.answer = cur.options.length;
      }
      cur.options.push(opt);
      continue;
    }
    if (line.startsWith(">")) {
      if (!cur) throw new Error("Dòng giải thích (>) phải nằm sau các phương án của một câu hỏi");
      cur.explain = (cur.explain ? cur.explain + " " : "") + line.slice(1).trim();
      continue;
    }
    flush();
    cur = { q: line.replace(NUMBER_RE, ""), options: [], answer: -1, explain: "" };
  }
  flush();
  if (questions.length === 0) return null;
  questions.forEach((q, i) => {
    if (q.options.length < 2) throw new Error(`Câu ${i + 1} cần ít nhất 2 phương án (A., B., …)`);
    if (q.options.length > 6) throw new Error(`Câu ${i + 1} có quá 6 phương án`);
    if (q.answer < 0) throw new Error(`Câu ${i + 1} chưa đánh dấu đáp án đúng bằng dấu * ở cuối phương án`);
  });
  return { pass_percent: pass, questions };
}

export function quizToText(quiz: Quiz | null | undefined): string {
  if (!quiz || !quiz.questions?.length) return "";
  const out = [`đạt: ${quiz.pass_percent}`];
  quiz.questions.forEach((q, i) => {
    out.push("", `${i + 1}. ${q.q}`);
    q.options.forEach((o, j) => out.push(`${String.fromCharCode(65 + j)}. ${o}${j === q.answer ? " *" : ""}`));
    if (q.explain) out.push(`> ${q.explain}`);
  });
  return out.join("\n");
}
