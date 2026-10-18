import { describe, expect, test } from "vitest";
import { getXenditSecretKey } from "@/lib/xendit-config";

describe("getXenditSecretKey", () => {
  test("accepts a development key for the staging origin", () => {
    expect(getXenditSecretKey({
      NODE_ENV: "production",
      NEXT_PUBLIC_APP_URL: "https://staging.tamukita.io",
      XENDIT_SECRET_KEY: "xnd_development_test-key",
    })).toBe("xnd_development_test-key");
  });

  test("rejects a non-development key for the staging origin", () => {
    expect(getXenditSecretKey({
      NODE_ENV: "production",
      NEXT_PUBLIC_APP_URL: "https://staging.tamukita.io",
      XENDIT_SECRET_KEY: "xnd_live_test-key",
    })).toBeUndefined();
  });

  test("rejects a development key for production origins", () => {
    for (const origin of ["https://tamukita.io", "https://www.tamukita.io", "https://preview.example.com"]) {
      expect(getXenditSecretKey({
        NODE_ENV: "production",
        NEXT_PUBLIC_APP_URL: origin,
        XENDIT_SECRET_KEY: "xnd_development_test-key",
      })).toBeUndefined();
    }
  });

  test("allows a non-development key for production origins", () => {
    expect(getXenditSecretKey({
      NODE_ENV: "production",
      NEXT_PUBLIC_APP_URL: "https://tamukita.io",
      XENDIT_SECRET_KEY: "xnd_live_test-key",
    })).toBe("xnd_live_test-key");
  });

  test("allows test credentials for local CI and returns undefined for missing keys", () => {
    expect(getXenditSecretKey({
      NODE_ENV: "production",
      NEXT_PUBLIC_APP_URL: "http://127.0.0.1:23300",
      XENDIT_SECRET_KEY: "ci_xendit_secret_key",
    })).toBe("ci_xendit_secret_key");
    expect(getXenditSecretKey({ NODE_ENV: "production", NEXT_PUBLIC_APP_URL: "https://staging.tamukita.io" })).toBeUndefined();
  });

  test("fails closed for an invalid application URL in production", () => {
    expect(getXenditSecretKey({ NODE_ENV: "production", NEXT_PUBLIC_APP_URL: "not an origin", XENDIT_SECRET_KEY: "xnd_live_test-key" })).toBeUndefined();
  });
});
