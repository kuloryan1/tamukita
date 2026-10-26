export const ADULT_ATTESTATION_VERSION = "adult-18plus-2026-10-v1";
export const RSVP_CHILD_DATA_GUARDIAN_CONSENT_VERSION = "child-rsvp-guardian-2026-10-v1";
export const GUESTBOOK_CHILD_DATA_GUARDIAN_CONSENT_VERSION = "child-guestbook-guardian-2026-10-v1";

export type ChildDataGuardianConsentVersion =
  | typeof RSVP_CHILD_DATA_GUARDIAN_CONSENT_VERSION
  | typeof GUESTBOOK_CHILD_DATA_GUARDIAN_CONSENT_VERSION;
