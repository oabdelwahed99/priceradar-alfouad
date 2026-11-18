import { describe, expect, it } from "vitest";
import { alertItem } from "./report-test-fixtures";
import { rankPriceChangeAlerts, selectDecisionsNeeded, type DecisionCandidate } from "./report-builder";

const candidate = (overrides: Partial<DecisionCandidate>): DecisionCandidate => ({
  id: "1",
  name: "Serum",
  brand: "Dermaelle",
  currency: "EGP",
  ownPrice: 400,
  marketMedian: 300,
  gapPercentage: 33.3,
  suggestedPrice: 310,
  position: "OVERPRICED",
  ...overrides,
});

describe("selectDecisionsNeeded", () => {
  it("keeps products beyond the threshold, ranks by absolute gap and sets direction", () => {
    const { items, total } = selectDecisionsNeeded(
      [
        candidate({ id: "1", name: "Serum" }),
        candidate({ id: "2", name: "Toner", gapPercentage: -4.8, position: "MARKET_ALIGNED" }),
        candidate({ id: "3", name: "Cream", ownPrice: 150, suggestedPrice: 190, gapPercentage: -25, position: "UNDERPRICED" }),
      ],
      { hrefFor: (id) => `https://x.test/products/${id}` },
    );

    expect(total).toBe(2);
    expect(items.map((item) => item.productId)).toEqual(["1", "3"]);
    expect(items[0]).toMatchObject({ direction: "lower", suggestedPrice: 310, priceChange: -90 });
    expect(items[1]).toMatchObject({ direction: "raise", priceChange: 40, href: "https://x.test/products/3" });
  });

  it("reports the full total when the display list is limited", () => {
    const products = Array.from({ length: 5 }, (_, i) => candidate({ id: String(i), name: `P${i}`, gapPercentage: 20 + i }));
    const { items, total } = selectDecisionsNeeded(products, { limit: 2 });
    expect(items).toHaveLength(2);
    expect(total).toBe(5);
    expect(items[0].productId).toBe("4");
  });

  it("leaves priceChange empty when a price is missing and href empty without a builder", () => {
    const { items } = selectDecisionsNeeded([candidate({ suggestedPrice: null })]);
    expect(items[0].priceChange).toBeNull();
    expect(items[0].href).toBeNull();
  });

  it("returns nothing when no product exceeds the threshold", () => {
    expect(selectDecisionsNeeded([candidate({ gapPercentage: -4.8 })])).toEqual({ items: [], total: 0 });
  });
});

describe("rankPriceChangeAlerts", () => {
  it("ranks by absolute percentage change", () => {
    const ranked = rankPriceChangeAlerts([
      alertItem({ id: "a", changePercentage: -5 }),
      alertItem({ id: "b", changePercentage: 20 }),
      alertItem({ id: "c", changePercentage: null }),
    ]);
    expect(ranked.map((a) => a.id)).toEqual(["b", "a", "c"]);
  });
});
