import { getScraperSettings } from "@/lib/env";
import { DomainRateLimiter, runWithConcurrency } from "./queue";
import { scraperRegistry, type ScraperRegistry } from "./registry";
import { getRobotsPolicy } from "./robots";
import type { RetailerScraper, ScrapedContent, ScrapedProduct, ScrapeFailure } from "./types";
import { classifyScrapeError } from "./utils";

const MAX_CONCURRENCY = 5;

declare global {
  var __domainRateLimiter: DomainRateLimiter | undefined;
}

function getRateLimiter(): DomainRateLimiter {
  globalThis.__domainRateLimiter ??= new DomainRateLimiter(getScraperSettings().SCRAPER_DOMAIN_DELAY_MS);
  return globalThis.__domainRateLimiter;
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return url;
  }
}

async function politeDelayMs(url: string, defaultMs: number): Promise<number> {
  try {
    const robots = await getRobotsPolicy(url);
    if (robots.crawlDelaySeconds !== null) {
      return Math.min(Math.max(defaultMs, robots.crawlDelaySeconds * 1000), 30_000);
    }
  } catch {
    // Robots lookup failures are handled by the scraper itself.
  }
  return defaultMs;
}

function failure(url: string, error: unknown): ScrapeFailure {
  const { code, message } = classifyScrapeError(error);
  return { success: false, url, error: message, errorCode: code, scrapedAt: new Date().toISOString() };
}

type ScrapeOperation<T> = (scraper: RetailerScraper, url: string) => Promise<T>;

/** Runs one scrape after the per-domain delay. Never throws: failures are returned as `{ success: false }`. */
async function runOne<T>(url: string, op: ScrapeOperation<T>, registry: ScraperRegistry): Promise<T | ScrapeFailure> {
  const settings = getScraperSettings();
  try {
    await getRateLimiter().acquire(domainOf(url), await politeDelayMs(url, settings.SCRAPER_DOMAIN_DELAY_MS));
    return await op(registry.resolve(url), url);
  } catch (error) {
    return failure(url, error);
  }
}

interface ScrapeManyOptions {
  concurrency?: number;
  registry?: ScraperRegistry;
}

async function runMany<T>(
  urls: readonly string[],
  op: ScrapeOperation<T>,
  { concurrency, registry = scraperRegistry }: ScrapeManyOptions,
): Promise<(T | ScrapeFailure)[]> {
  const limit = Math.min(concurrency ?? getScraperSettings().SCRAPER_CONCURRENCY, MAX_CONCURRENCY);
  const settled = await runWithConcurrency(urls, limit, (url) => runOne(url, op, registry));
  return settled.map((r, i) => (r.status === "fulfilled" ? r.value : failure(urls[i], r.reason)));
}

export async function scrapeUrl(url: string, registry: ScraperRegistry = scraperRegistry): Promise<ScrapedProduct> {
  return runOne(url, (s, u) => s.scrape(u), registry);
}

/**
 * Scrapes many URLs with bounded concurrency (SCRAPER_CONCURRENCY, max 5) and per-domain
 * spacing. Results keep input order; one failure never affects the others.
 */
export async function scrapeMany(urls: readonly string[], options: ScrapeManyOptions = {}): Promise<ScrapedProduct[]> {
  return runMany(urls, (s, u) => s.scrape(u), options);
}

/** Like `scrapeMany`, but reads only page content, so pages without a detectable price still succeed. */
export async function scrapeContentMany(urls: readonly string[], options: ScrapeManyOptions = {}): Promise<ScrapedContent[]> {
  return runMany(urls, (s, u) => s.scrapeContent(u), options);
}
