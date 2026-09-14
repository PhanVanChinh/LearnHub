"use client";
import { useCourseStats } from "@/lib/useCourseStats";

const n = (v: number) => v.toLocaleString("vi-VN");

/** Dòng số liệu dưới thẻ khóa học: số bài học (tĩnh, luôn đúng) + lượt xem / học viên thật từ API khi có. */
export default function CourseStatsLine({ slug, lessons, className = "" }: { slug: string; lessons: number; className?: string }) {
  const stats = useCourseStats(slug);
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 ${className}`}>
      <span>📚 {lessons} bài học</span>
      {stats && stats.views > 0 && <span>👁 {n(stats.views)} lượt xem</span>}
      {stats && stats.students > 0 && <span>👥 {n(stats.students)} học viên</span>}
    </div>
  );
}
