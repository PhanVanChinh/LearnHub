import { expect, test } from "@playwright/test";
import { loginUi } from "./helpers";

test("admin: thanh tab không làm trang tràn ngang ở 360px, phím mũi tên chuyển tab", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await loginUi(page, "admin@example.com", "admin123", "/admin/");
  await expect(page).toHaveURL(/\/admin/);
  const tabs = page.getByRole("tablist", { name: "Khu quản trị" });
  await expect(tabs).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  const orders = page.getByRole("tab", { name: /Đơn hàng/ });
  await expect(orders).toHaveAttribute("aria-selected", "true");
  await orders.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Doanh thu" })).toBeFocused();
  await expect(page.getByRole("tab", { name: "Doanh thu" })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("End");
  await expect(page.getByRole("tab", { name: "Nhật ký" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel")).toBeVisible();
});
