import { ImageResponse } from "next/og";
import { ogFont } from "@/lib/ogFont";
import { site } from "@/lib/site";

export const dynamic = "force-static";
export const alt = `${site.name} — Học tập online cho sinh viên`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Ảnh chia sẻ mặc định (trang chủ, danh sách, chính sách…). Sinh lúc build thành PNG tĩnh. */
export default async function Image() {
  const font = await ogFont();
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72,
        background: "linear-gradient(135deg, #1434e1 0%, #1b45f5 55%, #4f46e5 100%)", color: "#fff", fontFamily: font ? "BeVietnam" : "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 40, fontWeight: 700 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: "#fff", color: "#1b45f5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40 }}>📘</div>
          {site.name}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.1 }}>Học tập online cho sinh viên</div>
          <div style={{ fontSize: 32, opacity: 0.9 }}>Video bài giảng · Trắc nghiệm · Tài liệu · AI Check</div>
        </div>
        <div style={{ fontSize: 26, opacity: 0.8 }}>{`Dành cho sinh viên ${site.university}`}</div>
      </div>
    ),
    { ...size, fonts: font ? [{ name: "BeVietnam", data: font, weight: 700, style: "normal" }] : undefined },
  );
}
