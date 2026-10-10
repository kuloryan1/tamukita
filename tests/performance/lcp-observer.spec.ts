import { expect, test } from "@playwright/test";
import { getLastLcp, hasStableLcp, installLcpObserver } from "./lcp-observer";

test("LCP observer records a candidate and waits for a quiet period", async ({ browser }) => {
  const page = await browser.newPage();
  try {
    await page.addInitScript(installLcpObserver);
    const html = "<!doctype html><html><head><title>LCP fixture</title></head><body><h1 style='font-size:64px'>LCP observer fixture</h1></body></html>";
    await page.goto(`data:text/html,${encodeURIComponent(html)}`, { waitUntil: "load" });
    await page.waitForFunction(hasStableLcp, 1000, { timeout: 5000 });

    const lcp = await page.evaluate(getLastLcp);
    expect(lcp).not.toBeNull();
    expect(lcp).toBeGreaterThan(0);
  } finally {
    await page.close();
  }
});
