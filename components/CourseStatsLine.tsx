"use client";
import { useCourseStats } from "@/lib/useCourseStats";
import Emoji from "@/components/Emoji";

const n = (v: number) => v.toLocaleString("vi-VN");
// Ngưỡng hiển thị: "4 lượt xem" hay "1 học viên" làm khóa học trông vắng hơn là không hiện gì
const MIN_VIEWS = 50;
const MIN_STUDENTS = 5;

/** Dòng số liệu dưới thẻ khóa học: số bài học (tĩnh, luôn đúng) + lượt xem / học viên thật từ API khi có. */
export default function CourseStatsLine({ slug, lessons, className = "" }: { slug: string; lessons: number; className?: string }) {
  const stats = useCourseStats(slug);
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 ${className}`}>
      <span><Emoji>📚</Emoji> {lessons} bài học</span>
      {stats && stats.views >= MIN_VIEWS && <span><Emoji>👁</Emoji> {n(stats.views)} lượt xem</span>}
      {stats && stats.students >= MIN_STUDENTS && <span><Emoji>👥</Emoji> {n(stats.students)} học viên</span>}
      {stats?.rating.average != null && <span title={`${stats.rating.count} đánh giá`}><Emoji>⭐</Emoji> {stats.rating.average.toFixed(1)}<span className="sr-only"> sao,</span> ({n(stats.rating.count)}<span className="sr-only"> đánh giá</span>)</span>}
    </div>
  );
}
