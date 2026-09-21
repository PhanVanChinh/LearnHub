"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import ReviewForm from "./ReviewForm";
import Stars from "./Stars";
import { Review, ReviewList, reviewsApi } from "@/lib/api";

const PAGE = 10;
const utc = (iso: string) => new Date(/Z|[+-]\d\d:\d\d$/.test(iso) ? iso : iso + "Z");
const fmt = (iso: string) => utc(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

/** Khối đánh giá trên trang chi tiết: tóm tắt sao + phân bố, form của tôi, danh sách nhận xét có "Xem thêm". */
export default function CourseReviews({ slug }: { slug: string }) {
  const { user, loading } = useAuth();
  const [data, setData] = useState<ReviewList | null | undefined>(undefined);
  const [items, setItems] = useState<Review[]>([]);
  const [editing, setEditing] = useState(false);

  const load = useCallback(() => {
    reviewsApi.list(slug, { limit: PAGE }).then((d) => { setData(d); setItems(d.items); }).catch(() => setData(null));
  }, [slug]);
  useEffect(() => { if (!loading) load(); }, [load, loading, user]);

  const more = async () => {
    const d = await reviewsApi.list(slug, { limit: PAGE, offset: items.length });
    setItems((x) => [...x, ...d.items]);
  };

  if (data === undefined) return <div className="mt-4 h-32 animate-pulse rounded-2xl bg-slate-100" />;
  if (data === null) return <p className="mt-4 text-sm text-slate-500">Không tải được đánh giá (backend chưa chạy).</p>;
  const { summary, mine, can_review } = data;
  const max = Math.max(1, ...Object.values(summary.distribution));

  return (
    <div className="mt-4 space-y-5">
      <div className="grid gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-card sm:grid-cols-[10rem_1fr]">
        <div className="text-center sm:text-left">
          {summary.average != null ? (
            <>
              <p className="text-5xl font-extrabold text-slate-900">{summary.average.toFixed(1)}</p>
              <Stars value={summary.average} />
              <p className="mt-1 text-sm text-slate-500">{summary.count} đánh giá</p>
            </>
          ) : (
            <>
              <p className="text-3xl font-bold text-slate-400">—</p>
              <p className="mt-1 text-sm text-slate-500">{summary.count ? `${summary.count} đánh giá · cần từ 3 để hiện điểm` : "Chưa có đánh giá"}</p>
            </>
          )}
        </div>
        <ul className="space-y-1.5">
          {[5, 4, 3, 2, 1].map((s) => {
            const n = summary.distribution[String(s)] ?? 0;
            return (
              <li key={s} className="flex items-center gap-2 text-sm">
                <span className="w-8 text-slate-600">{s} ★</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-amber-400" style={{ width: `${(n / max) * 100}%` }} /></div>
                <span className="w-6 text-right text-xs text-slate-500">{n}</span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Đánh giá của tôi */}
      {!loading && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
          {!user ? (
            <p className="text-sm text-slate-600">Đã học khóa này? <Link href={`/login?next=/courses/${slug}`} className="font-semibold text-brand-700 hover:underline">Đăng nhập</Link> để đánh giá.</p>
          ) : !can_review && !mine ? (
            <p className="text-sm text-slate-600">Ghi danh và học thử vài bài rồi quay lại đánh giá nhé.</p>
          ) : mine && !editing ? (
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">Đánh giá của bạn</p>
                <Stars value={mine.rating} />
                {mine.comment && <p className="mt-1 text-sm text-slate-700">{mine.comment}</p>}
                <p className="mt-1 text-xs text-slate-400">{fmt(mine.updated_at)}</p>
              </div>
              <button onClick={() => setEditing(true)} className="btn-outline !px-3 !py-1.5">Sửa</button>
            </div>
          ) : (
            <>
              <p className="mb-3 text-sm font-semibold text-slate-800">{mine ? "Sửa đánh giá" : "Đánh giá khóa học này"}</p>
              <ReviewForm slug={slug} initial={mine} onSaved={() => { setEditing(false); load(); }} onDeleted={() => { setEditing(false); load(); }}
                onCancel={mine ? () => setEditing(false) : undefined} />
            </>
          )}
        </div>
      )}

      {items.length > 0 && (
        <ul className="space-y-3">
          {items.map((r) => (
            <li key={r.id} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">{r.user_initial}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{r.user_name}{r.mine && <span className="ml-2 rounded-full bg-slate-100 px-1.5 text-xs font-normal text-slate-500">bạn</span>}</p>
                  <div className="flex items-center gap-2 text-xs text-slate-400"><Stars value={r.rating} size="text-sm" /><span>{fmt(r.created_at)}</span></div>
                </div>
              </div>
              {r.comment && <p className="mt-3 text-sm leading-6 text-slate-700">{r.comment}</p>}
            </li>
          ))}
        </ul>
      )}
      {items.length < data.total && <button onClick={more} className="btn-outline w-full">Xem thêm ({data.total - items.length})</button>}
    </div>
  );
}
