const productionHosts = new Set(["tamukita.io", "www.tamukita.io"]);

export function isCustomerRegistrationOpen(
  appUrl: string | undefined,
  nodeEnv = process.env.NODE_ENV,
) {
  if (!appUrl) return nodeEnv !== "production";

  try {
    const { hostname } = new URL(appUrl);
    return !productionHosts.has(hostname.toLowerCase());
  } catch {
    return nodeEnv !== "production";
  }
}
