"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Stars from "@/components/Stars";
import { AdminCourse, AdminReview, adminApi } from "@/lib/api";
import { ErrorBox, Pager } from "./ui";

const LIMIT = 20;
const utc = (iso: string) => new Date(/Z|[+-]\d\d:\d\d$/.test(iso) ? iso : iso + "Z");
const fmt = (iso: string) => utc(iso).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** Kiểm duyệt đánh giá: xem, lọc, ẩn/hiện kèm lý do. Không sửa nội dung của người dùng. */
export default function ReviewsPanel() {
  const [hidden, setHidden] = useState<boolean | "">("");
  const [rating, setRating] = useState<number | "">("");
  const [courseId, setCourseId] = useState<number | "">("");
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<{ total: number; items: AdminReview[] } | null>(null);
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(() => {
    adminApi.reviews({ hidden, rating, course_id: courseId, q: q.trim() || undefined, limit: LIMIT, offset }).then(setData).catch((e) => setError(e.message));
  }, [hidden, rating, courseId, q, offset]);
  useEffect(load, [load]);
  useEffect(() => { adminApi.courses({ limit: 200 }).then((r) => setCourses(r.items)).catch(() => {}); }, []);

  const toggle = async (r: AdminReview) => {
    let reason: string | null = "";
    if (!r.hidden) {
      reason = prompt(`Ẩn đánh giá ${r.rating}★ của ${r.user_email}?\nLý do (tuỳ chọn, người dùng KHÔNG thấy):`, "");
      if (reason === null) return;
    }
    setBusyId(r.id); setError("");
    try { await adminApi.toggleReviewHidden(r.id, reason || undefined); load(); }
    catch (e) { setError((e as Error).message); } finally { setBusyId(null); }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {([["", "Tất cả"], [false, "Đang hiện"], [true, "Đã ẩn"]] as const).map(([k, l]) => (
          <button key={String(k)} onClick={() => { setHidden(k); setOffset(0); }}
            className={`chip ${hidden === k ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-brand-300"}`}>{l}</button>
        ))}
        <select className="input w-auto" value={rating} onChange={(e) => { setRating(e.target.value ? Number(e.target.value) : ""); setOffset(0); }}>
          <option value="">Mọi số sao</option>{[5, 4, 3, 2, 1].map((s) => <option key={s} value={s}>{s} ★</option>)}
        </select>
        <select className="input w-auto max-w-[16rem]" value={courseId} onChange={(e) => { setCourseId(e.target.value ? Number(e.target.value) : ""); setOffset(0); }}>
          <option value="">Mọi khóa học</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.title}</option>)}
        </select>
        <input value={q} onChange={(e) => { setQ(e.target.value); setOffset(0); }} placeholder="Tìm nhận xét / email…" className="input ml-auto sm:w-56" />
      </div>
      <p className="mt-3 text-xs text-slate-500">Ẩn đánh giá vi phạm (spam, xúc phạm, không liên quan). Đánh giá ẩn không tính vào điểm và không hiện công khai; người viết vẫn thấy của mình. Không sửa được nội dung.</p>
      <div className="mt-3"><ErrorBox message={error} /></div>

      <ul className="mt-4 space-y-2">
        {!data && <li className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">Đang tải…</li>}
        {data?.items.length === 0 && <li className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Không có đánh giá nào.</li>}
        {data?.items.map((r) => (
          <li key={r.id} className={`rounded-xl border bg-white p-4 ${r.hidden ? "border-rose-200 bg-rose-50/40" : "border-slate-200"}`}>
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  <Stars value={r.rating} size="text-base" />
                  <span className="font-semibold text-slate-900">{r.user_name}</span>
                  <span className="text-slate-500">{r.user_email}</span>
                  <span className="text-slate-400">·</span>
                  <Link href={`/courses/${r.course_slug}#reviews`} target="_blank" className="truncate text-brand-700 hover:underline">{r.course_title}</Link>
                  {r.hidden && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">Đã ẩn{r.hidden_reason ? `: ${r.hidden_reason}` : ""}</span>}
                </div>
                <p className={`mt-1.5 text-sm leading-6 ${r.comment ? "text-slate-700" : "italic text-slate-400"}`}>{r.comment || "(không có nhận xét)"}</p>
                <p className="mt-1 text-xs text-slate-400">Gửi {fmt(r.created_at)}{r.updated_at !== r.created_at && <> · sửa {fmt(r.updated_at)}</>}</p>
              </div>
              <button onClick={() => toggle(r)} disabled={busyId === r.id}
                className={`btn-outline shrink-0 !px-3 !py-1.5 disabled:opacity-60 ${r.hidden ? "!border-emerald-300 !text-emerald-700" : "!text-rose-600 hover:!border-rose-300"}`}>
                {r.hidden ? "Hiện lại" : "Ẩn"}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {data && <Pager total={data.total} limit={LIMIT} offset={offset} onChange={setOffset} />}
    </div>
  );
}
