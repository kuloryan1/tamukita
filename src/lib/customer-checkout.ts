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
  };
};

export function buildCustomerCheckoutOrder(input: {
  template: CustomerCheckoutTemplate;
  activationPriceIdr: number;
  hostingTermDays: number;
}) {
  const { template, activationPriceIdr, hostingTermDays } = input;
  if (!Number.isSafeInteger(template.priceIdr) || template.priceIdr < 0 || template.priceIdr > 2_147_483_647) return null;
  if (!Number.isSafeInteger(activationPriceIdr) || activationPriceIdr < 0 || activationPriceIdr > 2_147_483_647) return null;
  if (!Number.isSafeInteger(hostingTermDays) || hostingTermDays < 30 || hostingTermDays > 3_650) return null;
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
      entitlementSnapshot: { features: template.features, licenseType, hostingTermDays, templateSlug: template.slug, templateVersion: template.version },
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
      entitlementSnapshot: { features: template.features, licenseType, hostingTermDays, templateSlug: template.slug, templateVersion: template.version },
    });
  }

  const totalAmountIdr = template.priceIdr + activationPriceIdr;
  if (!Number.isSafeInteger(totalAmountIdr) || totalAmountIdr > 2_147_483_647) return null;
  return { totalAmountIdr, items };
}
