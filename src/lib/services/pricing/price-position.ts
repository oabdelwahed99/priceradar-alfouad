import type { PricePosition } from "@/types";

export interface PricePositionThresholds {
  /** Gap (in %) within which a price is MARKET_ALIGNED, inclusive. */
  alignedBand: number;
  /** Gap (in %) beyond which a price is fully UNDER/OVERPRICED, exclusive. */
  strongBand: number;
}

export const DEFAULT_PRICE_POSITION_THRESHOLDS: PricePositionThresholds = {
  alignedBand: 5,
  strongBand: 10,
};

/**
 * Single source of truth for price classification.
 *
 *   gap < -10            UNDERPRICED
 *   -10 <= gap < -5      SLIGHTLY_UNDERPRICED
 *   -5 <= gap <= 5       MARKET_ALIGNED
 *   5 < gap <= 10        SLIGHTLY_OVERPRICED
 *   gap > 10             OVERPRICED
 *
 * Exact boundary values fall into the milder band.
 */
export function getPricePosition(
  priceGapPercentage: number,
  thresholds: PricePositionThresholds = DEFAULT_PRICE_POSITION_THRESHOLDS,
): PricePosition {
  if (!Number.isFinite(priceGapPercentage)) {
    throw new RangeError("Price gap must be a finite number");
  }
  const { alignedBand, strongBand } = thresholds;
  if (priceGapPercentage < -strongBand) return "UNDERPRICED";
  if (priceGapPercentage < -alignedBand) return "SLIGHTLY_UNDERPRICED";
  if (priceGapPercentage <= alignedBand) return "MARKET_ALIGNED";
  if (priceGapPercentage <= strongBand) return "SLIGHTLY_OVERPRICED";
  return "OVERPRICED";
}

export const PRICE_POSITION_LABELS: Record<PricePosition, string> = {
  UNDERPRICED: "Underpriced",
  SLIGHTLY_UNDERPRICED: "Slightly underpriced",
  MARKET_ALIGNED: "Market aligned",
  SLIGHTLY_OVERPRICED: "Slightly overpriced",
  OVERPRICED: "Overpriced",
};
