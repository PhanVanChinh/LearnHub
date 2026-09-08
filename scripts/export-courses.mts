// Xuất data/courses.ts -> backend/app/seed_data.json
//   node --experimental-strip-types scripts/export-courses.mts
import { courses } from "../data/courses.ts";
import { writeFileSync } from "node:fs";
writeFileSync(new URL("../backend/app/seed_data.json", import.meta.url), JSON.stringify(courses, null, 2));
console.log(`Đã xuất ${courses.length} khóa học`);
