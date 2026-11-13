export const ADMIN_SAMPLE_PUBLICATION_MODE = "ADMIN_SAMPLE" as const;

export function isAdminSampleSnapshot(value: unknown) {
  return typeof value === "object"
    && value !== null
    && !Array.isArray(value)
    && (value as Record<string, unknown>).publicationMode === ADMIN_SAMPLE_PUBLICATION_MODE;
}

export function getAdminSampleTemplateId(value: unknown) {
  if (!isAdminSampleSnapshot(value)) return null;
  const templateId = (value as Record<string, unknown>).templateId;
  return typeof templateId === "string" ? templateId : null;
}
