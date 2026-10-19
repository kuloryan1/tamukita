const accountId = process.env.R2_ACCOUNT_ID;
const bucketName = process.env.R2_PRIVATE_BUCKET_NAME;
const publicBaseUrlValue = process.env.R2_PUBLIC_BASE_URL;

if (!/^[a-f0-9]{32}$/i.test(accountId ?? "")) {
  throw new Error("R2_ACCOUNT_ID must be a 32-character Cloudflare account ID.");
}

if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucketName ?? "")) {
  throw new Error("R2_PRIVATE_BUCKET_NAME must be a valid R2 bucket name.");
}

let publicBaseUrl;
try {
  publicBaseUrl = new URL(publicBaseUrlValue ?? "");
} catch {
  throw new Error("R2_PUBLIC_BASE_URL must be a valid HTTPS URL.");
}
if (publicBaseUrl.protocol !== "https:" || publicBaseUrl.hostname !== "media-staging.tamukita.io" || publicBaseUrl.pathname !== "/") {
  throw new Error("R2_PUBLIC_BASE_URL must be https://media-staging.tamukita.io.");
}

const objectUrl = `https://${accountId}.r2.cloudflarestorage.com/${bucketName}/cors-probe.txt`;
const mediaProbeUrl = new URL("__tamukita_staging_media_health_probe__.txt", publicBaseUrl);
const allowedOrigin = "https://staging.tamukita.io";
const blockedOrigin = "https://tamukita.io";

const privateRead = await fetch(objectUrl, {
  method: "GET",
  redirect: "manual",
  signal: AbortSignal.timeout(15_000),
});
const privateReadError = await privateRead.text();
const accessDenied = privateRead.status === 403
  || (privateRead.status === 400 && /<Message>Authorization<\/Message>/.test(privateReadError));
if (!accessDenied) {
  throw new Error(`Unauthenticated reads of the private R2 bucket must be denied; received HTTP ${privateRead.status}.`);
}

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

const mediaDomain = await fetch(mediaProbeUrl, {
  method: "HEAD",
  redirect: "manual",
  signal: AbortSignal.timeout(15_000),
});
if (mediaDomain.status !== 404) {
  throw new Error(`R2 public media domain should serve the missing-object probe as HTTP 404; received ${mediaDomain.status}.`);
}

console.log("Private R2 reads are denied; CORS allows staging and rejects the apex; the public media domain returns the expected missing-object response.");
