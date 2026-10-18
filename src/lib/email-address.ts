export function isReservedNonDeliverableEmailAddress(address: string) {
  const separator = address.lastIndexOf("@");
  if (separator < 1) return false;

  const domain = address.slice(separator + 1).trim().toLowerCase();
  return domain === "invalid" || domain.endsWith(".invalid");
}
