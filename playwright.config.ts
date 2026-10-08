import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

/* E2E: Playwright tự bật backend (SQLite riêng, mail in ra log) và frontend dev server trên cổng riêng,
   không đụng tới server dev đang chạy của bạn (3000 / 8000) hay thư mục .next.
   Chạy: npm run test:e2e   (lần đầu: npx playwright install chromium) */
const FE = 3010;
const BE = 8010;
const PY = process.env.E2E_PYTHON ?? (existsSync("backend/.venv/bin/python") ? ".venv/bin/python" : "python");

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  workers: 1, // dùng chung một DB → chạy tuần tự
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL: `http://localhost:${FE}`, locale: "vi-VN", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: `cd backend && rm -f e2e.db && ${PY} -m uvicorn app.main:app --port ${BE} > ../e2e/.backend.log 2>&1`,
      url: `http://localhost:${BE}/api/health`,
      reuseExistingServer: false,
      timeout: 90_000,
      env: {
        APP_ENV: "development", DATABASE_URL: "sqlite:///./e2e.db", SECRET_KEY: "e2e-secret-key-not-for-production-0123456789",
        MAIL_PROVIDER: "console", RESEND_API_KEY: "", RATE_LIMIT_ENABLED: "false", TURNSTILE_SECRET_KEY: "", GOOGLE_CLIENT_ID: "",
        ADMIN_EMAIL: "admin@example.com", ADMIN_PASSWORD: "admin123", REFRESH_TOKEN_IN_BODY: "true",
        CORS_ORIGINS: `http://localhost:${FE}`, FRONTEND_URL: `http://localhost:${FE}`,
        BANK_BIN: "970436", BANK_ACCOUNT_NUMBER: "0123456789", BANK_ACCOUNT_NAME: "LEARNHUB", BANK_NAME: "Vietcombank",
        LOG_FORMAT: "text",
      },
    },
    {
      command: `npx next dev -p ${FE}`,
      url: `http://localhost:${FE}/`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: { NEXT_PUBLIC_API_URL: `http://localhost:${BE}`, NEXT_DIST_DIR: ".next-e2e", NEXT_PUBLIC_BASE_PATH: "" },
    },
  ],
});
