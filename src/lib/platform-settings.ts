import "server-only";

import IORedis from "ioredis";
import { getPrismaClient } from "@/lib/prisma";
import { getIntegrationConfigurations } from "@/lib/integration-status";
import { parseWorkerIntegrationSnapshot, WORKER_CONFIGURATION_KEY } from "@/lib/worker-health";

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

async function getWorkerIntegrationSnapshot() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;
  let redis: IORedis | null = null;
  try {
    redis = new IORedis(redisUrl, {
      lazyConnect: true,
      connectTimeout: 1_500,
      commandTimeout: 1_500,
      maxRetriesPerRequest: 0,
      enableOfflineQueue: false,
      retryStrategy: () => null,
    });
    await redis.connect();
    return parseWorkerIntegrationSnapshot(await redis.get(WORKER_CONFIGURATION_KEY));
  } catch {
    return null;
  } finally {
    redis?.disconnect();
  }
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
  const [settings, workerConfiguration] = await Promise.all([
    prisma.platformSetting.findMany({ where: { key: { in: [...Object.values(priceKeys).map(({ key }) => key), ...Object.values(hostingKeys).map(({ key }) => key), customerActivationKey.key] } }, select: { key: true, value: true } }),
    getWorkerIntegrationSnapshot(),
  ]);
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
  return {
    prices: { basicActivationIdr: resolvePrice("BASIC_ACTIVATION"), premiumActivationIdr: resolvePrice("PREMIUM_ACTIVATION"), customerActivationIdr: resolveCustomerActivationPrice(), hostingRenewalIdr: resolveHostingPrice() },
    hostingTermDays: validTermDays(storedTerm) ? storedTerm : validTermDays(envTerm) ? envTerm : 365,
    integrations: getIntegrationConfigurations(),
    workerConfiguration,
  };
}

export const platformPriceKeys = priceKeys;
export const platformHostingKeys = hostingKeys;
export const platformCustomerActivationKey = customerActivationKey;
