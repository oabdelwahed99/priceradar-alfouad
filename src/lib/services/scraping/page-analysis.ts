import { extractPageContent } from "./content-extractor";
import { extractPrice, DEFAULT_PRICE_STRATEGIES } from "./price-extractor";
import { createExtractionContext, extractProductInfo } from "./product-extractor";
import type { ContentScrapeSuccess, PageContent, PriceStrategy, ScrapeSuccess, ScrapeWarning } from "./types";
import { ScrapeError } from "./types";
import { SCRAPE_ERROR_MESSAGES } from "./utils";

const BLOCK_TITLE_RE = /(just a moment|attention required|access denied|robot check|are you a robot|security check|pardon our interruption|request blocked)/i;
const BLOCK_TEXT_RE = /(verify you are (a )?human|unusual traffic|enable cookies to continue|captcha|press (and|&) hold|bot detection)/i;

export interface PageSnapshot {
  url: string;
  finalUrl: string;
  html: string;
  title: string;
  visibleText: string;
  httpStatus: number | null;
}

/** Throws a ScrapeError when the response is an error page, bot check or empty document. */
export function assertUsablePage(snapshot: PageSnapshot): void {
  const status = snapshot.httpStatus;
  const text = snapshot.visibleText.replace(/\s+/g, " ").trim();

  if (status === 401 || status === 403 || status === 429) {
    throw new ScrapeError("BLOCKED", `${SCRAPE_ERROR_MESSAGES.BLOCKED} (HTTP ${status})`);
  }
  if (status === 404 || status === 410) {
    throw new ScrapeError("UNAVAILABLE", `The product page was not found (HTTP ${status}).`);
  }
  if (status !== null && status >= 500) {
    const challenge = BLOCK_TITLE_RE.test(snapshot.title) || BLOCK_TEXT_RE.test(text.slice(0, 2000));
    throw new ScrapeError(
      challenge ? "BLOCKED" : "UNAVAILABLE",
      challenge ? SCRAPE_ERROR_MESSAGES.BLOCKED : `The website returned an error (HTTP ${status}).`,
    );
  }
  if (BLOCK_TITLE_RE.test(snapshot.title) || (text.length < 1500 && BLOCK_TEXT_RE.test(text))) {
    throw new ScrapeError("BLOCKED", SCRAPE_ERROR_MESSAGES.BLOCKED);
  }
  if (text.length < 10 && !/application\/ld\+json|itemprop=|product:price/i.test(snapshot.html)) {
    throw new ScrapeError("EMPTY_PAGE", SCRAPE_ERROR_MESSAGES.EMPTY_PAGE);
  }
}

/** Pure HTML -> ScrapeSuccess conversion shared by all browser-based scrapers. */
export function analyzeProductPage(
  snapshot: PageSnapshot,
  strategies: PriceStrategy[] = DEFAULT_PRICE_STRATEGIES,
): ScrapeSuccess {
  assertUsablePage(snapshot);
  const ctx = createExtractionContext(snapshot.html, snapshot.finalUrl);
  const price = extractPrice(ctx, strategies);
  if (!price) {
    throw new ScrapeError("PRICE_NOT_FOUND", SCRAPE_ERROR_MESSAGES.PRICE_NOT_FOUND);
  }
  const info = extractProductInfo(ctx);
  let content: PageContent | null = null;
  try {
    content = extractPageContent(ctx);
  } catch (error) {
    console.error(`[scraper] content extraction failed for ${snapshot.finalUrl}:`, error);
  }
  const warnings: ScrapeWarning[] = [];
  if (!price.currency) warnings.push("CURRENCY_NOT_FOUND");
  if (price.availability === "unknown") warnings.push("AVAILABILITY_UNKNOWN");
  if (price.lowPrice !== null && price.highPrice !== null) warnings.push("PRICE_RANGE");

  return {
    success: true,
    url: snapshot.url,
    finalUrl: snapshot.finalUrl,
    productName: info.productName,
    brand: info.brand,
    price: price.price,
    currency: price.currency,
    originalPrice: price.originalPrice,
    lowPrice: price.lowPrice,
    highPrice: price.highPrice,
    availability: price.availability,
    imageUrl: info.imageUrl,
    strategy: price.strategy,
    warnings,
    content,
    scrapedAt: new Date().toISOString(),
  };
}

/** Content-only analysis: same page checks as price scraping, but a missing price is not an error. */
export function analyzeContentPage(snapshot: PageSnapshot): ContentScrapeSuccess {
  assertUsablePage(snapshot);
  return {
    success: true,
    url: snapshot.url,
    finalUrl: snapshot.finalUrl,
    content: extractPageContent(createExtractionContext(snapshot.html, snapshot.finalUrl)),
    scrapedAt: new Date().toISOString(),
  };
}
