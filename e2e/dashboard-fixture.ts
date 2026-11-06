import { createHash } from "node:crypto";

export const dashboardFixture = {
  invitationId: "11000000-0000-4000-8000-000000000001",
  slug: "e2e-dashboard-published",
} as const;

export function getDashboardFixtureCredentials() {
  const sourceEmail = process.env.E2E_CUSTOMER_EMAIL?.trim().toLowerCase();
  return {
    // A separate real account keeps these UI checks out of the shared
    // customer's authentication bucket without changing production limits.
    email: sourceEmail ? `e2e-dashboard-${createHash("sha256").update(sourceEmail).digest("hex").slice(0, 12)}@tamukita.test` : undefined,
    password: process.env.E2E_CUSTOMER_PASSWORD,
  };
}
