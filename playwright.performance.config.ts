import { defineConfig } from "@playwright/test";

const configuredBaseUrl = process.env.PERF_BASE_URL;
if (!configuredBaseUrl) {
  throw new Error("Set PERF_BASE_URL to an HTTPS staging URL or localhost before measuring LCP.");
}

const target = new URL(configuredBaseUrl);
if (target.pathname !== "/" || target.search || target.hash || target.username || target.password) {
  throw new Error("PERF_BASE_URL must contain only the origin, without credentials, path, query, or fragment.");
}

const isLocalHttp = target.protocol === "http:" && ["localhost", "127.0.0.1"].includes(target.hostname);
const isRemoteHttps = target.protocol === "https:";
if (!isLocalHttp && !isRemoteHttps) {
  throw new Error("PERF_BASE_URL must use HTTPS, except for localhost testing.");
}
if (isRemoteHttps && process.env.PERF_TEST_TARGET !== "staging") {
  throw new Error("Set PERF_TEST_TARGET=staging to confirm that remote performance tests target staging, not production.");
}
if (isRemoteHttps) {
  const productionHealthUrl = process.env.PRODUCTION_HEALTH_URL;
  if (!productionHealthUrl) {
    throw new Error("Set PRODUCTION_HEALTH_URL so the performance-test target can be checked against production.");
  }
  const productionHealth = new URL(productionHealthUrl);
  if (productionHealth.protocol !== "https:" || productionHealth.pathname !== "/api/health" || productionHealth.search || productionHealth.hash || productionHealth.username || productionHealth.password) {
    throw new Error("PRODUCTION_HEALTH_URL must be an HTTPS /api/health URL without credentials, query, or fragment.");
  }
  if (["tamukita.io", "www.tamukita.io", productionHealth.hostname.toLowerCase()].includes(target.hostname.toLowerCase())) {
    throw new Error("Refusing to measure the configured production host.");
  }
}

export default defineConfig({
  testDir: "./tests/performance",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  timeout: 120_000,
  use: {
    baseURL: target.origin,
    browserName: "chromium",
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
});
