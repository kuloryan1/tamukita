import { defineConfig } from "@playwright/test";
import { getProductionHostnames, normalizeHostname } from "./tests/load/production-hostnames.js";

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
if (isRemoteHttps && getProductionHostnames(process.env.PRODUCTION_HOSTNAMES).has(normalizeHostname(target.hostname))) {
  throw new Error("Refusing to measure a configured production host.");
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
