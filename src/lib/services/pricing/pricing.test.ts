import { describe, expect, it } from "vitest";
import { getPricePosition } from "./price-position";
import {
  analyzePricing,
  calculateAverage,
  calculateMedian,
  competitorDifferencePercentage,
  priceDifferencePercentage,
} from "./pricing-analysis.service";
import { getSuggestedPrice, PricingRecommendationService, SUGGESTED_PRICE_DISCLAIMER } from "./pricing-recommendation.service";
import { buildPricingSummary, selectMarketPrices, type SourcePriceInput } from "./pricing-summary";
import { currencyFractionDigits, roundForCurrency, roundTo } from "./rounding";

describe("median and average", () => {
  it("computes median for odd and even counts", () => {
    expect(calculateMedian([35, 31, 37])).toBe(35);
    expect(calculateMedian([30, 32, 36, 40])).toBe(34);
    expect(calculateMedian([42])).toBe(42);
  });

  it("computes the average", () => {
    expect(roundTo(calculateAverage([35, 31, 37]), 2)).toBe(34.33);
  });

  it("rejects empty input", () => {
    expect(() => calculateMedian([])).toThrow(RangeError);
    expect(() => calculateAverage([])).toThrow(RangeError);
  });
});

describe("priceDifferencePercentage", () => {
  it("matches the spec example: own 32 vs median 35 = -8.57%", () => {
    expect(roundTo(priceDifferencePercentage(32, 35), 2)).toBe(-8.57);
  });

  it("is positive when our price is higher", () => {
    expect(roundTo(priceDifferencePercentage(40, 35), 2)).toBe(14.29);
  });

  it("computes per-competitor differences relative to our price", () => {
    expect(competitorDifferencePercentage(35, 32)).toBe(9.38);
    expect(competitorDifferencePercentage(31, 32)).toBe(-3.13);
    expect(competitorDifferencePercentage(37, 32)).toBe(15.63);
  });

  it("rejects zero and invalid prices", () => {
    expect(() => priceDifferencePercentage(32, 0)).toThrow(RangeError);
    expect(() => priceDifferencePercentage(0, 35)).toThrow(RangeError);
    expect(() => priceDifferencePercentage(Number.NaN, 35)).toThrow(RangeError);
  });
});

describe("getPricePosition", () => {
  it.each([
    [-14.29, "UNDERPRICED"],
    [-10.01, "UNDERPRICED"],
    [-10, "SLIGHTLY_UNDERPRICED"],
    [-8.57, "SLIGHTLY_UNDERPRICED"],
    [-5.01, "SLIGHTLY_UNDERPRICED"],
    [-5, "MARKET_ALIGNED"],
    [0, "MARKET_ALIGNED"],
    [5, "MARKET_ALIGNED"],
    [5.01, "SLIGHTLY_OVERPRICED"],
    [10, "SLIGHTLY_OVERPRICED"],
    [10.01, "OVERPRICED"],
  ] as const)("classifies %s%% as %s", (gap, expected) => {
    expect(getPricePosition(gap)).toBe(expected);
  });

  it("supports custom thresholds and rejects non-finite gaps", () => {
    expect(getPricePosition(-8.57, { alignedBand: 3, strongBand: 8 })).toBe("UNDERPRICED");
    expect(() => getPricePosition(Number.NaN)).toThrow(RangeError);
  });
});

describe("getSuggestedPrice", () => {
  it("applies the rule table to the market median", () => {
    expect(getSuggestedPrice({ position: "UNDERPRICED", currentPrice: 30, marketMedian: 35 })).toBe(34.3);
    expect(getSuggestedPrice({ position: "SLIGHTLY_UNDERPRICED", currentPrice: 32, marketMedian: 35 })).toBe(34.65);
    expect(getSuggestedPrice({ position: "MARKET_ALIGNED", currentPrice: 34.5, marketMedian: 35 })).toBe(34.5);
    expect(getSuggestedPrice({ position: "SLIGHTLY_OVERPRICED", currentPrice: 37, marketMedian: 35 })).toBe(35);
    expect(getSuggestedPrice({ position: "OVERPRICED", currentPrice: 40, marketMedian: 35 })).toBe(35.7);
  });

  it("rounds according to currency minor units", () => {
    expect(getSuggestedPrice({ position: "SLIGHTLY_UNDERPRICED", currentPrice: 1100, marketMedian: 1234, currency: "JPY" })).toBe(1222);
    expect(getSuggestedPrice({ position: "UNDERPRICED", currentPrice: 10, marketMedian: 12.345, currency: "KWD" })).toBe(12.098);
    expect(currencyFractionDigits("USD")).toBe(2);
    expect(currencyFractionDigits("JPY")).toBe(0);
    expect(currencyFractionDigits("KWD")).toBe(3);
    expect(currencyFractionDigits("???")).toBe(2);
    expect(roundForCurrency(35 * 0.98, "USD")).toBe(34.3);
  });
});

describe("analyzePricing", () => {
  it("computes the full spec example with multiple competitors", () => {
    const a = analyzePricing(32, [35, 31, 37], { currency: "USD" });
    expect(a).toMatchObject({
      status: "OK",
      marketMinimum: 31,
      marketMaximum: 37,
      marketAverage: 34.33,
      marketMedian: 35,
      ownPriceVsMedian: -8.57,
      ownPriceVsAverage: -6.8,
      ownPriceVsMinimum: 3.23,
      ownPriceVsMaximum: -13.51,
      gapPercentage: -8.57,
      position: "SLIGHTLY_UNDERPRICED",
    });
    expect(a.cheaperCompetitors.map((c) => c.price)).toEqual([31]);
    expect(a.moreExpensiveCompetitors.map((c) => c.price)).toEqual([35, 37]);
    expect(PricingRecommendationService.recommend(a, "USD")?.suggestedPrice).toBe(34.65);
  });

  it("suggests 34.30 when underpriced against a 35 median", () => {
    const a = analyzePricing(30, [35, 34, 36]);
    expect(a.gapPercentage).toBe(-14.29);
    expect(a.position).toBe("UNDERPRICED");
    const rec = PricingRecommendationService.recommend(a, "USD");
    expect(rec).toMatchObject({ suggestedPrice: 34.3, basis: "MARKET_MEDIAN", multiplier: 0.98, changeAmount: 4.3 });
    expect(rec?.disclaimer).toBe(SUGGESTED_PRICE_DISCLAIMER);
  });

  it("handles no competitors", () => {
    const a = analyzePricing(32, []);
    expect(a).toMatchObject({ status: "INSUFFICIENT_DATA", reason: "NO_COMPETITOR_PRICES", marketMedian: null, position: null });
    expect(PricingRecommendationService.recommend(a)).toBeNull();
  });

  it("handles one competitor", () => {
    const a = analyzePricing(32, [35]);
    expect(a).toMatchObject({ status: "OK", marketMinimum: 35, marketMaximum: 35, marketAverage: 35, marketMedian: 35, gapPercentage: -8.57 });
  });

  it("handles equal prices", () => {
    const a = analyzePricing(35, [35, 35, 35]);
    expect(a).toMatchObject({ gapPercentage: 0, position: "MARKET_ALIGNED" });
    expect(a.equalCompetitors).toHaveLength(3);
    expect(a.cheaperCompetitors).toHaveLength(0);
    expect(PricingRecommendationService.recommend(a)).toMatchObject({ suggestedPrice: 35, basis: "CURRENT_PRICE", changeAmount: 0 });
  });

  it("ignores zero and invalid competitor prices", () => {
    const a = analyzePricing(32, [0, -4, Number.NaN, null, 35]);
    expect(a).toMatchObject({ status: "OK", validCompetitorCount: 1, invalidCompetitorCount: 4, marketMedian: 35 });
  });

  it("treats a zero/invalid own price as missing but still reports market stats", () => {
    const a = analyzePricing(0, [35, 31, 37]);
    expect(a).toMatchObject({ status: "INSUFFICIENT_DATA", reason: "NO_OWN_PRICE", ownPrice: null, marketMedian: 35, position: null });
  });

  it("classifies overpriced and slightly overpriced", () => {
    expect(analyzePricing(40, [35, 34, 36]).position).toBe("OVERPRICED");
    expect(analyzePricing(37, [35, 34, 36]).position).toBe("SLIGHTLY_OVERPRICED");
  });
});

describe("buildPricingSummary with scrape outcomes", () => {
  const own: SourcePriceInput = { sourceId: "own", isOwnStore: true, success: true, price: 32, currency: "USD", availability: "in_stock" };
  const comp = (id: string, o: Partial<SourcePriceInput>): SourcePriceInput => ({
    sourceId: id,
    isOwnStore: false,
    success: true,
    price: 35,
    currency: "USD",
    availability: "in_stock",
    ...o,
  });

  it("computes the comparison from successful competitors when one scraper failed", () => {
    const summary = buildPricingSummary([
      own,
      comp("a", { price: 35 }),
      comp("b", { success: false, price: null, currency: null, availability: null }),
      comp("c", { price: 37 }),
    ]);
    expect(summary.selection.excluded).toEqual([{ source: expect.objectContaining({ sourceId: "b" }), reason: "FAILED" }]);
    expect(summary.snapshot).toMatchObject({
      status: "OK",
      marketMedian: 36,
      competitorCount: 3,
      successfulCompetitorCount: 2,
      currency: "USD",
    });
  });

  it("excludes unavailable (out of stock) competitors from market statistics", () => {
    const selection = selectMarketPrices([own, comp("a", { price: 35 }), comp("b", { price: 20, availability: "out_of_stock" })]);
    expect(selection.included.map((s) => s.sourceId)).toEqual(["a"]);
    expect(selection.excluded[0]).toMatchObject({ reason: "OUT_OF_STOCK" });
  });

  it("excludes competitors quoting a different currency and assumes the reference currency when missing", () => {
    const selection = selectMarketPrices([own, comp("eur", { currency: "EUR" }), comp("unknown", { currency: null })]);
    expect(selection.included.map((s) => s.sourceId)).toEqual(["unknown"]);
    expect(selection.excluded[0]).toMatchObject({ reason: "CURRENCY_MISMATCH" });
  });

  it("returns insufficient data when the own store failed", () => {
    const summary = buildPricingSummary([{ ...own, success: false, price: null }, comp("a", { price: 35 })]);
    expect(summary.snapshot).toMatchObject({ status: "INSUFFICIENT_DATA", ownPrice: null, marketMedian: 35, suggestedPrice: null });
  });

  it("returns insufficient data when every competitor failed", () => {
    const summary = buildPricingSummary([own, comp("a", { success: false, price: null })]);
    expect(summary.snapshot).toMatchObject({ status: "INSUFFICIENT_DATA", marketMedian: null, successfulCompetitorCount: 0 });
  });
});
