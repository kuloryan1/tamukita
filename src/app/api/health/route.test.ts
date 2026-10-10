import { afterEach, beforeEach, expect, test, vi } from "vitest";

const databaseMock = vi.hoisted(() => ({ queryRaw: vi.fn() }));
const redisMock = vi.hoisted(() => ({
  connect: vi.fn(),
  ping: vi.fn(),
  get: vi.fn(),
  disconnect: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  getPrismaClient: () => ({ $queryRaw: databaseMock.queryRaw }),
}));

vi.mock("ioredis", () => ({
  default: vi.fn(function MockRedis() {
    return redisMock;
  }),
}));

import { GET } from "./route";

beforeEach(() => {
  vi.stubEnv("REDIS_URL", "redis://localhost:6379");
  databaseMock.queryRaw.mockReset().mockResolvedValue(1);
  redisMock.connect.mockReset().mockResolvedValue(undefined);
  redisMock.ping.mockReset().mockResolvedValue("PONG");
  redisMock.get.mockReset().mockResolvedValue("1");
  redisMock.disconnect.mockReset();
});

afterEach(() => vi.unstubAllEnvs());

test("reports healthy only when the database, Redis, and worker heartbeat are available", async () => {
  const response = await GET();

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({
    status: "ok",
    dependencies: { database: "ok", redis: "ok", worker: "ok" },
  });
  expect(redisMock.disconnect).toHaveBeenCalledOnce();
});

test("reports unavailable when Redis is up but the worker heartbeat has expired", async () => {
  redisMock.get.mockResolvedValue(null);

  const response = await GET();

  expect(response.status).toBe(503);
  await expect(response.json()).resolves.toEqual({
    status: "unavailable",
    dependencies: { database: "ok", redis: "ok", worker: "unavailable" },
  });
});

test("reports unavailable when the database check fails", async () => {
  databaseMock.queryRaw.mockRejectedValue(new Error("database unavailable"));

  const response = await GET();

  expect(response.status).toBe(503);
  await expect(response.json()).resolves.toEqual({
    status: "unavailable",
    dependencies: { database: "unavailable", redis: "ok", worker: "ok" },
  });
});
