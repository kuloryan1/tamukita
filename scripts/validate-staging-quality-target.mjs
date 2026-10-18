import { getProductionHostnames, normalizeHostname } from "../tests/load/production-hostnames.js";

const baseUrl = process.env.BASE_URL;
const invitationPath = process.env.INVITATION_PATH;
const qualityProfile = process.env.STAGING_QUALITY_PROFILE || "full-load";
const loadConfirmed = process.env.STAGING_LOAD_CONFIRMED === "true";

if (!new Set(["performance-only", "full-load"]).has(qualityProfile)) {
  throw new Error("STAGING_QUALITY_PROFILE must be performance-only or full-load.");
}

if (!baseUrl || !invitationPath) {
  throw new Error("Configure STAGING_BASE_URL and STAGING_INVITATION_PATH in the GitHub staging environment.");
}
if (qualityProfile === "full-load" && !loadConfirmed) {
  throw new Error("Confirm that staging is isolated and ready for up to 1,000 virtual users before starting these tests.");
}

let target;
try {
  target = new URL(baseUrl);
} catch {
  throw new Error("STAGING_BASE_URL must be a valid HTTPS origin.");
}
if (target.protocol !== "https:" || target.pathname !== "/" || target.search || target.hash || target.username || target.password) {
  throw new Error("STAGING_BASE_URL must be an HTTPS origin without credentials, path, query, or fragment.");
}

const productionHosts = getProductionHostnames(process.env.PRODUCTION_HOSTNAMES);
if (productionHosts.has(normalizeHostname(target.hostname))) {
  throw new Error("Refusing to run staging quality checks against a configured production host.");
}
if (!/^\/[A-Za-z0-9][A-Za-z0-9_-]*$/.test(invitationPath)) {
  throw new Error("STAGING_INVITATION_PATH must be a same-origin published invitation path such as /slug-undangan-uji.");
}

const invitationUrl = new URL(invitationPath, target.origin);
const invitationResponse = await fetch(invitationUrl, {
  redirect: "manual",
  signal: AbortSignal.timeout(15_000),
});
if (invitationResponse.status !== 200) {
  await invitationResponse.body?.cancel();
  throw new Error(`The staging invitation must return HTTP 200 without redirects; received ${invitationResponse.status}.`);
}

const invitationHtml = await invitationResponse.text();
if (!invitationHtml.includes('data-invitation-publication="published"')) {
  const isDemo = invitationHtml.includes('data-invitation-publication="demo"');
  throw new Error(isDemo
    ? "STAGING_INVITATION_PATH resolves to a built-in demo. Publish a persistent QA invitation before starting staging quality checks."
    : "STAGING_INVITATION_PATH does not identify a server-rendered published invitation. Publish a persistent QA invitation before starting staging quality checks.");
}

console.log(`Staging quality target: ${invitationUrl.origin}${invitationUrl.pathname} (published invitation verified)`);
