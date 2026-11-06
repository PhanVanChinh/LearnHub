import { expect, test } from "@playwright/test";
import { FREE_COURSE, PAID_COURSE } from "./helpers";

type JsonLd = {
  "@type": string; name: string; isAccessibleForFree: boolean;
  offers: { category: string; price: number; availability: string }; hasCourseInstance: { courseMode: string; courseWorkload?: string };
};
const readJsonLd = async (page: import("@playwright/test").Page, slug: string): Promise<JsonLd> => {
  await page.goto(`/courses/${slug}/`);
  const raw = await page.locator('script[type="application/ld+json"]').first().textContent();
  return JSON.parse(raw!) as JsonLd;
};

test("JSON-LD khóa học: tổng thời lượng thật, offers Free/Paid, courseMode Online", async ({ page }) => {
  const free = await readJsonLd(page, FREE_COURSE);
  expect(free["@type"]).toBe("Course");
  expect(free.isAccessibleForFree).toBe(true);
  expect(free.offers).toMatchObject({ category: "Free", price: 0, availability: "https://schema.org/InStock" });
  expect(free.hasCourseInstance.courseMode).toBe("Online");
  // Bài 05:20 + 18:45 + ... → PT…M theo phút thật, không phải "PT<số bài>H" như trước
  expect(free.hasCourseInstance.courseWorkload).toMatch(/^PT(\d+H)?(\d+M)?$/);
  expect(free.hasCourseInstance.courseWorkload).not.toBe("PT5H");

  const paid = await readJsonLd(page, PAID_COURSE);
  expect(paid.isAccessibleForFree).toBe(false);
  expect(paid.offers.category).toBe("Paid");
  expect(paid.offers.price).toBeGreaterThan(0);
});
