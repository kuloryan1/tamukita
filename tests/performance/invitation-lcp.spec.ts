import { expect, test } from "@playwright/test";
import { getLastLcp, hasStableLcp, installLcpObserver } from "./lcp-observer";

const invitationPath = process.env.PERF_INVITATION_PATH;
const mobileProfile = {
  latencyMs: 150,
  downloadBytesPerSecond: 1_600_000 / 8,
  uploadBytesPerSecond: 750_000 / 8,
  cpuSlowdownRate: 4,
} as const;

if (!invitationPath || !/^\/[A-Za-z0-9][A-Za-z0-9_-]*$/.test(invitationPath)) {
  throw new Error("Set PERF_INVITATION_PATH to a published invitation path such as /slug-undangan-uji.");
}

test("published invitation mobile LCP p75 is at most 2.5 seconds", async ({ browser, baseURL }) => {
  test.setTimeout(10 * 60 * 1000);
  const samples: number[] = [];
  const sampleCount = 20;
  const invitationUrl = new URL(invitationPath, baseURL);
  const preflightResponse = await fetch(invitationUrl, {
    cache: "no-store",
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
  });
  try {
    expect(preflightResponse.status, "published invitation must return HTTP 200 directly without redirects").toBe(200);
  } finally {
    await preflightResponse.body?.cancel();
  }

  for (let index = 0; index < sampleCount; index += 1) {
    const context = await browser.newContext({
      baseURL,
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    let cdp: Awaited<ReturnType<typeof context.newCDPSession>> | undefined;
    const targetOrigin = invitationUrl.origin;
    const productionHosts = new Set(["tamukita.io", "www.tamukita.io"]);
    if (process.env.PRODUCTION_HEALTH_URL) {
      productionHosts.add(new URL(process.env.PRODUCTION_HEALTH_URL).hostname.toLowerCase());
    }
    for (const host of productionHosts) {
      const escapedHost = host.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      await page.route(new RegExp(`^https?://${escapedHost}(?::\\d+)?(?:/|$)`), (route) => route.abort("blockedbyclient"));
    }
    await page.addInitScript(installLcpObserver);

    try {
      cdp = await context.newCDPSession(page);
      await cdp.send("Network.enable");
      await cdp.send("Network.emulateNetworkConditionsByRule", {
        matchedNetworkConditions: [{
          urlPattern: "",
          latency: mobileProfile.latencyMs,
          downloadThroughput: mobileProfile.downloadBytesPerSecond,
          uploadThroughput: mobileProfile.uploadBytesPerSecond,
          connectionType: "cellular4g",
        }],
      });
      await cdp.send("Network.overrideNetworkState", {
        offline: false,
        latency: mobileProfile.latencyMs,
        downloadThroughput: mobileProfile.downloadBytesPerSecond,
        uploadThroughput: mobileProfile.uploadBytesPerSecond,
        connectionType: "cellular4g",
      });
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: mobileProfile.cpuSlowdownRate });

      const response = await page.goto(invitationPath, { waitUntil: "load" });
      expect(response?.status(), `sample ${index + 1} should load the published invitation`).toBe(200);
      expect(new URL(page.url()).origin, `sample ${index + 1} should remain on the staging origin`).toBe(targetOrigin);
      await page.waitForFunction(
        hasStableLcp,
        1000,
        { timeout: 10_000 },
      );

      const lcp = await page.evaluate(getLastLcp);
      expect(lcp, `sample ${index + 1} should expose a Largest Contentful Paint entry`).not.toBeNull();
      samples.push(lcp as number);
    } finally {
      await cdp?.detach().catch(() => undefined);
      await context.close();
    }
  }

  const orderedSamples = [...samples].sort((left, right) => left - right);
  const p75 = orderedSamples[Math.ceil(sampleCount * 0.75) - 1];
  console.log(JSON.stringify({
    target: invitationUrl.origin,
    path: invitationPath,
    viewport: "390x844 @2x, Chromium mobile emulation",
    browserVersion: browser.version(),
    networkAndCpuThrottling: {
      connectionType: "cellular4g",
      latencyMs: mobileProfile.latencyMs,
      downloadMbps: 1.6,
      uploadKbps: 750,
      cpuSlowdownRate: mobileProfile.cpuSlowdownRate,
    },
    cache: "new browser context per sample",
    sampleCount,
    samplesMs: orderedSamples.map((sample) => Math.round(sample)),
    p75Ms: Math.round(p75),
  }));

  expect(p75).toBeLessThanOrEqual(2500);
});
