import { expect, test } from "vitest";
import { guestDataRetentionDeadline, mediaRetentionDeadline } from "@/lib/data-retention";

test("keeps guest data until the later of 90 days after the event or 30 days after hosting ends", () => {
  const deadline = guestDataRetentionDeadline({
    startsAt: new Date("2026-01-01T00:00:00.000Z"),
    events: [{ startsAt: new Date("2026-02-01T00:00:00.000Z") }],
    expiresAt: new Date("2026-03-01T00:00:00.000Z"),
    deletedAt: null,
  });

  expect(deadline?.toISOString()).toBe("2026-05-02T00:00:00.000Z");
});

test("starts guest-data deletion timing from the first time hosting ends", () => {
  const deadline = guestDataRetentionDeadline({
    startsAt: new Date("2026-05-01T00:00:00.000Z"),
    events: [{ startsAt: new Date("2026-05-01T00:00:00.000Z") }],
    expiresAt: new Date("2027-01-01T00:00:00.000Z"),
    deletedAt: new Date("2026-05-02T00:00:00.000Z"),
  });

  expect(deadline?.toISOString()).toBe("2026-07-30T00:00:00.000Z");
});

test("returns no guest-data deadline until hosting has ended", () => {
  expect(guestDataRetentionDeadline({ startsAt: null, events: [], expiresAt: null, deletedAt: null })).toBeNull();
});

test("retains media for 30 days after the earlier hosting end or invitation deletion", () => {
  const deadline = mediaRetentionDeadline(
    new Date("2027-01-01T00:00:00.000Z"),
    new Date("2026-05-02T00:00:00.000Z"),
  );

  expect(deadline?.toISOString()).toBe("2026-06-01T00:00:00.000Z");
});
