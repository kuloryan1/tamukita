import { verifyPublishedStagingInvitation } from "../tests/load/staging-target.js";

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

const invitationUrl = await verifyPublishedStagingInvitation({
  baseUrl,
  invitationPath,
  productionHostnames: process.env.PRODUCTION_HOSTNAMES,
});

console.log(`Staging quality target: ${invitationUrl.origin}${invitationUrl.pathname} (published invitation verified)`);
