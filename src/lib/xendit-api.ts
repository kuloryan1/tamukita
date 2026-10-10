import "server-only";

const xenditApiOrigin = "https://api.xendit.co";
const loopbackHosts = new Set(["127.0.0.1", "::1", "localhost"]);

export function getXenditApiUrl(resource: "sessions" | "refunds") {
  const configuredBaseUrl = process.env.XENDIT_API_BASE_URL?.trim();
  if (configuredBaseUrl) {
    try {
      const baseUrl = new URL(configuredBaseUrl);
      const isOfficialXendit = baseUrl.protocol === "https:" && baseUrl.hostname === "api.xendit.co";
      const isAllowedLoopback = loopbackHosts.has(baseUrl.hostname)
        && ["http:", "https:"].includes(baseUrl.protocol)
        && (process.env.NODE_ENV !== "production" || process.env.CI === "true" || process.env.E2E_XENDIT_MOCK === "true");
      if (isOfficialXendit || isAllowedLoopback) {
        const basePath = baseUrl.pathname.endsWith("/") ? baseUrl.pathname : `${baseUrl.pathname}/`;
        return new URL(resource, new URL(basePath, baseUrl.origin)).toString();
      }
    } catch {
      // Invalid or untrusted overrides fall back to Xendit's official API origin.
    }
  }
  return new URL(resource, `${xenditApiOrigin}/`).toString();
}
