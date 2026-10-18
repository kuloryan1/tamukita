import http from "k6/http";
import { check, sleep } from "k6";
import { getProductionHostnames, normalizeHostname } from "./production-hostnames.js";

const configuredBaseUrl = __ENV.BASE_URL;
const apiPath = __ENV.API_PATH || "/api/health";

if (!configuredBaseUrl) {
  throw new Error("Set BASE_URL to the isolated staging environment or localhost.");
}

let baseUrl;
try {
  baseUrl = new URL(configuredBaseUrl);
} catch {
  throw new Error("BASE_URL must be a valid HTTPS URL, except for localhost testing.");
}
const isLocalHttp = baseUrl.protocol === "http:" && ["localhost", "127.0.0.1"].includes(baseUrl.hostname);
const isRemoteHttps = baseUrl.protocol === "https:";
if ((!isLocalHttp && !isRemoteHttps) || baseUrl.pathname !== "/" || baseUrl.search || baseUrl.hash || baseUrl.username || baseUrl.password) {
  throw new Error("BASE_URL must use HTTPS, except for localhost testing.");
}
if (isRemoteHttps && __ENV.LOAD_TEST_TARGET !== "staging") {
  throw new Error("Set LOAD_TEST_TARGET=staging to confirm that remote load tests target staging, not production.");
}
if (isRemoteHttps && getProductionHostnames(__ENV.PRODUCTION_HOSTNAMES).has(normalizeHostname(baseUrl.hostname))) {
  throw new Error("Refusing to load test a configured production host.");
}
if (!/^\/(?:[A-Za-z0-9_-]+\/?)*$/.test(apiPath) || apiPath.includes("//")) {
  throw new Error("API_PATH must be a same-origin absolute API path such as /api/health.");
}

const targetUrl = `${baseUrl.origin}${apiPath}`;

export const options = {
  scenarios: {
    read_only_api: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 100 },
        { duration: "90s", target: 1000 },
        { duration: "2m", target: 1000 },
        { duration: "30s", target: 0 },
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
  },
};

export default function () {
  const response = http.get(targetUrl, { redirects: 0, tags: { flow: "read-only-api" } });
  check(response, {
    "read-only API returns HTTP 200": (result) => result.status === 200,
  });
  sleep(3);
}
