const DEFAULT_PRODUCTION_HOSTNAMES = ["tamukita.io", "www.tamukita.io"];
const DNS_HOSTNAME_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))*$/;

export function normalizeHostname(hostname) {
  return hostname.toLowerCase().replace(/\.+$/, "");
}

export function getProductionHostnames(configuredHostnames) {
  const hostnames = new Set(DEFAULT_PRODUCTION_HOSTNAMES);

  for (const entry of (configuredHostnames ?? "").split(",")) {
    const hostname = normalizeHostname(entry.trim());
    if (!hostname) continue;
    if (!DNS_HOSTNAME_PATTERN.test(hostname)) {
      throw new Error("PRODUCTION_HOSTNAMES must be a comma-separated list of bare DNS hostnames.");
    }
    hostnames.add(hostname);
  }

  return hostnames;
}
