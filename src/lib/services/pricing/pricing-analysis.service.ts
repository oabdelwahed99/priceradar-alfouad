import type { PricePosition } from "@/types";
import { getPricePosition, type PricePositionThresholds } from "./price-position";
import { roundForCurrency, roundPercentage } from "./rounding";

export interface CompetitorPrice {
  id: string;
  price: number;
}

export type InsufficientDataReason = "NO_OWN_PRICE" | "NO_COMPETITOR_PRICES";

export interface PricingAnalysis {
  status: "OK" | "INSUFFICIENT_DATA";
  reason: InsufficientDataReason | null;
  ownPrice: number | null;
  competitorCount: number;
  validCompetitorCount: number;
  invalidCompetitorCount: number;

  marketMinimum: number | null;
  marketMaximum: number | null;
  marketAverage: number | null;
  marketMedian: number | null;

  ownPriceVsAverage: number | null;
  ownPriceVsMedian: number | null;
  ownPriceVsMinimum: number | null;
  ownPriceVsMaximum: number | null;

  /** Gap used for classification: own price vs market median, in %. */
  gapPercentage: number | null;
  position: PricePosition | null;

  cheaperCompetitors: CompetitorPrice[];
  moreExpensiveCompetitors: CompetitorPrice[];
  equalCompetitors: CompetitorPrice[];
}

export const isValidPrice = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

/**
 * ((ownPrice - marketPrice) / marketPrice) * 100
 * Negative: own price is cheaper. Positive: own price is more expensive.
 */
export function priceDifferencePercentage(ownPrice: number, marketPrice: number): number {
  if (!isValidPrice(ownPrice) || !isValidPrice(marketPrice)) {
    throw new RangeError("Prices must be positive finite numbers");
  }
  return ((ownPrice - marketPrice) / marketPrice) * 100;
}

/** How a competitor's price compares with ours, for per-row "Difference" columns. */
export function competitorDifferencePercentage(competitorPrice: number, ownPrice: number): number {
  return roundPercentage(priceDifferencePercentage(competitorPrice, ownPrice));
}

export function calculateMedian(values: readonly number[]): number {
  if (values.length === 0) throw new RangeError("Cannot compute the median of an empty list");
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function calculateAverage(values: readonly number[]): number {
  if (values.length === 0) throw new RangeError("Cannot compute the average of an empty list");
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export interface AnalyzePricingOptions {
  currency?: string | null;
  thresholds?: PricePositionThresholds;
}

/**
 * Deterministic market comparison. Market statistics use competitor prices only; invalid
 * (zero, negative, non-finite) prices are ignored and counted.
 */
export function analyzePricing(
  ownPrice: number | null | undefined,
  competitorPrices: readonly (number | CompetitorPrice | null | undefined)[],
  { currency = null, thresholds }: AnalyzePricingOptions = {},
): PricingAnalysis {
  const normalized = competitorPrices.map((c, i) =>
    typeof c === "object" && c !== null ? c : { id: String(i), price: c as number },
  );
  const valid = normalized.filter((c): c is CompetitorPrice => isValidPrice(c.price));
  const own = isValidPrice(ownPrice) ? ownPrice : null;
  const money = (v: number) => roundForCurrency(v, currency);

  const base: PricingAnalysis = {
    status: "INSUFFICIENT_DATA",
    reason: null,
    ownPrice: own,
    competitorCount: competitorPrices.length,
    validCompetitorCount: valid.length,
    invalidCompetitorCount: competitorPrices.length - valid.length,
    marketMinimum: null,
    marketMaximum: null,
    marketAverage: null,
    marketMedian: null,
    ownPriceVsAverage: null,
    ownPriceVsMedian: null,
    ownPriceVsMinimum: null,
    ownPriceVsMaximum: null,
    gapPercentage: null,
    position: null,
    cheaperCompetitors: [],
    moreExpensiveCompetitors: [],
    equalCompetitors: [],
  };

  if (valid.length === 0) {
    return { ...base, reason: own === null ? "NO_OWN_PRICE" : "NO_COMPETITOR_PRICES" };
  }

  const prices = valid.map((c) => c.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const average = calculateAverage(prices);
  const median = calculateMedian(prices);

  const withMarket: PricingAnalysis = {
    ...base,
    marketMinimum: money(min),
    marketMaximum: money(max),
    marketAverage: money(average),
    marketMedian: money(median),
  };

  if (own === null) {
    return { ...withMarket, reason: "NO_OWN_PRICE" };
  }

  const vsMedian = roundPercentage(priceDifferencePercentage(own, median));
  return {
    ...withMarket,
    status: "OK",
    ownPriceVsAverage: roundPercentage(priceDifferencePercentage(own, average)),
    ownPriceVsMedian: vsMedian,
    ownPriceVsMinimum: roundPercentage(priceDifferencePercentage(own, min)),
    ownPriceVsMaximum: roundPercentage(priceDifferencePercentage(own, max)),
    gapPercentage: vsMedian,
    position: getPricePosition(vsMedian, thresholds),
    cheaperCompetitors: valid.filter((c) => c.price < own),
    moreExpensiveCompetitors: valid.filter((c) => c.price > own),
    equalCompetitors: valid.filter((c) => c.price === own),
  };
}
