import type { Browser, BrowserContext, Page } from "playwright";

declare global {
  var __scraperBrowser: Promise<Browser> | undefined;
}

async function launch(): Promise<Browser> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  browser.on("disconnected", () => {
    globalThis.__scraperBrowser = undefined;
  });
  return browser;
}

/** One shared Chromium per server process; each scrape gets an isolated context. */
export async function getBrowser(): Promise<Browser> {
  if (!globalThis.__scraperBrowser) {
    globalThis.__scraperBrowser = launch().catch((error) => {
      globalThis.__scraperBrowser = undefined;
      throw error;
    });
  }
  const browser = await globalThis.__scraperBrowser;
  if (!browser.isConnected()) {
    globalThis.__scraperBrowser = undefined;
    return getBrowser();
  }
  return browser;
}

const BLOCKED_RESOURCE_TYPES = new Set(["image", "media", "font"]);

export async function withPage<T>(
  fn: (page: Page, context: BrowserContext) => Promise<T>,
  { timeoutMs }: { timeoutMs: number },
): Promise<T> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    locale: "en-US",
    viewport: { width: 1366, height: 900 },
    javaScriptEnabled: true,
  });
  context.setDefaultTimeout(timeoutMs);
  context.setDefaultNavigationTimeout(timeoutMs);
  // Skip heavy assets we never read; prices come from HTML/structured data.
  await context.route("**/*", (route) =>
    BLOCKED_RESOURCE_TYPES.has(route.request().resourceType()) ? route.abort() : route.continue(),
  );
  const page = await context.newPage();
  try {
    return await fn(page, context);
  } finally {
    await context.close().catch(() => undefined);
  }
}

export async function closeBrowser(): Promise<void> {
  const pending = globalThis.__scraperBrowser;
  globalThis.__scraperBrowser = undefined;
  if (pending) await (await pending.catch(() => null))?.close().catch(() => undefined);
}
