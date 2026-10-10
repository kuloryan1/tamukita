type LcpWindow = typeof window & {
  __tamukitaLcpEntries?: number[];
  __tamukitaLcpUpdatedAt?: number;
};

export function installLcpObserver() {
  const lcpWindow = window as LcpWindow & { __tamukitaLcpEntries: number[]; __tamukitaLcpUpdatedAt: number };
  lcpWindow.__tamukitaLcpEntries = [];
  new PerformanceObserver((list) => {
    const entries = list.getEntries();
    lcpWindow.__tamukitaLcpEntries.push(...entries.map((entry) => entry.startTime));
    lcpWindow.__tamukitaLcpUpdatedAt = performance.now();
  }).observe({ type: "largest-contentful-paint", buffered: true });
}

export function hasStableLcp(quietPeriodMs: number) {
  const lcpWindow = window as LcpWindow;
  return (lcpWindow.__tamukitaLcpEntries?.length ?? 0) > 0
    && performance.now() - (lcpWindow.__tamukitaLcpUpdatedAt ?? performance.now()) >= quietPeriodMs;
}

export function getLastLcp() {
  const lcpWindow = window as LcpWindow;
  return lcpWindow.__tamukitaLcpEntries?.at(-1) ?? null;
}
