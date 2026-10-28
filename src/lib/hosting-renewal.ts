export const HOSTING_RENEWAL_WINDOW_DAYS = 30;
const DAY_MS = 86_400_000;

export function canRenewHosting(expiresAt: Date, now: Date = new Date()) {
  const opensAt = now.getTime() + HOSTING_RENEWAL_WINDOW_DAYS * DAY_MS;
  const closesAt = expiresAt.getTime() + HOSTING_RENEWAL_WINDOW_DAYS * DAY_MS;
  return expiresAt.getTime() <= opensAt && now.getTime() < closesAt;
}

export function hostingRenewalDeadline(expiresAt: Date) {
  return new Date(expiresAt.getTime() + HOSTING_RENEWAL_WINDOW_DAYS * DAY_MS);
}
