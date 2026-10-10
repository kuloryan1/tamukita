import "dotenv/config";

const RULE_ID = "tamukita-private-pending-expire-after-one-day";
const PENDING_PREFIX = "private/pending/";
const ONE_DAY_SECONDS = 24 * 60 * 60;

type LifecycleRule = {
  id: string;
  conditions: { prefix: string };
  enabled: boolean;
  abortMultipartUploadsTransition: { condition: { maxAge: number; type: "Age" } };
  deleteObjectsTransition: { condition: { maxAge: number; type: "Age" } };
};

type CloudflareResponse = {
  success?: boolean;
  errors?: Array<{ message?: string }>;
  result?: { rules?: unknown[] };
};

const desiredRule: LifecycleRule = {
  id: RULE_ID,
  conditions: { prefix: PENDING_PREFIX },
  enabled: true,
  abortMultipartUploadsTransition: {
    condition: { maxAge: ONE_DAY_SECONDS, type: "Age" },
  },
  deleteObjectsTransition: {
    condition: { maxAge: ONE_DAY_SECONDS, type: "Age" },
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function matchesDesiredRule(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const conditions = value.conditions;
  const abortTransition = value.abortMultipartUploadsTransition;
  const deleteTransition = value.deleteObjectsTransition;
  if (!isRecord(conditions) || !isRecord(abortTransition) || !isRecord(deleteTransition)) return false;
  const abortCondition = abortTransition.condition;
  const deleteCondition = deleteTransition.condition;
  if (!isRecord(abortCondition) || !isRecord(deleteCondition)) return false;

  return value.id === RULE_ID
    && conditions.prefix === PENDING_PREFIX
    && value.enabled === true
    && abortCondition.maxAge === ONE_DAY_SECONDS
    && abortCondition.type === "Age"
    && deleteCondition.maxAge === ONE_DAY_SECONDS
    && deleteCondition.type === "Age";
}

async function requestLifecycleRules(url: string, token: string, method: "GET" | "PUT", rules?: unknown[]) {
  const response = await fetch(url, {
    method,
    signal: AbortSignal.timeout(15_000),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    ...(rules ? { body: JSON.stringify({ rules }) } : {}),
  });
  const payload = await response.json() as CloudflareResponse;
  if (!response.ok || payload.success !== true) {
    const details = payload.errors?.map((error) => error.message).filter(Boolean).join("; ");
    throw new Error(`Cloudflare R2 lifecycle ${method} gagal (${response.status})${details ? `: ${details}` : "."}`);
  }
  return payload;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some((argument) => argument !== "--apply")) {
    throw new Error("Gunakan tanpa argumen untuk melihat perubahan, atau tambahkan --apply untuk menerapkannya.");
  }

  const accountId = process.env.R2_ACCOUNT_ID;
  const bucket = process.env.R2_PRIVATE_BUCKET_NAME || process.env.R2_BUCKET_NAME;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !bucket || !token) {
    throw new Error("Atur R2_ACCOUNT_ID, R2_PRIVATE_BUCKET_NAME (atau R2_BUCKET_NAME), dan CLOUDFLARE_API_TOKEN.");
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/r2/buckets/${encodeURIComponent(bucket)}/lifecycle`;
  const current = await requestLifecycleRules(url, token, "GET");
  const existingRules = current.result?.rules ?? [];
  if (!Array.isArray(existingRules)) throw new Error("Respons Cloudflare berisi daftar lifecycle rules yang tidak valid.");

  const conflictingRule = existingRules.find((rule) => isRecord(rule) && rule.id === RULE_ID && !matchesDesiredRule(rule));
  if (conflictingRule && (!isRecord(conflictingRule) || !isRecord(conflictingRule.conditions) || conflictingRule.conditions.prefix !== PENDING_PREFIX)) {
    throw new Error(`Rule ID ${RULE_ID} sudah dipakai oleh aturan lain. Selesaikan konflik itu di Cloudflare sebelum melanjutkan.`);
  }

  const existingRuleIndex = existingRules.findIndex((rule) => isRecord(rule) && rule.id === RULE_ID);
  const alreadyConfigured = existingRuleIndex >= 0 && matchesDesiredRule(existingRules[existingRuleIndex]);
  const nextRules = existingRuleIndex >= 0
    ? existingRules.map((rule, index) => index === existingRuleIndex ? desiredRule : rule)
    : [...existingRules, desiredRule];

  console.log(`Bucket: ${bucket}`);
  console.log(`Aturan: ${JSON.stringify(desiredRule, null, 2)}`);
  console.log(`Aturan bucket lain yang dipertahankan: ${existingRules.length - (existingRuleIndex >= 0 ? 1 : 0)}`);

  if (alreadyConfigured) {
    console.log("Lifecycle rule sudah sesuai; tidak ada perubahan.");
    return;
  }

  if (!args.includes("--apply")) {
    console.log("Dry run selesai. Jalankan ulang dengan --apply untuk menerapkan perubahan.");
    return;
  }

  await requestLifecycleRules(url, token, "PUT", nextRules);
  console.log("Lifecycle rule R2 berhasil diterapkan.");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
