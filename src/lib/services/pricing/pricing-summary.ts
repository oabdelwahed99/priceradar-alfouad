import type { AnalysisSnapshot, Availability } from "@/types";
import { analyzePricing, isValidPrice, type PricingAnalysis } from "./pricing-analysis.service";
import { PricingRecommendationService, type PricingRecommendation } from "./pricing-recommendation.service";

export interface SourcePriceInput {
  sourceId: string;
  isOwnStore: boolean;
  success: boolean;
  price: number | null;
  currency: string | null;
  availability: Availability | null;
}

export type ExclusionReason = "FAILED" | "INVALID_PRICE" | "OUT_OF_STOCK" | "CURRENCY_MISMATCH";

export interface MarketSelection {
  currency: string | null;
  own: SourcePriceInput | null;
  included: SourcePriceInput[];
  excluded: { source: SourcePriceInput; reason: ExclusionReason }[];
}

export const EXCLUSION_MESSAGES: Record<ExclusionReason, string> = {
  FAILED: "No price (scrape failed)",
  INVALID_PRICE: "Invalid price",
  OUT_OF_STOCK: "Out of stock: excluded from market statistics",
  CURRENCY_MISMATCH: "Different currency: excluded from market statistics",
};

function mostCommon(values: string[]): string | null {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: string | null = null;
  let bestCount = 0;
  for (const [v, c] of counts) if (c > bestCount) [best, bestCount] = [v, c];
  return best;
}

/**
 * Decides which competitor prices form "the market". Reference currency is the own store's
 * currency (or the most common competitor currency); sources without a detected currency are
 * assumed to use it. Out-of-stock competitors are excluded unless `includeOutOfStock`.
 */
export function selectMarketPrices(
  sources: readonly SourcePriceInput[],
  { includeOutOfStock = false }: { includeOutOfStock?: boolean } = {},
): MarketSelection {
  const ownCandidate = sources.find((s) => s.isOwnStore) ?? null;
  const own = ownCandidate && ownCandidate.success && isValidPrice(ownCandidate.price) ? ownCandidate : null;
  const competitors = sources.filter((s) => !s.isOwnStore);

  const currency =
    own?.currency ??
    mostCommon(competitors.filter((c) => c.success && c.currency).map((c) => c.currency!)) ??
    null;

  const included: SourcePriceInput[] = [];
  const excluded: MarketSelection["excluded"] = [];
  for (const c of competitors) {
    if (!c.success || c.price === null) excluded.push({ source: c, reason: "FAILED" });
    else if (!isValidPrice(c.price)) excluded.push({ source: c, reason: "INVALID_PRICE" });
    else if (currency && c.currency && c.currency !== currency) excluded.push({ source: c, reason: "CURRENCY_MISMATCH" });
    else if (!includeOutOfStock && c.availability === "out_of_stock") excluded.push({ source: c, reason: "OUT_OF_STOCK" });
    else included.push(c);
  }
  return { currency, own, included, excluded };
}

export interface PricingSummary {
  selection: MarketSelection;
  analysis: PricingAnalysis;
  recommendation: PricingRecommendation | null;
  snapshot: AnalysisSnapshot;
}

export function buildPricingSummary(sources: readonly SourcePriceInput[], computedAt = new Date()): PricingSummary {
  const selection = selectMarketPrices(sources);
  const analysis = analyzePricing(
    selection.own?.price ?? null,
    selection.included.map((c) => ({ id: c.sourceId, price: c.price! })),
    { currency: selection.currency },
  );
  const recommendation = PricingRecommendationService.recommend(analysis, selection.currency);

  return {
    selection,
    analysis,
    recommendation,
    snapshot: {
      status: analysis.status,
      ownPrice: analysis.ownPrice,
      currency: selection.currency,
      marketMinimum: analysis.marketMinimum,
      marketMaximum: analysis.marketMaximum,
      marketAverage: analysis.marketAverage,
      marketMedian: analysis.marketMedian,
      gapPercentage: analysis.gapPercentage,
      position: analysis.position,
      suggestedPrice: recommendation?.suggestedPrice ?? null,
      competitorCount: sources.filter((s) => !s.isOwnStore).length,
      successfulCompetitorCount: selection.included.length,
      computedAt,
    },
  };
}
