import { getR2BucketNames } from "@/lib/r2-buckets";
import { getXenditSecretKey } from "@/lib/xendit-config";

export type IntegrationConfigurationStatus = "configured" | "missing" | "incomplete" | "invalid";
export type IntegrationConfiguration = { label: string; status: IntegrationConfigurationStatus };

type Environment = Record<string, string | undefined>;

function hasValue(environment: Environment, key: string) {
  return Boolean(environment[key]?.trim());
}

function singleValueStatus(environment: Environment, key: string, isValid: (value: string) => boolean = () => true): IntegrationConfigurationStatus {
  const value = environment[key]?.trim();
  if (!value) return "missing";
  return isValid(value) ? "configured" : "invalid";
}

function groupedValueStatus(environment: Environment, keys: string[], isValid: () => boolean = () => true): IntegrationConfigurationStatus {
  const configuredCount = keys.filter((key) => hasValue(environment, key)).length;
  if (configuredCount === 0) return "missing";
  if (configuredCount < keys.length) return "incomplete";
  return isValid() ? "configured" : "invalid";
}

function isDatabaseUrl(value: string) {
  try {
    const url = new URL(value);
    return ["postgres:", "postgresql:"].includes(url.protocol) && Boolean(url.hostname) && url.pathname.length > 1;
  } catch {
    return false;
  }
}

function isRedisUrl(value: string) {
  try {
    const url = new URL(value);
    return ["redis:", "rediss:"].includes(url.protocol) && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function isApplicationUrl(value: string, environment: Environment) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname || url.username || url.password) return false;
    const isLoopback = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname);
    return environment.NODE_ENV !== "production" || url.protocol === "https:" || isLoopback;
  } catch {
    return false;
  }
}

function isEmailSender(value: string) {
  const trimmed = value.trim();
  const address = trimmed.startsWith("<") && trimmed.endsWith(">")
    ? trimmed.slice(1, -1).trim()
    : trimmed.match(/<([^<>]+)>\s*$/)?.[1]?.trim() ?? trimmed;
  if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(address)) return false;
  const domain = address.slice(address.lastIndexOf("@") + 1).toLowerCase();
  return domain !== "invalid" && !domain.endsWith(".invalid");
}

function isR2Configuration(environment: Environment) {
  const accountId = environment.R2_ACCOUNT_ID?.trim();
  const bucketNames = getR2BucketNames(environment);
  const publicBaseUrlValue = environment.R2_PUBLIC_BASE_URL?.trim();
  if (!accountId || !bucketNames || !publicBaseUrlValue) return false;

  const localMockEnabled = environment.E2E_R2_MOCK === "true";
  const endpointValue = environment.R2_S3_ENDPOINT?.trim() || `https://${accountId}.r2.cloudflarestorage.com`;
  try {
    const publicUrl = new URL(publicBaseUrlValue);
    const endpointUrl = new URL(endpointValue);
    const isLoopback = (hostname: string) => ["127.0.0.1", "localhost", "::1", "[::1]"].includes(hostname);
    const publicUsesLocalMock = localMockEnabled && publicUrl.protocol === "http:" && isLoopback(publicUrl.hostname);
    const endpointUsesLocalMock = localMockEnabled && endpointUrl.protocol === "http:" && isLoopback(endpointUrl.hostname);
    const publicIsSecure = publicUrl.protocol === "https:";
    const endpointIsSecure = endpointUrl.protocol === "https:";
    return (publicIsSecure || publicUsesLocalMock)
      && (endpointIsSecure || endpointUsesLocalMock)
      && (!localMockEnabled || (publicUsesLocalMock && endpointUsesLocalMock));
  } catch {
    return false;
  }
}

export function getIntegrationConfigurations(environment: Environment = process.env): IntegrationConfiguration[] {
  return [
    { label: "Database URL", status: singleValueStatus(environment, "DATABASE_URL", isDatabaseUrl) },
    { label: "Auth secret", status: singleValueStatus(environment, "AUTH_SECRET") },
    {
      label: "Xendit API",
      status: singleValueStatus(environment, "XENDIT_SECRET_KEY", () => Boolean(getXenditSecretKey(environment))),
    },
    { label: "Xendit payment webhook", status: singleValueStatus(environment, "XENDIT_WEBHOOK_TOKEN") },
    { label: "Xendit refund webhook", status: singleValueStatus(environment, "XENDIT_REFUND_WEBHOOK_TOKEN") },
    {
      label: "Email Resend",
      status: groupedValueStatus(environment, ["RESEND_API_KEY", "EMAIL_FROM"], () => isEmailSender(environment.EMAIL_FROM ?? "")),
    },
    { label: "Redis endpoint", status: singleValueStatus(environment, "REDIS_URL", isRedisUrl) },
    { label: "Alamat aplikasi", status: singleValueStatus(environment, "NEXT_PUBLIC_APP_URL", (value) => isApplicationUrl(value, environment)) },
    {
      label: "Media R2",
      status: groupedValueStatus(environment, [
        "R2_ACCOUNT_ID",
        "R2_ACCESS_KEY_ID",
        "R2_SECRET_ACCESS_KEY",
        environment.R2_PRIVATE_BUCKET_NAME?.trim() ? "R2_PRIVATE_BUCKET_NAME" : "R2_BUCKET_NAME",
        "R2_PUBLIC_BUCKET_NAME",
        "R2_PUBLIC_BASE_URL",
      ], () => isR2Configuration(environment)),
    },
  ];
}
