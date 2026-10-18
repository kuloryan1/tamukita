import http from "k6/http";
import { check, sleep } from "k6";
import { getProductionHostnames, normalizeHostname } from "./production-hostnames.js";

const configuredBaseUrl = __ENV.BASE_URL;
const invitationPath = __ENV.INVITATION_PATH;

if (!configuredBaseUrl || !invitationPath) {
  throw new Error("Set BASE_URL and INVITATION_PATH to a published invitation on the staging environment.");
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
if (!/^\/[A-Za-z0-9][A-Za-z0-9_-]*(?:\/[A-Za-z0-9][A-Za-z0-9_-]*)*$/.test(invitationPath)) {
  throw new Error("INVITATION_PATH must be a same-origin absolute path such as /ryan-ira.");
}

const targetUrl = `${baseUrl.origin}${invitationPath}`;

export function setup() {
  const response = http.get(targetUrl, { redirects: 0, tags: { flow: "published-invitation-preflight" } });
  if (response.status !== 200) {
    throw new Error(`Published invitation preflight must return HTTP 200 without redirects; received ${response.status}.`);
  }
  if (!response.body.includes('data-invitation-publication="published"')) {
    throw new Error("INVITATION_PATH must resolve to a persistent published invitation, not a built-in demo.");
  }
}

export const options = {
  scenarios: {
    public_invitation: {
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
  const response = http.get(targetUrl, { redirects: 0, tags: { flow: "published-invitation" } });
  check(response, {
    "published invitation returns HTTP 200": (result) => result.status === 200,
  });
  sleep(3);
}
