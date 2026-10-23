import { expect, test } from "@playwright/test";

test("form liên hệ: có nhãn nhìn thấy, báo lỗi theo từng ô, gửi được", async ({ page }) => {
  await page.goto("/contact/");
  await page.getByRole("button", { name: "Gửi tin nhắn" }).click();
  await expect(page.getByLabel("Họ và tên")).toHaveAttribute("aria-invalid", "true");
  await page.getByLabel("Họ và tên").fill("Khách E2E");
  await page.getByLabel("Email").fill("lienhe-e2e@example.com");
  await page.getByLabel(/Chủ đề/).fill("Hỏi về khóa học");
  await page.getByLabel("Nội dung").fill("Cho mình hỏi khóa học Lập trình C có bài tập kèm lời giải không ạ?");
  await page.getByRole("button", { name: "Gửi tin nhắn" }).click();
  await expect(page.getByRole("status")).toContainText(/đã|cảm ơn/i);
});
