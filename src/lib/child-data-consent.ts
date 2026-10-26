import type { ChildDataGuardianConsentVersion } from "@/lib/consent-versions";

export const CHILD_DATA_CONSENT_ERROR = "Persetujuan orang tua/wali diperlukan jika data anak dicantumkan.";

export function guardianConsentMatchesChildData(includesChildData: boolean, guardianConsent: boolean) {
  return includesChildData === guardianConsent;
}

export function childDataConsentRecord(includesChildData: boolean, consentVersion: ChildDataGuardianConsentVersion, now = new Date()) {
  return includesChildData
    ? {
        includesChildData: true,
        guardianConsentAt: now,
        guardianConsentVersion: consentVersion,
      }
    : {
        includesChildData: false,
        guardianConsentAt: null,
        guardianConsentVersion: null,
      };
}
