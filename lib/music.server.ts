// Danh sách nhạc nền = các file trong public/music/ (đọc lúc build, nên chỉ cần thả file vào là xong, không phải sửa code).
// Không có file nào → trả mảng rỗng → thanh nhạc tự ẩn.
import fs from "node:fs";
import path from "node:path";

const EXT = new Set([".mp3", ".m4a", ".ogg", ".wav", ".webm"]);
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export type Track = { title: string; src: string };

/** "01 - Lofi Chill.mp3" → { title: "Lofi Chill", src: "/music/01%20-%20Lofi%20Chill.mp3" } */
export function getTracks(): Track[] {
  const dir = path.join(process.cwd(), "public", "music");
  let files: string[];
  try {
    files = fs.readdirSync(dir);
  } catch {
    return [];
  }
  return files
    .filter((f) => EXT.has(path.extname(f).toLowerCase()))
    .sort()
    .map((f) => ({
      title: path.basename(f, path.extname(f)).replace(/^\d+[\s._-]+/, "").replace(/[_-]+/g, " ").trim() || f,
      src: `${BASE}/music/${encodeURIComponent(f)}`,
    }));
}
