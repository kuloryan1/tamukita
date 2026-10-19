import type { IntegrationConfiguration, IntegrationConfigurationStatus } from "./integration-status";

export const WORKER_HEARTBEAT_KEY = "tamukita:worker:heartbeat";
export const WORKER_CONFIGURATION_KEY = "tamukita:worker:configuration";
export const WORKER_HEARTBEAT_VALUE = "1";
export const WORKER_HEARTBEAT_TTL_SECONDS = 45;
const workerIntegrationLabels = new Set(["Database URL", "Redis endpoint", "Email Resend", "Media R2"]);
const integrationStatuses = new Set<IntegrationConfigurationStatus>(["configured", "missing", "incomplete", "invalid"]);

export type WorkerIntegrationSnapshot = {
  version: 1;
  checkedAt: string;
  integrations: IntegrationConfiguration[];
};

export function isWorkerHeartbeatActive(value: string | null) {
  return value === WORKER_HEARTBEAT_VALUE;
}

export function createWorkerIntegrationSnapshot(integrations: IntegrationConfiguration[], checkedAt = new Date()): WorkerIntegrationSnapshot {
  return {
    version: 1,
    checkedAt: checkedAt.toISOString(),
    integrations: integrations.filter(({ label }) => workerIntegrationLabels.has(label)),
  };
}

export function parseWorkerIntegrationSnapshot(value: string | null): WorkerIntegrationSnapshot | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    const record = parsed as Record<string, unknown>;
    if (record.version !== 1 || typeof record.checkedAt !== "string" || !Number.isFinite(Date.parse(record.checkedAt)) || !Array.isArray(record.integrations)) return null;
    const integrations = record.integrations;
    if (integrations.length !== workerIntegrationLabels.size) return null;
    const seen = new Set<string>();
    const validated: IntegrationConfiguration[] = [];
    for (const integration of integrations) {
      if (typeof integration !== "object" || integration === null || Array.isArray(integration)) return null;
      const item = integration as Record<string, unknown>;
      if (typeof item.label !== "string" || !workerIntegrationLabels.has(item.label) || seen.has(item.label)) return null;
      if (typeof item.status !== "string" || !integrationStatuses.has(item.status as IntegrationConfigurationStatus)) return null;
      seen.add(item.label);
      validated.push({ label: item.label, status: item.status as IntegrationConfigurationStatus });
    }
    if (seen.size !== workerIntegrationLabels.size) return null;
    return { version: 1, checkedAt: record.checkedAt, integrations: validated };
  } catch {
    return null;
  }
}
