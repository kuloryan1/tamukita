type CustomerCheckoutTemplate = {
  id: string;
  versionId: string;
  slug: string;
  version: string;
  licenseType: "FREE" | "PAID_PER_INVITATION";
  priceIdr: number;
  features: string[];
};

type CustomerOrderItemDraft = {
  itemType: "TEMPLATE_LICENSE" | "ACTIVATION";
  sku: string;
  quantity: 1;
  unitPriceIdr: number;
  totalPriceIdr: number;
  templateId: string;
  templateVersionId: string;
  entitlementSnapshot: {
    features: string[];
    licenseType: "FREE" | "PAID_PER_INVITATION";
    hostingTermDays: number;
    templateSlug: string;
    templateVersion: string;
    plan?: CustomerPlanSnapshot;
  };
};

export type CustomerPlanSnapshot = {
  id: string;
  key: string;
  name: string;
  priceIdr: number;
  durationDays: number;
  entitlements: Array<{ featureKey: string; value: unknown }>;
};

export function isCustomerPlanSnapshot(value: unknown): value is CustomerPlanSnapshot {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const plan = value as Record<string, unknown>;
  if (typeof plan.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(plan.id)) return false;
  if (typeof plan.key !== "string" || !/^[a-z0-9][a-z0-9_-]{1,47}$/.test(plan.key)) return false;
  if (typeof plan.name !== "string" || plan.name.length < 2 || plan.name.length > 80) return false;
  if (!Number.isSafeInteger(plan.priceIdr) || (plan.priceIdr as number) < 0 || (plan.priceIdr as number) > 2_147_483_647) return false;
  if (!Number.isSafeInteger(plan.durationDays) || (plan.durationDays as number) < 1 || (plan.durationDays as number) > 3_650) return false;
  if (!Array.isArray(plan.entitlements) || plan.entitlements.length > 32) return false;

  const keys = new Set<string>();
  const isBoundedJson = (candidate: unknown, depth = 0): boolean => {
    if (depth > 5) return false;
    if (candidate === null || typeof candidate === "boolean") return true;
    if (typeof candidate === "string") return candidate.length <= 500;
    if (typeof candidate === "number") return Number.isFinite(candidate);
    if (Array.isArray(candidate)) return candidate.length <= 50 && candidate.every((item) => isBoundedJson(item, depth + 1));
    if (typeof candidate !== "object") return false;
    const entries = Object.entries(candidate);
    return entries.length <= 50 && entries.every(([key, item]) => key.length <= 64 && isBoundedJson(item, depth + 1));
  };

  for (const entitlement of plan.entitlements) {
    if (typeof entitlement !== "object" || entitlement === null || Array.isArray(entitlement)) return false;
    const entry = entitlement as Record<string, unknown>;
    if (typeof entry.featureKey !== "string" || !/^[a-z][a-z0-9_.-]{0,63}$/.test(entry.featureKey) || entry.featureKey === "hosting") return false;
    if (keys.has(entry.featureKey) || !isBoundedJson(entry.value)) return false;
    keys.add(entry.featureKey);
  }
  return new TextEncoder().encode(JSON.stringify(plan.entitlements)).byteLength <= 10_000;
}

export function buildCustomerCheckoutOrder(input: {
  template: CustomerCheckoutTemplate;
  activationPriceIdr: number;
  hostingTermDays: number;
  plan?: CustomerPlanSnapshot;
}) {
  const { template, plan } = input;
  const activationPriceIdr = plan?.priceIdr ?? input.activationPriceIdr;
  const hostingTermDays = plan?.durationDays ?? input.hostingTermDays;
  if (!Number.isSafeInteger(template.priceIdr) || template.priceIdr < 0 || template.priceIdr > 2_147_483_647) return null;
  if (!Number.isSafeInteger(activationPriceIdr) || activationPriceIdr < 0 || activationPriceIdr > 2_147_483_647) return null;
  if (!Number.isSafeInteger(hostingTermDays) || hostingTermDays < (plan ? 1 : 30) || hostingTermDays > 3_650) return null;
  if (plan && !isCustomerPlanSnapshot(plan)) return null;
  if (template.licenseType === "FREE" && template.priceIdr !== 0) return null;
  if (template.licenseType === "PAID_PER_INVITATION" && template.priceIdr === 0) return null;

  const licenseType = template.licenseType;
  const items: CustomerOrderItemDraft[] = [];
  if (template.licenseType === "PAID_PER_INVITATION") {
    items.push({
      itemType: "TEMPLATE_LICENSE",
      sku: `template:${template.slug}@${template.version}`,
      quantity: 1,
      unitPriceIdr: template.priceIdr,
      totalPriceIdr: template.priceIdr,
      templateId: template.id,
      templateVersionId: template.versionId,
      entitlementSnapshot: { features: template.features, licenseType, hostingTermDays, templateSlug: template.slug, templateVersion: template.version, ...(plan ? { plan } : {}) },
    });
  }
  if (activationPriceIdr > 0) {
    items.push({
      itemType: "ACTIVATION",
      sku: `activation:${template.slug}@${template.version}`,
      quantity: 1,
      unitPriceIdr: activationPriceIdr,
      totalPriceIdr: activationPriceIdr,
      templateId: template.id,
      templateVersionId: template.versionId,
      entitlementSnapshot: { features: template.features, licenseType, hostingTermDays, templateSlug: template.slug, templateVersion: template.version, ...(plan ? { plan } : {}) },
    });
  }

  const totalAmountIdr = template.priceIdr + activationPriceIdr;
  if (!Number.isSafeInteger(totalAmountIdr) || totalAmountIdr > 2_147_483_647) return null;
  return { totalAmountIdr, items };
}
