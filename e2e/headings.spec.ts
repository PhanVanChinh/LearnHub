import { expect, test } from "@playwright/test";

/** Thứ tự heading không nhảy cấp (h1 → h3 bỏ h2...) để trình đọc màn hình duyệt theo đề mục đúng. */
async function levels(page: import("@playwright/test").Page) {
  return page.evaluate(() => Array.from(document.querySelectorAll("main h1, main h2, main h3, main h4, footer h2, footer h3"))
    .map((h) => Number(h.tagName[1])));
}

for (const path of ["/", "/ai-check/", "/courses/", "/free/", "/phenikaa/", "/contact/", "/courses/pdf-slide-lap-trinh-c/"]) {
  test(`heading đúng thứ tự: ${path}`, async ({ page }) => {
    await page.goto(path);
    const ls = await levels(page);
    expect(ls[0]).toBe(1);
    expect(ls.filter((l) => l === 1)).toHaveLength(1);
    for (let i = 1; i < ls.length; i++) expect(ls[i] - ls[i - 1], `heading thứ ${i + 1}: h${ls[i - 1]} → h${ls[i]}`).toBeLessThanOrEqual(1);
  });
}
