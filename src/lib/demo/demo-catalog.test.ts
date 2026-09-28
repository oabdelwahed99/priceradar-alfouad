import { describe, expect, it } from "vitest";
import { buildPricingSummary, type SourcePriceInput } from "@/lib/services/pricing/pricing-summary";
import { PRICE_POSITIONS } from "@/types";
import { createRng, DEMO_PRODUCT_COUNT, generateDemoCatalog, type DemoProduct } from "./demo-catalog";

const NOW = new Date("2026-09-26T12:00:00.000Z");

function latestInputs(product: DemoProduct): SourcePriceInput[] {
  return product.sources.map((s, i) => {
    const obs = s.failure ? undefined : s.observations.at(-1);
    return {
      sourceId: String(i),
      isOwnStore: s.isOwnStore,
      success: Boolean(obs),
      price: obs?.price ?? null,
      currency: obs ? product.currency : null,
      availability: obs?.availability ?? null,
    };
  });
}

describe("createRng", () => {
  it("is deterministic and within [0, 1)", () => {
    const a = createRng(42);
    const b = createRng(42);
    const values = Array.from({ length: 100 }, () => a());
    expect(values).toEqual(Array.from({ length: 100 }, () => b()));
    expect(values.every((v) => v >= 0 && v < 1)).toBe(true);
  });
});

describe("generateDemoCatalog", () => {
  const catalog = generateDemoCatalog({ now: NOW });

  it("is deterministic for the same seed and time", () => {
    expect(generateDemoCatalog({ now: NOW })).toEqual(catalog);
  });

  it("creates clearly fictional products on reserved .example domains", () => {
    expect(catalog).toHaveLength(DEMO_PRODUCT_COUNT);
    catalog.forEach((p, i) => {
      expect(p.name).toBe(`Demo Product ${i + 1}`);
      expect(p.brand).toBe("Demo Brand");
      for (const s of p.sources) expect(new URL(s.url).hostname).toMatch(/^demo-[a-z-]+\.example$/);
    });
  });

  it("gives every product one own store and four competitors with about a year of weekly history", () => {
    for (const p of catalog) {
      expect(p.sources.filter((s) => s.isOwnStore)).toHaveLength(1);
      expect(p.sources.filter((s) => !s.isOwnStore)).toHaveLength(4);
      const own = p.sources[0].observations;
      expect(own).toHaveLength(53);
      const spanDays = (own.at(-1)!.at.getTime() - own[0].at.getTime()) / 86_400_000;
      expect(spanDays).toBe(364);
      for (const s of p.sources) {
        expect(s.observations.every((o) => o.price > 0)).toBe(true);
        const times = s.observations.map((o) => o.at.getTime());
        expect([...times].sort((a, b) => a - b)).toEqual(times);
      }
    }
  });

  it("covers every price position", () => {
    const positions = new Set(catalog.map((p) => buildPricingSummary(latestInputs(p)).snapshot.position));
    for (const position of PRICE_POSITIONS) expect(positions).toContain(position);
  });

  it("includes an out-of-stock competitor and a failed source to demo those states", () => {
    const outOfStock = catalog.flatMap((p) => p.sources).filter((s) => s.observations.at(-1)?.availability === "out_of_stock");
    const failed = catalog.flatMap((p) => p.sources).filter((s) => s.failure);
    expect(outOfStock).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect(failed[0].failure?.code).toBe("PRICE_NOT_FOUND");
  });
});
