import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const localAppPort = process.env.PLAYWRIGHT_TEST_PORT ?? "23300";
const configuredBaseURL = process.env.PLAYWRIGHT_TEST_BASE_URL?.trim();
const baseURL = configuredBaseURL || `http://127.0.0.1:${localAppPort}`;
const chromiumExecutablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const e2eMediaEnvironment = {
  PAPARAZZI_STORAGE_DRIVER: "server",
  PAPARAZZI_STORAGE_DIR: path.resolve(process.env.PAPARAZZI_STORAGE_DIR || ".local-storage/paparazzi-e2e"),
  E2E_R2_MOCK: "true",
  R2_ACCOUNT_ID: "e2e",
  R2_ACCESS_KEY_ID: "e2e-access-key",
  R2_SECRET_ACCESS_KEY: "e2e-secret-key",
  R2_S3_ENDPOINT: "http://127.0.0.1:3138",
  R2_PRIVATE_BUCKET_NAME: "private",
  R2_PUBLIC_BUCKET_NAME: "public",
  R2_PUBLIC_BASE_URL: "http://127.0.0.1:3138/public",
  RESEND_API_KEY: "",
  EMAIL_FROM: "",
  REDIS_URL: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
  ...(process.env.DATABASE_URL ? { DATABASE_URL: process.env.DATABASE_URL } : {}),
};
const e2eEmailEnvironment = {
  RESEND_API_KEY: "e2e-local-only",
  EMAIL_FROM: "TamuKita E2E <noreply@tamukita.test>",
  E2E_EMAIL_MOCK: "true",
  NEXT_PUBLIC_APP_URL: baseURL,
};
const localWebServers = configuredBaseURL
  ? undefined
  : [
      {
        command: "node scripts/e2e-xendit-mock.mjs",
        url: "http://127.0.0.1:3137/health",
        reuseExistingServer: false,
        timeout: 60_000,
      },
      {
        command: "node scripts/e2e-r2-mock.mjs",
        url: "http://127.0.0.1:3138/health",
        reuseExistingServer: false,
        timeout: 60_000,
      },
      {
        command: "node scripts/e2e-email-mock.mjs",
        url: "http://127.0.0.1:3140/health",
        reuseExistingServer: false,
        timeout: 60_000,
      },
      {
        command: "node scripts/e2e-worker.mjs",
        url: "http://127.0.0.1:3139/health",
        reuseExistingServer: false,
        timeout: 60_000,
        env: {
          ...e2eMediaEnvironment,
          ...e2eEmailEnvironment,
          AUTH_SECRET: process.env.AUTH_SECRET ?? "local-e2e-only-secret",
        },
      },
      {
        command: "node scripts/e2e-server.mjs",
        url: baseURL,
        reuseExistingServer: false,
        timeout: 60_000,
        env: {
          AUTH_SECRET: process.env.AUTH_SECRET ?? "local-e2e-only-secret",
          XENDIT_SECRET_KEY: process.env.XENDIT_SECRET_KEY ?? "ci-only-e2e-secret",
          PAYMENT_MODE: "xendit",
          XENDIT_API_BASE_URL: "http://127.0.0.1:3137",
          E2E_XENDIT_MOCK: "true",
          ...e2eMediaEnvironment,
          RESELLER_BASIC_ACTIVATION_PRICE_IDR: process.env.RESELLER_BASIC_ACTIVATION_PRICE_IDR ?? "20000",
          RESELLER_PREMIUM_ACTIVATION_PRICE_IDR: process.env.RESELLER_PREMIUM_ACTIVATION_PRICE_IDR ?? "50000",
          ...(process.env.DATABASE_URL ? { DATABASE_URL: process.env.DATABASE_URL } : {}),
          ...(process.env.XENDIT_WEBHOOK_TOKEN ? { XENDIT_WEBHOOK_TOKEN: process.env.XENDIT_WEBHOOK_TOKEN } : {}),
          ...(process.env.XENDIT_REFUND_WEBHOOK_TOKEN ? { XENDIT_REFUND_WEBHOOK_TOKEN: process.env.XENDIT_REFUND_WEBHOOK_TOKEN } : {}),
          ...e2eEmailEnvironment,
          HOSTNAME: "127.0.0.1",
          PORT: localAppPort,
        },
      },
    ];

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: chromiumExecutablePath ? { executablePath: chromiumExecutablePath } : undefined,
  },
  projects: [
    { name: "desktop-chromium", use: { browserName: "chromium", viewport: { width: 1280, height: 800 } } },
    { name: "mobile-chromium", use: { browserName: "chromium", viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
    { name: "mobile-webkit", use: { ...devices["iPhone 13"], browserName: "webkit" } },
  ],
  ...(localWebServers ? { webServer: localWebServers } : {}),
});
