import { expect, test } from "vitest";
import { isWorkerHeartbeatActive } from "@/lib/worker-health";

test("accepts the active worker heartbeat marker", () => {
  expect(isWorkerHeartbeatActive("1")).toBe(true);
});

test("rejects a missing or malformed worker heartbeat marker", () => {
  expect(isWorkerHeartbeatActive(null)).toBe(false);
  expect(isWorkerHeartbeatActive("")).toBe(false);
  expect(isWorkerHeartbeatActive("stale")).toBe(false);
});
