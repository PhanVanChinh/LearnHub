"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import ReviewForm from "./ReviewForm";
import Stars from "./Stars";
import { Review, reviewsApi } from "@/lib/api";

/** Nhắc đánh giá trong sidebar trang học khi đã học ≥ 50% (đã ghi danh chắc chắn). Đã đánh giá → hiện sao + link sửa. */
export default function ReviewPrompt({ slug, completed }: { slug: string; completed: boolean }) {
  const [mine, setMine] = useState<Review | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    reviewsApi.list(slug, { limit: 1 }).then((d) => setMine(d.mine)).catch(() => setMine(null));
    try { setDismissed(localStorage.getItem(`review-dismissed-${slug}`) === "1"); } catch { /* bỏ qua */ }
  }, [slug]);
  if (mine === undefined) return null;

  if (mine) {
    return (
      <p className="mt-3 flex items-center gap-2 text-xs text-slate-300">
        <Stars value={mine.rating} size="text-sm" /><span>Bạn đã đánh giá ·</span>
        <Link href={`/courses/${slug}#reviews`} className="text-brand-300 hover:underline">sửa</Link>
      </p>
    );
  }
  if (dismissed && !completed) return null;
  if (!open) {
    return (
      <div className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-100">
        <p>{completed ? "🎉 Bạn đã hoàn thành! Khóa học này thế nào?" : "Bạn đã học được nửa khóa. Đánh giá giúp người sau chọn đúng khóa."}</p>
        <div className="mt-2 flex gap-2">
          <button onClick={() => setOpen(true)} className="btn-primary !px-2.5 !py-1 !text-xs">Đánh giá ngay</button>
          {!completed && <button onClick={() => { setDismissed(true); try { localStorage.setItem(`review-dismissed-${slug}`, "1"); } catch { /* bỏ qua */ } }} className="text-amber-200/80 hover:underline">Để sau</button>}
        </div>
      </div>
    );
  }
  return (
    <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3">
      <ReviewForm slug={slug} dark onSaved={(r) => { setMine(r); setOpen(false); }} onCancel={() => setOpen(false)} />
    </div>
  );
}
