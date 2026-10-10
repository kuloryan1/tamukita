import { beforeEach, expect, test, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({ membership: { findFirst: vi.fn() } }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ getPrismaClient: () => prismaMock }));

import { getWritableOrganizationId } from "@/lib/invitation-server";

beforeEach(() => prismaMock.membership.findFirst.mockReset().mockResolvedValue({ organizationId: "customer-workspace" }));

test("selects an active personal workspace for a customer's self-service draft", async () => {
  await expect(getWritableOrganizationId("customer-user")).resolves.toBe("customer-workspace");

  expect(prismaMock.membership.findFirst).toHaveBeenCalledWith({
    where: {
      userId: "customer-user",
      role: { in: ["OWNER", "ADMIN", "EDITOR"] },
      organization: { type: "PERSONAL", status: "ACTIVE" },
    },
    orderBy: { createdAt: "asc" },
    select: { organizationId: true },
  });
});

test("does not create a self-service draft in a reseller workspace", async () => {
  prismaMock.membership.findFirst.mockResolvedValue(null);

  await expect(getWritableOrganizationId("reseller-only-user")).resolves.toBeNull();
  expect(prismaMock.membership.findFirst.mock.calls[0]?.[0]?.where.organization).toEqual({ type: "PERSONAL", status: "ACTIVE" });
});
