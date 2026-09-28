import type { CheerioAPI } from "cheerio";
import type { Availability, ScrapeErrorCode } from "@/types";

export type ExtractionStrategyName =
  | "json-ld"
  | "microdata"
  | "meta"
  | "attributes"
  | "selectors"
  | "visible-text"
  | (string & {});

export type ScrapeWarning = "CURRENCY_NOT_FOUND" | "AVAILABILITY_UNKNOWN" | "PRICE_RANGE";

export interface ScrapeSuccess {
  success: true;
  url: string;
  finalUrl: string;
  productName: string | null;
  brand: string | null;
  price: number;
  currency: string | null;
  originalPrice: number | null;
  lowPrice: number | null;
  highPrice: number | null;
  availability: Availability;
  imageUrl: string | null;
  strategy: ExtractionStrategyName;
  warnings: ScrapeWarning[];
  /** Page copy and SEO metadata; null when it could not be read. Never affects price extraction. */
  content: PageContent | null;
  scrapedAt: string;
}

export interface PageContent {
  title: string | null;
  metaDescription: string | null;
  /** Longest product description found (structured data or the page's description block), as plain text. */
  description: string | null;
  headings: { h1: string[]; h2: string[]; h3: string[] };
  bulletPoints: string[];
  faqQuestions: string[];
  rating: { value: number | null; count: number | null } | null;
  images: { total: number; withAlt: number };
  language: string | null;
}

export interface ScrapeFailure {
  success: false;
  url: string;
  error: string;
  errorCode: ScrapeErrorCode;
  scrapedAt: string;
}

export type ScrapedProduct = ScrapeSuccess | ScrapeFailure;

/** Content-only scrape: the page's copy, with no price required. */
export interface ContentScrapeSuccess {
  success: true;
  url: string;
  finalUrl: string;
  content: PageContent;
  scrapedAt: string;
}

export type ScrapedContent = ContentScrapeSuccess | ScrapeFailure;

export interface RetailerScraper {
  readonly name: string;
  canHandle(url: string): boolean;
  scrape(url: string): Promise<ScrapedProduct>;
  scrapeContent(url: string): Promise<ScrapedContent>;
}

/** Parsed page handed to extractors. Extractors are pure functions over this context. */
export interface ExtractionContext {
  $: CheerioAPI;
  url: string;
  structuredData: StructuredProduct[];
}

export interface StructuredOffer {
  price: number | null;
  currency: string | null;
  originalPrice: number | null;
  lowPrice: number | null;
  highPrice: number | null;
  availability: Availability;
  url: string | null;
}

export interface StructuredProduct {
  name: string | null;
  brand: string | null;
  image: string | null;
  sku: string | null;
  description: string | null;
  rating: { value: number | null; count: number | null } | null;
  offers: StructuredOffer[];
}

export interface PriceCandidate {
  price: number;
  currency: string | null;
  originalPrice: number | null;
  lowPrice: number | null;
  highPrice: number | null;
  availability: Availability;
  strategy: ExtractionStrategyName;
}

export type PriceStrategy = {
  name: ExtractionStrategyName;
  extract(ctx: ExtractionContext): PriceCandidate | null;
};

export interface ProductInfo {
  productName: string | null;
  brand: string | null;
  imageUrl: string | null;
}

export class ScrapeError extends Error {
  constructor(
    readonly code: ScrapeErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ScrapeError";
  }
}
