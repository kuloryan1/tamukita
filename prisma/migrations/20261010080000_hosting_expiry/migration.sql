WITH legacy_invitations AS (
  UPDATE "invitations"
  SET "expiresAt" = CURRENT_TIMESTAMP + INTERVAL '365 days',
      "updatedAt" = CURRENT_TIMESTAMP
  WHERE "status" = 'PUBLISHED'
    AND "expiresAt" IS NULL
    AND "deletedAt" IS NULL
  RETURNING "id", "organizationId", "expiresAt"
)
INSERT INTO "entitlements" ("id", "organizationId", "invitationId", "featureKey", "value", "status", "startsAt", "expiresAt", "createdAt")
SELECT md5(random()::text || clock_timestamp()::text || legacy_invitations."id"::text)::uuid,
       legacy_invitations."organizationId",
       legacy_invitations."id",
       'hosting',
       '{"periodDays":365,"source":"LEGACY_BACKFILL"}'::jsonb,
       'ACTIVE',
       CURRENT_TIMESTAMP,
       legacy_invitations."expiresAt",
       CURRENT_TIMESTAMP
FROM legacy_invitations
WHERE NOT EXISTS (
  SELECT 1
  FROM "entitlements"
  WHERE "entitlements"."invitationId" = legacy_invitations."id"
    AND "entitlements"."featureKey" = 'hosting'
    AND "entitlements"."status" = 'ACTIVE'
);
