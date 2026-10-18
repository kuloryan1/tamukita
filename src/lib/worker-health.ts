export const WORKER_HEARTBEAT_KEY = "tamukita:worker:heartbeat";
export const WORKER_HEARTBEAT_VALUE = "1";
export const WORKER_HEARTBEAT_TTL_SECONDS = 45;

export function isWorkerHeartbeatActive(value: string | null) {
  return value === WORKER_HEARTBEAT_VALUE;
}
