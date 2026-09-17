"use client";
import { useCallback, useEffect, useState } from "react";
import { ApiError, coursesApi, QuizAttempts, QuizPublic, QuizResult } from "@/lib/api";

type Props = {
  slug: string;
  index: number;
  /** Đăng nhập → có lịch sử làm bài */
  loggedIn: boolean;
  /** Đạt và đã ghi danh → server đánh dấu hoàn thành; gọi để trang học tải lại tiến độ */
  onCompleted?: () => void;
};

/** Làm trắc nghiệm ngay trong bài học: chọn đáp án → nộp → xem điểm, đáp án đúng và giải thích → làm lại. */
export default function QuizPlayer({ slug, index, loggedIn, onCompleted }: Props) {
  const [quiz, setQuiz] = useState<QuizPublic | null>(null);
  const [error, setError] = useState("");
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [attempts, setAttempts] = useState<QuizAttempts | null>(null);
  const [busy, setBusy] = useState(false);

  const loadAttempts = useCallback(() => {
    if (loggedIn) coursesApi.quizAttempts(slug, index).then(setAttempts).catch(() => setAttempts(null));
  }, [slug, index, loggedIn]);

  useEffect(() => {
    let alive = true;
    setQuiz(null); setResult(null); setError(""); setAttempts(null);
    coursesApi.quiz(slug, index)
      .then((q) => { if (!alive) return; setQuiz(q); setAnswers(Array(q.total).fill(null)); })
      .catch((e: ApiError) => alive && setError(e.message));
    loadAttempts();
    return () => { alive = false; };
  }, [slug, index, loadAttempts]);

  const answered = answers.filter((a) => a !== null).length;

  const submit = async () => {
    if (!quiz) return;
    if (answered < quiz.total && !confirm(`Bạn còn ${quiz.total - answered} câu chưa trả lời. Nộp bài luôn?`)) return;
    setBusy(true); setError("");
    try {
      const r = await coursesApi.submitQuiz(slug, index, answers);
      setResult(r);
      loadAttempts();
      if (r.lesson_completed) onCompleted?.();
      document.getElementById("quiz-result")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) { setError((e as ApiError).message); } finally { setBusy(false); }
  };
  const retry = () => { setResult(null); setAnswers(Array(quiz?.total ?? 0).fill(null)); };

  if (error && !quiz) return <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div>;
  if (!quiz) return <div className="h-40 animate-pulse rounded-xl bg-white/10" />;

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-400">Trắc nghiệm</p>
          <h2 className="mt-1 text-lg font-bold text-white">{quiz.total} câu hỏi · đạt từ {quiz.pass_percent}%</h2>
        </div>
        {attempts && attempts.count > 0 && (
          <p className="text-xs text-slate-300">
            Đã làm {attempts.count} lần · tốt nhất <b className={attempts.best!.passed ? "text-emerald-300" : "text-amber-300"}>{attempts.best!.percent}%</b>
          </p>
        )}
      </div>

      {result && (
        <div id="quiz-result" className={`mt-4 rounded-xl border p-4 ${result.passed ? "border-emerald-500/40 bg-emerald-500/10" : "border-amber-500/40 bg-amber-500/10"}`}>
          <p className="text-2xl font-bold text-white">{result.passed ? "🎉 Đạt!" : "Chưa đạt"} <span className="text-lg font-semibold text-slate-200">{result.score}/{result.total} câu · {result.percent}%</span></p>
          <p className="mt-1 text-sm text-slate-300">
            {result.lesson_completed ? "Bài học đã được đánh dấu hoàn thành." : result.passed && !result.saved ? "Đăng nhập và ghi danh để lưu kết quả và tính tiến độ." : result.passed ? "Ghi danh khóa học để kết quả được tính vào tiến độ." : `Cần đạt ${result.pass_percent}% để hoàn thành bài. Xem giải thích bên dưới rồi làm lại.`}
          </p>
          <button onClick={retry} className="btn mt-3 border border-white/15 bg-white/5 text-white hover:bg-white/10">↻ Làm lại</button>
        </div>
      )}

      <ol className="mt-5 space-y-5">
        {quiz.questions.map((q, qi) => {
          const r = result?.results[qi];
          return (
            <li key={qi} className="rounded-xl bg-white/5 p-4">
              <p className="font-medium text-white"><span className="mr-2 text-slate-400">{qi + 1}.</span>{q.q}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {q.options.map((opt, oi) => {
                  const chosen = answers[qi] === oi;
                  let cls = "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10";
                  if (result && r) {
                    if (oi === r.answer) cls = "border-emerald-400/60 bg-emerald-500/20 text-emerald-100";
                    else if (chosen) cls = "border-rose-400/60 bg-rose-500/20 text-rose-100";
                    else cls = "border-white/10 bg-white/5 text-slate-400";
                  } else if (chosen) cls = "border-brand-400 bg-brand-500/30 text-white";
                  return (
                    <button key={oi} type="button" disabled={!!result}
                      onClick={() => setAnswers((a) => a.map((v, i) => (i === qi ? oi : v)))}
                      className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-left text-sm transition disabled:cursor-default ${cls}`}>
                      <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border text-xs ${chosen || (r && oi === r.answer) ? "border-current" : "border-white/30"}`}>
                        {result && r ? (oi === r.answer ? "✓" : chosen ? "✕" : String.fromCharCode(65 + oi)) : String.fromCharCode(65 + oi)}
                      </span>
                      <span>{opt}</span>
                    </button>
                  );
                })}
              </div>
              {result && r && (
                <p className={`mt-3 text-sm ${r.correct ? "text-emerald-300" : "text-amber-200"}`}>
                  {r.correct ? "✓ Chính xác." : r.chosen === null ? "Bạn bỏ trống câu này." : "✕ Chưa đúng."}
                  {r.explain && <span className="text-slate-300"> {r.explain}</span>}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      {!result && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-400">Đã trả lời {answered}/{quiz.total}</p>
          {error && <p className="text-sm text-rose-300">{error}</p>}
          <button onClick={submit} disabled={busy || answered === 0} className="btn-primary disabled:opacity-50">{busy ? "Đang chấm…" : "Nộp bài"}</button>
        </div>
      )}
    </div>
  );
}
