import { expect, test } from "@playwright/test";
import { FREE_COURSE, registerAndVerify, uniqueEmail } from "./helpers";

test("đăng ký → xác thực OTP → ghi danh khóa miễn phí → học và đánh dấu hoàn thành", async ({ page }) => {
  const email = uniqueEmail("hocvien");
  await registerAndVerify(page, email, `/courses/${FREE_COURSE}/`);

  // Trang chi tiết: ghi danh miễn phí
  await page.getByRole("button", { name: /Ghi danh|Bắt đầu học/ }).click();
  const start = page.getByRole("link", { name: /Vào học ngay/ });
  await expect(start).toBeVisible();
  await start.click();

  // Trang học: thấy bài 1, đánh dấu hoàn thành → sang bài 2, tiến độ 1/N
  await expect(page).toHaveURL(new RegExp(`/learn/${FREE_COURSE}`));
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "✓ Hoàn thành bài này" }).click();
  await expect(page).toHaveURL(/lesson=1/);
  // Khối tiến độ có bản desktop (sidebar) và bản mobile (ẩn theo breakpoint) → lấy bản đang hiển thị
  await expect(page.getByText(/Đã học 1\/\d+ bài/).locator("visible=true")).toBeVisible();

  // Ghi chú tự lưu
  await page.getByRole("button", { name: /Ghi chú của tôi/ }).click();
  await page.getByLabel("Nội dung ghi chú").fill("Ghi chú e2e");
  await expect(page.getByText("✓ Đã lưu")).toBeVisible({ timeout: 10_000 });

  // Khóa học của tôi: thẻ khóa với nút học tiếp
  await page.goto("/my-courses/");
  await expect(page.getByRole("link", { name: /Học tiếp bài/ })).toBeVisible();
});
