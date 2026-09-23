import { ImageResponse } from "next/og";
import { getCourse, getCourses } from "@/lib/courses.server";
import { ogFont } from "@/lib/ogFont";
import { formatVND, site } from "@/lib/site";

export const dynamic = "force-static";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export async function generateStaticParams() {
  return (await getCourses()).map((c) => ({ slug: c.slug }));
}

// Tailwind gradient class → 2 màu hex cho ảnh (ImageResponse không hiểu class)
const PALETTE: Record<string, [string, string]> = {
  brand: ["#3366ff", "#1434e1"], violet: ["#8b5cf6", "#c026d3"], fuchsia: ["#d946ef", "#c026d3"], sky: ["#0ea5e9", "#4f46e5"], indigo: ["#6366f1", "#7c3aed"],
  emerald: ["#10b981", "#0d9488"], teal: ["#14b8a6", "#0d9488"], amber: ["#f59e0b", "#ea580c"], orange: ["#f97316", "#ea580c"], rose: ["#f43f5e", "#db2777"],
  pink: ["#ec4899", "#db2777"], red: ["#ef4444", "#e11d48"], slate: ["#475569", "#1e293b"], blue: ["#3b82f6", "#2563eb"], cyan: ["#06b6d4", "#0891b2"], lime: ["#84cc16", "#65a30d"],
};
const colors = (cls: string): [string, string] => {
  const m = cls.match(/from-([a-z]+)-\d+.*to-([a-z]+)-\d+/);
  return [PALETTE[m?.[1] ?? "brand"]?.[0] ?? "#3366ff", PALETTE[m?.[2] ?? "brand"]?.[1] ?? "#1434e1"];
};

/** Ảnh chia sẻ riêng từng khóa: emoji, tên, giá, số bài. Sinh lúc build cho mọi slug. */
export default async function Image({ params }: { params: { slug: string } }) {
  const [course, font] = await Promise.all([getCourse(params.slug), ogFont()]);
  const [c1, c2] = colors(course?.color ?? "");
  const title = course?.title ?? site.name;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", padding: 64, background: `linear-gradient(135deg, ${c1}, ${c2})`, color: "#fff", fontFamily: font ? "BeVietnam" : "sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 30, fontWeight: 700, opacity: 0.95 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: "#fff", color: c2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>📘</div>
            {site.name}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ fontSize: title.length > 60 ? 50 : 62, fontWeight: 700, lineHeight: 1.15, maxWidth: 820 }}>{title}</div>
            {course && <div style={{ fontSize: 30, opacity: 0.9 }}>{`${course.lessons.length} bài học · ${formatVND(course.price)}`}</div>}
          </div>
          <div style={{ fontSize: 24, opacity: 0.8 }}>{course?.short?.slice(0, 90)}</div>
        </div>
        <div style={{ width: 240, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 180 }}>{course?.emoji ?? "📘"}</div>
      </div>
    ),
    { ...size, fonts: font ? [{ name: "BeVietnam", data: font, weight: 700, style: "normal" }] : undefined },
  );
}
