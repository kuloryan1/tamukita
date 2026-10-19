import { describe, expect, test } from "vitest";
import { getIntegrationConfigurations } from "@/lib/integration-status";

const configuredStaging = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://app:secret@postgres:5432/tamukita",
  AUTH_SECRET: "staging-only-secret",
  NEXT_PUBLIC_APP_URL: "https://staging.tamukita.io",
  XENDIT_SECRET_KEY: "xnd_development_staging-key",
  XENDIT_WEBHOOK_TOKEN: "staging-payment-token",
  XENDIT_REFUND_WEBHOOK_TOKEN: "staging-refund-token",
  RESEND_API_KEY: "re_staging-key",
  EMAIL_FROM: "TamuKita Staging <qa@example.com>",
  REDIS_URL: "rediss://redis:6379",
  R2_ACCOUNT_ID: "cloudflare-account",
  R2_ACCESS_KEY_ID: "staging-access-key",
  R2_SECRET_ACCESS_KEY: "staging-secret-key",
  R2_PRIVATE_BUCKET_NAME: "tamukita-staging-private",
  R2_PUBLIC_BUCKET_NAME: "tamukita-staging-public",
  R2_PUBLIC_BASE_URL: "https://media-staging.tamukita.io",
};

function statusFor(environment: Record<string, string | undefined>, label: string) {
  return getIntegrationConfigurations(environment).find((integration) => integration.label === label)?.status;
}

describe("getIntegrationConfigurations", () => {
  test("reports safe staging configuration without exposing values", () => {
    const integrations = getIntegrationConfigurations(configuredStaging);
    expect(integrations.every(({ status }) => status === "configured")).toBe(true);
    expect(JSON.stringify(integrations)).not.toContain("staging-secret-key");
    expect(JSON.stringify(integrations)).not.toContain("staging-only-secret");
  });

  test("distinguishes missing, partial, and invalid integration settings", () => {
    expect(statusFor({}, "Email Resend")).toBe("missing");
    expect(statusFor({ RESEND_API_KEY: "re_key" }, "Email Resend")).toBe("incomplete");
    expect(statusFor({ RESEND_API_KEY: "re_key", EMAIL_FROM: "qa@sender.invalid" }, "Email Resend")).toBe("invalid");
    expect(statusFor({ REDIS_URL: "https://redis.example.test" }, "Redis endpoint")).toBe("invalid");
    expect(statusFor({ DATABASE_URL: "not a database URL" }, "Database URL")).toBe("invalid");
  });

  test("rejects live Xendit keys on staging", () => {
    expect(statusFor({
      NODE_ENV: "production",
      NEXT_PUBLIC_APP_URL: "https://staging.tamukita.io",
      XENDIT_SECRET_KEY: "xnd_live_wrong-environment",
    }, "Xendit API")).toBe("invalid");
  });

  test("rejects incomplete, shared-bucket, and non-HTTPS R2 configuration", () => {
    expect(statusFor({ R2_ACCOUNT_ID: "account", R2_ACCESS_KEY_ID: "key" }, "Media R2")).toBe("incomplete");
    expect(statusFor({
      R2_ACCOUNT_ID: "account",
      R2_ACCESS_KEY_ID: "key",
      R2_SECRET_ACCESS_KEY: "secret",
      R2_PRIVATE_BUCKET_NAME: "shared",
      R2_PUBLIC_BUCKET_NAME: "shared",
      R2_PUBLIC_BASE_URL: "https://media.example.test",
    }, "Media R2")).toBe("invalid");
    expect(statusFor({
      R2_ACCOUNT_ID: "account",
      R2_ACCESS_KEY_ID: "key",
      R2_SECRET_ACCESS_KEY: "secret",
      R2_PRIVATE_BUCKET_NAME: "private",
      R2_PUBLIC_BUCKET_NAME: "public",
      R2_PUBLIC_BASE_URL: "http://media.example.test",
    }, "Media R2")).toBe("invalid");
  });
});
