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

test("admin: tab nằm trên URL, tải lại vẫn mở đúng tab", async ({ page }) => {
  await loginUi(page, "admin@example.com", "admin123", "/admin/");
  await expect(page).toHaveURL(/\/admin/);
  await page.getByRole("tab", { name: "Doanh thu" }).click();
  await expect(page).toHaveURL(/\?tab=revenue/);
  await page.reload();
  await expect(page.getByRole("tab", { name: "Doanh thu" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: /Đơn hàng/ }).click();
  await expect(page).not.toHaveURL(/tab=/);
});

test("admin: gõ tìm kiếm nhanh, phản hồi cũ về muộn không đè lên kết quả mới", async ({ page }) => {
  // lần tải đầu (không có q) bị giữ 1,5 giây; tìm kiếm có q trả về ngay
  await page.route((u) => u.pathname.endsWith("/api/admin/users") && !u.searchParams.get("q"), async (route) => {
    await new Promise((r) => setTimeout(r, 1500));
    await route.continue();
  });
  await loginUi(page, "admin@example.com", "admin123", "/admin/?tab=users");
  await expect(page.getByRole("tab", { name: "Người dùng" })).toHaveAttribute("aria-selected", "true");
  await page.getByPlaceholder("Tìm email / họ tên…").fill("khong-co-ai-ten-nay");
  await expect(page.getByText("Không có người dùng nào.")).toBeVisible();
  await page.waitForTimeout(2000); // chờ phản hồi cũ về
  await expect(page.getByText("Không có người dùng nào.")).toBeVisible();
  await expect(page.getByRole("table").getByText("admin@example.com")).toHaveCount(0);
});

test("admin: bảng người dùng có caption, mọi cột có scope và cột thao tác có tên cho trình đọc màn hình", async ({ page }) => {
  await loginUi(page, "admin@example.com", "admin123", "/admin/?tab=users");
  const table = page.getByRole("table", { name: "Danh sách người dùng" });
  await expect(table).toBeVisible();
  const headers = table.locator("thead th");
  expect(await headers.count()).toBeGreaterThan(0);
  for (const th of await headers.all()) {
    await expect(th).toHaveAttribute("scope", "col");
    expect((await th.textContent())?.trim()).not.toBe("");
  }
  await expect(table.getByRole("columnheader", { name: "Thao tác" })).toBeAttached();
});
