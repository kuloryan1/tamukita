import { expect, test } from "vitest";
import { getWorkerIntegrationConfigurations } from "@/lib/integration-status";
import { createWorkerIntegrationSnapshot, isWorkerHeartbeatActive, parseWorkerIntegrationSnapshot } from "@/lib/worker-health";

test("accepts the active worker heartbeat marker", () => {
  expect(isWorkerHeartbeatActive("1")).toBe(true);
});

test("rejects a missing or malformed worker heartbeat marker", () => {
  expect(isWorkerHeartbeatActive(null)).toBe(false);
  expect(isWorkerHeartbeatActive("")).toBe(false);
  expect(isWorkerHeartbeatActive("stale")).toBe(false);
});

test("round trips a worker configuration snapshot without secret values", () => {
  const integrations = getWorkerIntegrationConfigurations({
    DATABASE_URL: "postgresql://worker:secret@postgres:5432/tamukita",
    REDIS_URL: "redis://redis:6379",
    RESEND_API_KEY: "worker-email-secret",
    EMAIL_FROM: "TamuKita <qa@example.com>",
    R2_ACCOUNT_ID: "account",
    R2_ACCESS_KEY_ID: "worker-access-secret",
    R2_SECRET_ACCESS_KEY: "worker-storage-secret",
    R2_PRIVATE_BUCKET_NAME: "private",
    R2_PUBLIC_BUCKET_NAME: "public",
    R2_PUBLIC_BASE_URL: "https://media.example.test",
  });
  const snapshot = createWorkerIntegrationSnapshot(integrations, new Date("2026-10-19T05:00:00.000Z"));
  const serialized = JSON.stringify(snapshot);

  expect(parseWorkerIntegrationSnapshot(serialized)).toEqual(snapshot);
  expect(serialized).not.toContain("secret");
  expect(serialized).not.toContain("worker-access-secret");
});

test("rejects stale formats, duplicate labels, and unsupported integration statuses", () => {
  const base = {
    version: 1,
    checkedAt: "2026-10-19T05:00:00.000Z",
    integrations: [
      { label: "Database URL", status: "configured" },
      { label: "Redis endpoint", status: "configured" },
      { label: "Email Resend", status: "configured" },
      { label: "Media R2", status: "configured" },
    ],
  };

  expect(parseWorkerIntegrationSnapshot(null)).toBeNull();
  expect(parseWorkerIntegrationSnapshot("not-json")).toBeNull();
  expect(parseWorkerIntegrationSnapshot(JSON.stringify({ ...base, integrations: [...base.integrations.slice(0, 3), base.integrations[2]] }))).toBeNull();
  expect(parseWorkerIntegrationSnapshot(JSON.stringify({ ...base, integrations: [...base.integrations.slice(0, 3), { label: "Media R2", status: "secret" }] }))).toBeNull();
});
