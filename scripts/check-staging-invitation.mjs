import { verifyPublishedStagingInvitation } from "../tests/load/staging-target.js";

const invitationUrl = await verifyPublishedStagingInvitation({
  baseUrl: process.env.STAGING_BASE_URL,
  invitationPath: process.env.STAGING_INVITATION_PATH,
  productionHostnames: process.env.PRODUCTION_HOSTNAMES,
});

console.log(`Staging invitation target verified: ${invitationUrl.origin}${invitationUrl.pathname} (published invitation)`);
