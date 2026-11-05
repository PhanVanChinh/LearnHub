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

// Bản tĩnh (props từ server) có thể cũ hơn DB khi admin đổi giá mà chưa Xuất bản. next dev render lại mỗi request nên không tạo
// được bản tĩnh cũ; thay vào đó chặn GET /api/courses/{slug} trong trình duyệt và trả giá khác để chắc trang hiện giá API, không phải giá tĩnh.
test("giá trên trang thanh toán lấy từ API (bản mới nhất), không phải bản tĩnh lúc build", async ({ page }) => {
  let newPrice = 0;
  await page.route((u) => u.pathname === `/api/courses/${PAID_COURSE}`, async (route) => {
    const res = await route.fetch();
    const body = await res.json();
    newPrice = body.price + 10_000;
    await route.fulfill({ response: res, json: { ...body, price: newPrice } });
  });
  await registerAndVerify(page, uniqueEmail("price"), `/checkout/?course=${PAID_COURSE}`);
  await expect.poll(() => newPrice).toBeGreaterThan(0);
  const label = `${newPrice.toLocaleString("vi-VN")}đ`;
  await expect(page.getByRole("button", { name: /Xác nhận đặt hàng/ })).toContainText(label);
  await expect(page.getByText("Tổng").locator("..")).toContainText(label);
});
