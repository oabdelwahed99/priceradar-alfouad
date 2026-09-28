import type { PricePosition } from "@/types";
import type { PricingAnalysis } from "./pricing-analysis.service";
import { roundForCurrency, roundPercentage } from "./rounding";

/** Rule table: multiplier applied to the market median, or KEEP the current price. */
export const SUGGESTED_PRICE_RULES: Record<PricePosition, number | "KEEP"> = {
  UNDERPRICED: 0.98,
  SLIGHTLY_UNDERPRICED: 0.99,
  MARKET_ALIGNED: "KEEP",
  SLIGHTLY_OVERPRICED: 1,
  OVERPRICED: 1.02,
};

export const SUGGESTED_PRICE_DISCLAIMER = "Suggested price is based on observed competitor prices only.";

export interface SuggestedPriceInput {
  position: PricePosition;
  currentPrice: number;
  marketMedian: number;
  currency?: string | null;
}

export function getSuggestedPrice({ position, currentPrice, marketMedian, currency = null }: SuggestedPriceInput): number {
  const rule = SUGGESTED_PRICE_RULES[position];
  const raw = rule === "KEEP" ? currentPrice : marketMedian * rule;
  return roundForCurrency(raw, currency);
}

export interface PricingRecommendation {
  suggestedPrice: number;
  position: PricePosition;
  basis: "MARKET_MEDIAN" | "CURRENT_PRICE";
  multiplier: number | null;
  changeAmount: number;
  changePercentage: number;
  explanation: string;
  disclaimer: string;
}

function describe(position: PricePosition, gap: number, multiplier: number | null): string {
  const absGap = Math.abs(gap).toFixed(2);
  const where = gap < 0 ? `${absGap}% below` : gap > 0 ? `${absGap}% above` : "equal to";
  if (multiplier === null) {
    return `Your price is ${where} the market median, within the market-aligned band. Keep the current price.`;
  }
  const pct = Math.round(multiplier * 100);
  const target = pct === 100 ? "the market median" : `${pct}% of the market median`;
  return `Your price is ${where} the market median (${position.toLowerCase().replace(/_/g, " ")}). Suggested price is ${target}.`;
}

/**
 * Rule-based market-position recommendation. It does not account for cost, margin, demand or
 * strategy and must not be presented as an optimal price.
 */
export const PricingRecommendationService = {
  recommend(analysis: PricingAnalysis, currency: string | null = null): PricingRecommendation | null {
    if (
      analysis.status !== "OK" ||
      analysis.position === null ||
      analysis.ownPrice === null ||
      analysis.marketMedian === null ||
      analysis.gapPercentage === null
    ) {
      return null;
    }
    const rule = SUGGESTED_PRICE_RULES[analysis.position];
    const multiplier = rule === "KEEP" ? null : rule;
    const suggestedPrice = getSuggestedPrice({
      position: analysis.position,
      currentPrice: analysis.ownPrice,
      marketMedian: analysis.marketMedian,
      currency,
    });
    const changeAmount = roundForCurrency(suggestedPrice - analysis.ownPrice, currency);
    return {
      suggestedPrice,
      position: analysis.position,
      basis: multiplier === null ? "CURRENT_PRICE" : "MARKET_MEDIAN",
      multiplier,
      changeAmount,
      changePercentage: roundPercentage((changeAmount / analysis.ownPrice) * 100),
      explanation: describe(analysis.position, analysis.gapPercentage, multiplier),
      disclaimer: SUGGESTED_PRICE_DISCLAIMER,
    };
  },
};
