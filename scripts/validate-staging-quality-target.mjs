import { getProductionHostnames, normalizeHostname } from "../tests/load/production-hostnames.js";

const baseUrl = process.env.BASE_URL;
const invitationPath = process.env.INVITATION_PATH;

if (!baseUrl || !invitationPath) {
  throw new Error("Configure STAGING_BASE_URL and STAGING_INVITATION_PATH in the GitHub staging environment.");
}
if (process.env.STAGING_LOAD_CONFIRMED !== "true") {
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

console.log(`Staging quality target: ${target.origin}${invitationPath}`);
