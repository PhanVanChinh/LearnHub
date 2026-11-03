import { expect, test } from "@playwright/test";
import { adminToken, api, FREE_COURSE, PAID_COURSE, registerAndVerify, uniqueEmail } from "./helpers";

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
  await page.getByRole("button", { name: "Hoàn thành bài này" }).click();
  await expect(page).toHaveURL(/lesson=1/);
  // Khối tiến độ có bản desktop (sidebar) và bản mobile (ẩn theo breakpoint) → lấy bản đang hiển thị
  await expect(page.getByText(/Đã học 1\/\d+ bài/).locator("visible=true")).toBeVisible();

  // Ghi chú tự lưu
  await page.getByRole("button", { name: /Ghi chú của tôi/ }).click();
  await page.getByLabel("Nội dung ghi chú").fill("Ghi chú e2e");
  await expect(page.getByText("Đã lưu", { exact: true })).toBeVisible({ timeout: 10_000 });

  // Khóa học của tôi: thẻ khóa với nút học tiếp
  await page.goto("/my-courses/");
  await expect(page.getByRole("link", { name: /Học tiếp bài/ })).toBeVisible();
});

test("khóa chưa có bài học → trang học báo rõ, không lỗi", async ({ page }) => {
  const token = await adminToken();
  const slug = `e2e-rong-${Date.now()}`;
  const created = await api<{ id: number }>("/api/admin/courses", {
    method: "POST", body: JSON.stringify({ slug, title: "Khóa rỗng E2E", category: "free", price: 0, lessons: [] }),
  }, token);
  try {
    await page.goto(`/learn/${slug}/`);
    await expect(page.getByRole("heading", { level: 1, name: "Khóa học chưa có bài học" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Trang khóa học" })).toHaveAttribute("href", new RegExp(`/courses/${slug}`));
  } finally {
    await api(`/api/admin/courses/${created.id}`, { method: "DELETE" }, token);
  }
});

test("mũi tên trong trắc nghiệm chọn đáp án, không chuyển bài", async ({ page }) => {
  // Bài 0 của khóa trắc nghiệm là bài xem thử có 5 câu → không cần đăng nhập
  await page.goto(`/learn/${PAID_COURSE}/?lesson=0`);
  const title = await page.getByRole("heading", { level: 1 }).textContent();
  const options = page.getByRole("radiogroup").first().getByRole("radio");
  await expect(options.first()).toBeVisible();
  await options.first().focus();
  await page.keyboard.press("ArrowRight");
  await expect(options.nth(1)).toHaveAttribute("aria-checked", "true");
  // Chuyển bài là router.replace bất đồng bộ → đợi một nhịp rồi mới khẳng định vẫn ở bài cũ
  await page.waitForTimeout(800);
  await expect(page).toHaveURL(/lesson=0/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title!);
  await expect(options.nth(1)).toHaveAttribute("aria-checked", "true");
});
