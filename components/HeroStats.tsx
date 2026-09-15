"use client";
import { useEffect, useState } from "react";
import { PublicStats, statsApi } from "@/lib/api";

const n = (v: number) => v.toLocaleString("vi-VN");

type Props = { courses: number; lessons: number; free: number };

/** 3 ô số liệu trên hero. Không dùng con số cố định: số lúc build từ trang cha (props), hoặc thật từ /api/stats. */
export default function HeroStats(STATIC: Props) {
  const [stats, setStats] = useState<PublicStats | null | undefined>(undefined);
  useEffect(() => {
    statsApi.summary().then(setStats).catch(() => setStats(null));
  }, []);

  const tiles: { v: string; l: string }[] = [
    { v: n(stats?.courses || STATIC.courses), l: "Khóa học & tài liệu" },
    { v: n(stats?.lessons || STATIC.lessons), l: stats && stats.videos > 0 ? `Bài học · ${n(stats.videos)} video` : "Bài học" },
    // Chưa có học viên (site mới) hoặc backend chưa chạy → hiện số khóa miễn phí thay vì con số 0 kém thuyết phục
    stats && stats.students > 0
      ? { v: n(stats.students), l: "Học viên đã ghi danh" }
      : { v: n(STATIC.free), l: "Khóa học miễn phí" },
  ];

  return (
    <dl className="mt-10 grid grid-cols-3 gap-6 border-t border-white/20 pt-8">
      {tiles.map((s) => (
        <div key={s.l}>
          <dt className={`text-2xl font-bold sm:text-3xl ${stats === undefined ? "opacity-80" : ""}`}>{s.v}</dt>
          <dd className="mt-1 text-sm text-white/75">{s.l}</dd>
        </div>
      ))}
    </dl>
  );
}
