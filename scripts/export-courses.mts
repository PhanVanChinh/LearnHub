// Xuất data/courses.ts -> backend/app/seed_data.json
//   node --experimental-strip-types scripts/export-courses.mts
import { courses } from "../data/courses.ts";
import { paidLessonVideos } from "../data/videos.seed.ts";
import { writeFileSync } from "node:fs";
// Gộp video của bài trả phí (không có trong bundle frontend) vào dữ liệu seed
const seed = courses.map((c) => ({
  ...c,
  lessons: c.lessons.map((l, i) => (paidLessonVideos[c.slug]?.[i] ? { ...l, video: paidLessonVideos[c.slug][i] } : l)),
}));
writeFileSync(new URL("../backend/app/seed_data.json", import.meta.url), JSON.stringify(seed, null, 2));
console.log(`Đã xuất ${courses.length} khóa học`);
