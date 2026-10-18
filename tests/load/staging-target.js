import { getProductionHostnames, normalizeHostname } from "./production-hostnames.js";

const publishedMarker = 'data-invitation-publication="published"';
const demoMarker = 'data-invitation-publication="demo"';

export function createStagingInvitationTarget({ baseUrl, invitationPath, productionHostnames }) {
  if (!baseUrl || !invitationPath) {
    throw new Error("Configure STAGING_BASE_URL and STAGING_INVITATION_PATH in the GitHub staging environment.");
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

  const blockedHosts = getProductionHostnames(productionHostnames);
  if (blockedHosts.has(normalizeHostname(target.hostname))) {
    throw new Error("Refusing to run staging checks against a configured production host.");
  }

  if (!/^\/[A-Za-z0-9][A-Za-z0-9_-]*$/.test(invitationPath)) {
    throw new Error("STAGING_INVITATION_PATH must be a same-origin published invitation path such as /slug-undangan-uji.");
  }

  return {
    origin: target.origin,
    invitationUrl: new URL(invitationPath, target.origin),
  };
}

export async function verifyPublishedStagingInvitation({
  baseUrl,
  invitationPath,
  productionHostnames,
  fetchImpl = fetch,
  timeoutMs = 15_000,
}) {
  const target = createStagingInvitationTarget({ baseUrl, invitationPath, productionHostnames });
  const response = await fetchImpl(target.invitationUrl, {
    redirect: "manual",
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (response.status !== 200) {
    await response.body?.cancel();
    throw new Error(`The staging invitation must return HTTP 200 without redirects; received ${response.status}.`);
  }

  const html = await response.text();
  if (!html.includes(publishedMarker)) {
    throw new Error(html.includes(demoMarker)
      ? "STAGING_INVITATION_PATH resolves to a built-in demo. Publish a persistent QA invitation before continuing."
      : "STAGING_INVITATION_PATH does not identify a server-rendered published invitation. Publish a persistent QA invitation before continuing.");
  }

  return target.invitationUrl;
}
