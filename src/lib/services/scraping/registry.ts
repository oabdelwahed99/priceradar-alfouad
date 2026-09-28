import { GenericRetailerScraper } from "./retailers/generic.scraper";
import type { RetailerScraper } from "./types";

/**
 * Resolves the scraper for a URL. Retailer-specific scrapers (e.g. AmazonScraper, NoonScraper)
 * are registered ahead of the generic fallback:
 *
 *   scraperRegistry.register(new NoonScraper());
 */
export class ScraperRegistry {
  private readonly scrapers: RetailerScraper[] = [];

  constructor(private readonly fallback: RetailerScraper) {}

  register(scraper: RetailerScraper): this {
    this.scrapers.push(scraper);
    return this;
  }

  resolve(url: string): RetailerScraper {
    return this.scrapers.find((s) => s.canHandle(url)) ?? this.fallback;
  }

  list(): string[] {
    return [...this.scrapers.map((s) => s.name), this.fallback.name];
  }
}

export const scraperRegistry = new ScraperRegistry(new GenericRetailerScraper());
