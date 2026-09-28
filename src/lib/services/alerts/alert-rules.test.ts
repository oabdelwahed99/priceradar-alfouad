import { describe, expect, it } from "vitest";
import { detectAlerts, type SourceChange } from "./alert-rules";

const change = (o: Partial<SourceChange>): SourceChange => ({
  sourceId: "s1",
  retailerId: "r1",
  retailerName: "Store A",
  isOwnStore: false,
  previous: { price: 35, availability: "in_stock", currency: "USD" },
  current: { price: 35, availability: "in_stock", currency: "USD" },
  ...o,
});

const base = { productName: "Demo Cleanser", previousGap: null, currentGap: null, marketMedian: 35, currency: "USD" };

describe("detectAlerts", () => {
  it("creates a price change alert for competitors", () => {
    const alerts = detectAlerts({ ...base, changes: [change({ current: { price: 31, availability: "in_stock", currency: "USD" } })] });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ type: "PRICE_CHANGE", payload: { previousPrice: 35, currentPrice: 31, changePercentage: -11.43 } });
    expect(alerts[0].message).toBe("Demo Cleanser at Store A: $35.00 → $31.00 (-11.4%)");
  });

  it("ignores unchanged prices, first observations and own-store changes", () => {
    expect(detectAlerts({ ...base, changes: [change({})] })).toEqual([]);
    expect(detectAlerts({ ...base, changes: [change({ previous: null })] })).toEqual([]);
    expect(
      detectAlerts({ ...base, changes: [change({ isOwnStore: true, current: { price: 20, availability: "in_stock", currency: "USD" } })] }),
    ).toEqual([]);
  });

  it("alerts when a competitor goes out of stock (transition only)", () => {
    const out = { price: 35, availability: "out_of_stock" as const, currency: "USD" };
    expect(detectAlerts({ ...base, changes: [change({ current: out })] }).map((a) => a.type)).toEqual(["OUT_OF_STOCK"]);
    expect(detectAlerts({ ...base, changes: [change({ previous: out, current: out })] })).toEqual([]);
  });

  it("alerts when own price becomes >10% above or below the median", () => {
    expect(detectAlerts({ ...base, changes: [], previousGap: 4, currentGap: 12.5 }).map((a) => a.type)).toEqual(["OVERPRICED"]);
    expect(detectAlerts({ ...base, changes: [], previousGap: null, currentGap: -14.29 }).map((a) => a.type)).toEqual(["UNDERPRICED"]);
  });

  it("does not repeat position alerts while the position persists", () => {
    expect(detectAlerts({ ...base, changes: [], previousGap: 11, currentGap: 15 })).toEqual([]);
    expect(detectAlerts({ ...base, changes: [], previousGap: -12, currentGap: -20 })).toEqual([]);
    expect(detectAlerts({ ...base, changes: [], previousGap: 10, currentGap: 10 })).toEqual([]);
  });
});
