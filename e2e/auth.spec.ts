import { expect, test } from "@playwright/test";
import { loginUi } from "./helpers";

test.describe("Đăng nhập", () => {
  test("sai mật khẩu → báo lỗi, không chuyển trang", async ({ page }) => {
    await loginUi(page, "admin@example.com", "sai-mat-khau");
    // Next còn có route announcer role=alert trống → chỉ lấy thông báo lỗi của form
    await expect(page.locator('p[role="alert"]')).toContainText(/không đúng|sai/i);
    await expect(page).toHaveURL(/\/login/);
  });

  test("đúng tài khoản → về trang chủ, menu hiện tên, đăng xuất được", async ({ page }) => {
    await loginUi(page, "admin@example.com", "admin123");
    await expect(page).toHaveURL(/\/$/);
    const menu = page.getByRole("button", { name: /Admin/ });
    await expect(menu).toBeVisible();
    await menu.click();
    await expect(page.getByRole("menu")).toContainText("Khóa học của tôi");
    await page.getByRole("button", { name: "Đăng xuất" }).click();
    await expect(page.getByRole("link", { name: "Đăng nhập" }).first()).toBeVisible();
  });
});

test("menu tài khoản: bấm ra ngoài thì đóng, Escape đóng và trả focus về nút", async ({ page }) => {
  await loginUi(page, "admin@example.com", "admin123");
  const button = page.getByRole("button", { name: /Tài khoản Admin/ });
  await button.click();
  await expect(page.getByRole("menu")).toBeVisible();
  await page.locator("main").click({ position: { x: 5, y: 5 } });
  await expect(page.getByRole("menu")).toBeHidden();

  await button.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menu")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toBeHidden();
  await expect(button).toBeFocused();
});
