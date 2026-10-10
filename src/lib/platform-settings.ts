import "server-only";

import { getPrismaClient } from "@/lib/prisma";

const priceKeys = {
  BASIC_ACTIVATION: { key: "reseller.basic_activation_price_idr", env: "RESELLER_BASIC_ACTIVATION_PRICE_IDR" },
  PREMIUM_ACTIVATION: { key: "reseller.premium_activation_price_idr", env: "RESELLER_PREMIUM_ACTIVATION_PRICE_IDR" },
} as const;
const hostingKeys = {
  renewalPrice: { key: "invitation.hosting_renewal_price_idr", env: "INVITATION_HOSTING_RENEWAL_PRICE_IDR" },
  termDays: { key: "invitation.hosting_term_days", env: "INVITATION_HOSTING_TERM_DAYS" },
} as const;
const customerActivationKey = { key: "invitation.customer_activation_price_idr", env: "CUSTOMER_ACTIVATION_PRICE_IDR" } as const;

function validPrice(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1 && value <= 2_147_483_647;
}

function validNonNegativePrice(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 2_147_483_647;
}

function validTermDays(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 30 && value <= 3_650;
}

export async function getResellerCreditPrice(sku: keyof typeof priceKeys) {
  const config = priceKeys[sku];
  const setting = await getPrismaClient().platformSetting.findUnique({ where: { key: config.key }, select: { value: true } });
  if (validPrice(setting?.value)) return setting.value;
  const envValue = Number(process.env[config.env]);
  return validPrice(envValue) ? envValue : null;
}

export async function getHostingTermDays() {
  const config = hostingKeys.termDays;
  const setting = await getPrismaClient().platformSetting.findUnique({ where: { key: config.key }, select: { value: true } });
  if (validTermDays(setting?.value)) return setting.value;
  const envValue = Number(process.env[config.env]);
  return validTermDays(envValue) ? envValue : 365;
}

export async function getHostingRenewalPrice() {
  const config = hostingKeys.renewalPrice;
  const setting = await getPrismaClient().platformSetting.findUnique({ where: { key: config.key }, select: { value: true } });
  if (setting?.value === 0) return null;
  if (validPrice(setting?.value)) return setting.value;
  const envValue = Number(process.env[config.env]);
  return validPrice(envValue) ? envValue : null;
}

export async function getCustomerActivationPrice() {
  const setting = await getPrismaClient().platformSetting.findUnique({ where: { key: customerActivationKey.key }, select: { value: true } });
  if (validNonNegativePrice(setting?.value)) return setting.value;
  const envValue = Number(process.env[customerActivationKey.env]);
  return validNonNegativePrice(envValue) ? envValue : 0;
}

export async function getPlatformSettingsOverview() {
  const prisma = getPrismaClient();
  const settings = await prisma.platformSetting.findMany({ where: { key: { in: [...Object.values(priceKeys).map(({ key }) => key), ...Object.values(hostingKeys).map(({ key }) => key), customerActivationKey.key] } }, select: { key: true, value: true } });
  const values = new Map(settings.map((setting) => [setting.key, setting.value]));
  const resolvePrice = (sku: keyof typeof priceKeys) => {
    const config = priceKeys[sku];
    const stored = values.get(config.key);
    if (validPrice(stored)) return stored;
    const fallback = Number(process.env[config.env]);
    return validPrice(fallback) ? fallback : 0;
  };
  const resolveHostingPrice = () => {
    const stored = values.get(hostingKeys.renewalPrice.key);
    if (stored === 0) return 0;
    if (validPrice(stored)) return stored;
    const fallback = Number(process.env[hostingKeys.renewalPrice.env]);
    return validPrice(fallback) ? fallback : 0;
  };
  const resolveCustomerActivationPrice = () => {
    const stored = values.get(customerActivationKey.key);
    if (validNonNegativePrice(stored)) return stored;
    const fallback = Number(process.env[customerActivationKey.env]);
    return validNonNegativePrice(fallback) ? fallback : 0;
  };
  const storedTerm = values.get(hostingKeys.termDays.key);
  const envTerm = Number(process.env[hostingKeys.termDays.env]);
  const envKeys: Record<string, string> = {
    "Database URL": "DATABASE_URL",
    "Auth secret": "AUTH_SECRET",
    "Xendit API": "XENDIT_SECRET_KEY",
    "Xendit payment webhook": "XENDIT_WEBHOOK_TOKEN",
    "Xendit refund webhook": "XENDIT_REFUND_WEBHOOK_TOKEN",
    "Email Resend": "RESEND_API_KEY",
    "Redis worker": "REDIS_URL",
    "Alamat aplikasi": "NEXT_PUBLIC_APP_URL",
    "R2 account": "R2_ACCOUNT_ID",
    "R2 access key": "R2_ACCESS_KEY_ID",
    "R2 secret key": "R2_SECRET_ACCESS_KEY",
    "R2 private bucket": "R2_PRIVATE_BUCKET_NAME",
    "R2 public bucket": "R2_PUBLIC_BUCKET_NAME",
    "R2 public URL": "R2_PUBLIC_BASE_URL",
  };
  return {
    prices: { basicActivationIdr: resolvePrice("BASIC_ACTIVATION"), premiumActivationIdr: resolvePrice("PREMIUM_ACTIVATION"), customerActivationIdr: resolveCustomerActivationPrice(), hostingRenewalIdr: resolveHostingPrice() },
    hostingTermDays: validTermDays(storedTerm) ? storedTerm : validTermDays(envTerm) ? envTerm : 365,
    integrations: Object.entries(envKeys).map(([label, key]) => ({ label, configured: Boolean(process.env[key]) })),
  };
}

export const platformPriceKeys = priceKeys;
export const platformHostingKeys = hostingKeys;
export const platformCustomerActivationKey = customerActivationKey;
