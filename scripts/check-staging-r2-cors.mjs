const accountId = process.env.R2_ACCOUNT_ID;
const bucketName = process.env.R2_PRIVATE_BUCKET_NAME;

if (!/^[a-f0-9]{32}$/i.test(accountId ?? "")) {
  throw new Error("R2_ACCOUNT_ID must be a 32-character Cloudflare account ID.");
}

if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucketName ?? "")) {
  throw new Error("R2_PRIVATE_BUCKET_NAME must be a valid R2 bucket name.");
}

const objectUrl = `https://${accountId}.r2.cloudflarestorage.com/${bucketName}/cors-probe.txt`;
const allowedOrigin = "https://staging.tamukita.io";
const blockedOrigin = "https://tamukita.io";

async function requestPreflight(origin) {
  return fetch(objectUrl, {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": "PUT",
      "Access-Control-Request-Headers": "content-type",
    },
    signal: AbortSignal.timeout(15_000),
  });
}

const allowed = await requestPreflight(allowedOrigin);
const allowOrigin = allowed.headers.get("access-control-allow-origin");
const allowedMethods = (allowed.headers.get("access-control-allow-methods") ?? "")
  .split(",")
  .map((method) => method.trim().toUpperCase());
const allowedHeaders = (allowed.headers.get("access-control-allow-headers") ?? "")
  .split(",")
  .map((header) => header.trim().toLowerCase());

if (allowed.status !== 204
  || allowOrigin !== allowedOrigin
  || !["PUT", "GET", "HEAD"].every((method) => allowedMethods.includes(method))
  || !allowedHeaders.includes("content-type")) {
  throw new Error("R2 did not return the expected CORS policy for staging.tamukita.io.");
}

const blocked = await requestPreflight(blockedOrigin);
if (blocked.status !== 403 || blocked.headers.has("access-control-allow-origin")) {
  throw new Error("R2 CORS must reject tamukita.io and omit Access-Control-Allow-Origin.");
}

console.log("R2 CORS allows the staging origin and rejects the apex origin.");
