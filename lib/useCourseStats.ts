"use client";
import { useEffect, useState } from "react";
import { CourseStats, statsApi } from "./api";

// Tải một lần cho cả trang rồi chia sẻ cho mọi thẻ khóa học. Lỗi (backend chưa chạy) → null, thẻ chỉ hiện số bài học.
let cache: Promise<Map<string, CourseStats> | null> | null = null;
export function loadCourseStats() {
  cache ??= statsApi.courses()
    .then((rows) => new Map(rows.map((r) => [r.slug, r])))
    .catch(() => { cache = null; return null; });
  return cache;
}

/** Lượt xem / số học viên thật của một khóa; undefined khi đang tải, null khi không lấy được. */
export function useCourseStats(slug: string): CourseStats | null | undefined {
  const [stats, setStats] = useState<CourseStats | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    loadCourseStats().then((m) => alive && setStats(m ? m.get(slug) ?? null : null));
    return () => { alive = false; };
  }, [slug]);
  return stats;
}
