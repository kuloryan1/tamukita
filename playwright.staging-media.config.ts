import { defineConfig } from "@playwright/test";

const baseURL = process.env.STAGING_BASE_URL?.trim();
if (!baseURL || new URL(baseURL).origin !== "https://staging.tamukita.io") {
  throw new Error("STAGING_BASE_URL must be exactly the HTTPS TamuKita staging origin.");
}

export default defineConfig({
  testDir: "./staging/e2e",
  testMatch: "media-upload.spec.ts",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: "list",
  timeout: 180_000,
  use: {
    baseURL,
    browserName: "chromium",
    trace: "off",
    screenshot: "off",
    video: "off",
  },
});
