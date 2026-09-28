import type { Page } from "playwright";
import { getScraperSettings } from "@/lib/env";
import { withPage } from "../browser";
import { analyzeContentPage, analyzeProductPage, type PageSnapshot } from "../page-analysis";
import { DEFAULT_PRICE_STRATEGIES } from "../price-extractor";
import { getRobotsPolicy } from "../robots";
import type { PriceStrategy, RetailerScraper, ScrapedContent, ScrapedProduct, ScrapeFailure } from "../types";
import { ScrapeError } from "../types";
import { assertScrapableUrl, classifyScrapeError, SCRAPE_ERROR_MESSAGES } from "../utils";

const PRICE_READY_SELECTOR = [
  'script[type="application/ld+json"]',
  '[itemprop="price"]',
  'meta[property="product:price:amount"]',
  "[data-price]",
  '[class*="price" i]',
].join(", ");

export interface GenericScraperOptions {
  timeoutMs?: number;
  respectRobotsTxt?: boolean;
  allowPrivateHosts?: boolean;
  strategies?: PriceStrategy[];
}

/**
 * Works on any retailer by rendering the page in Chromium and running the extraction chain.
 * Retailer-specific scrapers can extend this and override `strategies` or `waitForContent`.
 */
export class GenericRetailerScraper implements RetailerScraper {
  readonly name: string = "generic";
  protected readonly options: Required<Omit<GenericScraperOptions, "timeoutMs">> & { timeoutMs?: number };

  constructor(options: GenericScraperOptions = {}) {
    this.options = {
      respectRobotsTxt: true,
      allowPrivateHosts: false,
      strategies: DEFAULT_PRICE_STRATEGIES,
      ...options,
    };
  }

  canHandle(): boolean {
    return true;
  }

  protected get timeoutMs(): number {
    return this.options.timeoutMs ?? getScraperSettings().SCRAPER_TIMEOUT_MS;
  }

  /** Wait for JS-rendered content: network settle (bounded), then any price-like element. */
  protected async waitForContent(page: Page): Promise<void> {
    await page.waitForLoadState("networkidle", { timeout: Math.min(8_000, this.timeoutMs) }).catch(() => undefined);
    await page.waitForSelector(PRICE_READY_SELECTOR, { timeout: 5_000, state: "attached" }).catch(() => undefined);
  }

  /** Validates the URL, honours robots.txt and renders the page. Throws ScrapeError or browser errors. */
  protected async loadPage(url: string): Promise<PageSnapshot> {
    assertScrapableUrl(url, { allowPrivateHosts: this.options.allowPrivateHosts });

    if (this.options.respectRobotsTxt) {
      const robots = await getRobotsPolicy(url);
      if (!robots.isAllowed(url)) {
        throw new ScrapeError("ROBOTS_DISALLOWED", SCRAPE_ERROR_MESSAGES.ROBOTS_DISALLOWED);
      }
    }

    return withPage(
      async (page): Promise<PageSnapshot> => {
        const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: this.timeoutMs });
        await this.waitForContent(page);
        const [html, title, visibleText] = await Promise.all([
          page.content(),
          page.title().catch(() => ""),
          page.evaluate(() => document.body?.innerText ?? "").catch(() => ""),
        ]);
        return {
          url,
          finalUrl: page.url(),
          html,
          title,
          visibleText,
          httpStatus: response?.status() ?? null,
        };
      },
      { timeoutMs: this.timeoutMs },
    );
  }

  private failure(url: string, error: unknown): ScrapeFailure {
    const { code, message } = classifyScrapeError(error);
    if (code === "UNKNOWN" || code === "RENDER_FAILURE") {
      console.error(`[scraper:${this.name}] ${url}:`, error);
    }
    return { success: false, url, error: message, errorCode: code, scrapedAt: new Date().toISOString() };
  }

  async scrape(url: string): Promise<ScrapedProduct> {
    try {
      return analyzeProductPage(await this.loadPage(url), this.options.strategies);
    } catch (error) {
      return this.failure(url, error);
    }
  }

  async scrapeContent(url: string): Promise<ScrapedContent> {
    try {
      return analyzeContentPage(await this.loadPage(url));
    } catch (error) {
      return this.failure(url, error);
    }
  }
}
