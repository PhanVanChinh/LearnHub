"use client";
import { FormEvent, useState } from "react";
import { ApiError, Review, reviewsApi } from "@/lib/api";
import Stars from "./Stars";

const LABELS = ["", "Rất tệ", "Chưa tốt", "Bình thường", "Hay", "Rất hay"];

/** Form đánh giá (tạo / sửa / xoá). `dark` cho trang học. */
export default function ReviewForm({ slug, initial, onSaved, onDeleted, onCancel, dark = false }: {
  slug: string; initial?: Review | null; onSaved: (r: Review) => void; onDeleted?: () => void; onCancel?: () => void; dark?: boolean;
}) {
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!rating) return setError("Hãy chọn số sao");
    setBusy(true); setError("");
    try { onSaved(await reviewsApi.upsert(slug, rating, comment)); }
    catch (err) { setError((err as ApiError).message); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!confirm("Xoá đánh giá của bạn?")) return;
    setBusy(true);
    try { await reviewsApi.remove(slug); onDeleted?.(); } catch (err) { setError((err as ApiError).message); } finally { setBusy(false); }
  };

  const text = dark ? "text-slate-200" : "text-slate-800";
  const sub = dark ? "text-slate-400" : "text-slate-500";
  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Stars value={rating} onChange={(v) => { setRating(v); setError(""); }} size="text-3xl" label="Chọn số sao" />
        <span className={`text-sm ${rating ? text : sub}`}>{rating ? LABELS[rating] : "Chọn số sao"}</span>
      </div>
      <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} maxLength={2000}
        placeholder="Bạn thích điều gì? Điều gì nên cải thiện? (không bắt buộc)" aria-label="Nhận xét"
        className={`input resize-y ${dark ? "!border-white/15 !bg-white/5 !text-white placeholder:!text-slate-500" : ""}`} />
      {error && <p className="text-sm text-rose-500">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={busy} className="btn-primary disabled:opacity-60">{busy ? "Đang lưu…" : initial ? "Lưu thay đổi" : "Gửi đánh giá"}</button>
        {onCancel && <button type="button" onClick={onCancel} className={`btn ${dark ? "border border-white/15 text-white hover:bg-white/10" : "btn-outline"}`}>Huỷ</button>}
        {initial && onDeleted && <button type="button" onClick={remove} disabled={busy} className="ml-auto text-sm text-rose-500 hover:underline">Xoá đánh giá</button>}
      </div>
    </form>
  );
}
