const developmentKeyPrefix = "xnd_development_";
const loopbackHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const productionHosts = new Set(["tamukita.io", "www.tamukita.io"]);

type XenditConfigEnvironment = {
  NODE_ENV?: string;
  NEXT_PUBLIC_APP_URL?: string;
  XENDIT_SECRET_KEY?: string;
};

export function getXenditSecretKey(environment: XenditConfigEnvironment = process.env) {
  const secretKey = environment.XENDIT_SECRET_KEY?.trim();
  if (!secretKey) return undefined;

  let hostname: string;
  try {
    hostname = new URL(environment.NEXT_PUBLIC_APP_URL ?? "").hostname.toLowerCase();
  } catch {
    return environment.NODE_ENV === "production" ? undefined : secretKey;
  }

  const isDevelopmentKey = secretKey.startsWith(developmentKeyPrefix);
  if (hostname === "staging.tamukita.io") {
    return isDevelopmentKey ? secretKey : undefined;
  }

  if (loopbackHosts.has(hostname)) return secretKey;

  const isProductionRuntime = environment.NODE_ENV === "production" || productionHosts.has(hostname);
  if (isProductionRuntime && (!productionHosts.has(hostname) || isDevelopmentKey)) return undefined;

  return secretKey;
}
