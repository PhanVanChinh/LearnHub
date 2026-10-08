import { expect, test } from "@playwright/test";
import { adminToken, api, PAID_COURSE, registerAndVerify, uniqueEmail } from "./helpers";

test("đặt mua khóa trả phí → nhận mã đơn và QR → admin duyệt → trang thanh toán báo đã xác nhận", async ({ page }) => {
  const email = uniqueEmail("buyer");
  await registerAndVerify(page, email, `/checkout/?course=${PAID_COURSE}`);

  await page.getByRole("button", { name: /Xác nhận đặt hàng/ }).click();
  await expect(page.getByRole("heading", { name: "Chuyển khoản để hoàn tất" })).toBeVisible();
  const code = (await page.getByRole("heading", { level: 1 }).textContent())!.match(/LH[A-Z0-9]{6}/)![0];
  await expect(page.getByAltText(`QR chuyển khoản ${code}`)).toBeVisible();
  await expect(page.getByText("Đang chờ thanh toán")).toBeVisible();

  // Admin duyệt đơn qua API (như bấm "Đã nhận tiền" trong trang quản trị)
  const token = await adminToken();
  const list = await api<{ items: { id: number; code: string }[] }>(`/api/admin/orders?q=${code}`, {}, token);
  const order = list.items.find((o) => o.code === code);
  expect(order).toBeTruthy();
  await api(`/api/admin/orders/${order!.id}/confirm`, { method: "POST", body: JSON.stringify({ note: "e2e FT123" }) }, token);

  await page.getByRole("button", { name: "Kiểm tra lại" }).click();
  await expect(page.getByText("Thanh toán đã được xác nhận")).toBeVisible();
  await page.getByRole("link", { name: /Vào học ngay/ }).click();
  await expect(page).toHaveURL(new RegExp(`/learn/${PAID_COURSE}`));
});
