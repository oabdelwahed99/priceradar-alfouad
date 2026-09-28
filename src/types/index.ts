export const PRICE_POSITIONS = [
  "UNDERPRICED",
  "SLIGHTLY_UNDERPRICED",
  "MARKET_ALIGNED",
  "SLIGHTLY_OVERPRICED",
  "OVERPRICED",
] as const;
export type PricePosition = (typeof PRICE_POSITIONS)[number];

export const AVAILABILITY_VALUES = [
  "in_stock",
  "out_of_stock",
  "preorder",
  "limited",
  "unknown",
] as const;
export type Availability = (typeof AVAILABILITY_VALUES)[number];

/** How a price observation was obtained: scraped live, or entered by hand (e.g. a spreadsheet import). */
export const OBSERVATION_ORIGINS = ["scrape", "manual"] as const;
export type ObservationOrigin = (typeof OBSERVATION_ORIGINS)[number];

export const SCRAPING_STATUSES = ["pending", "success", "failed"] as const;
export type ScrapingStatus = (typeof SCRAPING_STATUSES)[number];

export const SCRAPE_ERROR_CODES = [
  "INVALID_URL",
  "ROBOTS_DISALLOWED",
  "TIMEOUT",
  "UNAVAILABLE",
  "BLOCKED",
  "EMPTY_PAGE",
  "RENDER_FAILURE",
  "PRICE_NOT_FOUND",
  "CURRENCY_NOT_FOUND",
  "UNKNOWN",
] as const;
export type ScrapeErrorCode = (typeof SCRAPE_ERROR_CODES)[number];

export const ALERT_TYPES = [
  "PRICE_CHANGE",
  "OVERPRICED",
  "UNDERPRICED",
  "OUT_OF_STOCK",
  "CONTENT_CHANGE",
] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

export const ALERT_STATUSES = ["new", "read", "dismissed"] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

export const HISTORY_RANGES = ["7d", "30d", "90d", "6m", "1y"] as const;
export type HistoryRange = (typeof HISTORY_RANGES)[number];

export type AnalysisStatus = "OK" | "INSUFFICIENT_DATA";

/** Denormalized snapshot of the latest comparison, stored on Product for list/dashboard queries. */
export interface AnalysisSnapshot {
  status: AnalysisStatus;
  ownPrice: number | null;
  currency: string | null;
  marketMinimum: number | null;
  marketMaximum: number | null;
  marketAverage: number | null;
  marketMedian: number | null;
  gapPercentage: number | null;
  position: PricePosition | null;
  suggestedPrice: number | null;
  competitorCount: number;
  successfulCompetitorCount: number;
  computedAt: Date;
}
