import { expect, test } from "@playwright/test";
import { PAID_COURSE, registerAndVerify, uniqueEmail } from "./helpers";

test("hộp thoại: focus vào trong, Tab không lọt ra ngoài, Escape đóng và trả focus về nút đã mở", async ({ page }) => {
  await registerAndVerify(page, uniqueEmail("dialog"), `/checkout/?course=${PAID_COURSE}`);
  await page.getByRole("button", { name: /Xác nhận đặt hàng/ }).click();
  const opener = page.getByRole("button", { name: "Hủy đơn" });
  await opener.focus();
  await page.keyboard.press("Enter");

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAccessibleName(/Hủy đơn LH/);
  // focus nằm trong hộp, và Tab nhiều lần vẫn ở trong hộp
  for (let i = 0; i < 6; i++) {
    expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    await page.keyboard.press("Tab");
  }
  await page.keyboard.press("Shift+Tab");
  expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
  await expect(page.getByText("Đang chờ thanh toán")).toBeVisible(); // Escape = không hủy
});
