import { readFileSync } from "node:fs";
import { expect, type Page } from "@playwright/test";

export const BE = "http://localhost:8010";
export const FREE_COURSE = "pdf-slide-lap-trinh-c";
export const PAID_COURSE = "trac-nghiem-triet-hoc-mac-lenin";
export const PASSWORD = "MatKhau2024";

export const uniqueEmail = (prefix: string) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e4)}@example.com`;

/** Gọi API backend trực tiếp (chuẩn bị dữ liệu, duyệt đơn như admin...). */
export async function api<T = unknown>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const res = await fetch(`${BE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} → ${res.status} ${await res.text()}`);
  return res.status === 204 ? (undefined as T) : res.json();
}

export async function adminToken(): Promise<string> {
  const r = await api<{ access_token: string }>("/api/auth/login", { method: "POST", body: JSON.stringify({ email: "admin@example.com", password: "admin123" }) });
  return r.access_token;
}

/** Mã OTP 6 số gửi cho email: backend chạy MAIL_PROVIDER=console nên mail được in vào e2e/.backend.log. */
export function otpFor(email: string): string {
  const log = readFileSync("e2e/.backend.log", "utf-8");
  const re = new RegExp(`\\[MAIL console\\] to=${email.replace(/[.+]/g, "\\$&")} subject=(\\d{6}) là mã xác thực`, "g");
  let code: string | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(log)) !== null) code = m[1]; // lấy mã mới nhất (gửi lại OTP tạo mã mới)
  if (!code) throw new Error(`Không thấy OTP cho ${email} trong e2e/.backend.log`);
  return code;
}

/** Đăng ký qua giao diện rồi nhập OTP ở trang xác thực. Kết thúc: đã đăng nhập, email đã xác thực, đang ở `next`. */
export async function registerAndVerify(page: Page, email: string, next = "/") {
  await page.goto(`/register/?next=${encodeURIComponent(next)}`);
  await page.getByPlaceholder("Họ và tên").fill("Học viên E2E");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Mật khẩu (tối thiểu 8 ký tự, có chữ và số)").fill(PASSWORD);
  await page.getByPlaceholder("Nhập lại mật khẩu").fill(PASSWORD);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Đăng ký" }).click();
  await expect(page).toHaveURL(/\/verify/);
  await expect(page.getByLabel("Mã xác thực 6 số")).toBeVisible();
  await expect.poll(() => { try { return otpFor(email); } catch { return null; } }, { timeout: 15_000 }).not.toBeNull();
  await page.getByLabel("Mã xác thực 6 số").fill(otpFor(email));
  // Form tự gửi khi đủ 6 số; bấm "Xác nhận" chỉ khi vẫn còn ở trang xác thực
  await page.getByRole("button", { name: "Xác nhận" }).click({ timeout: 2_000 }).catch(() => {});
  await expect(page).toHaveURL(new RegExp(next.replace(/[/?=&.]/g, "\\$&")));
}

export async function loginUi(page: Page, email: string, password: string, next = "/") {
  await page.goto(`/login/?next=${encodeURIComponent(next)}`);
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Mật khẩu", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
}
