import { describe, expect, it } from "vitest";
import { hairCarePriceSheet } from "../../../../scripts/data/hair-care-price-sheet";
import { planPriceSheet, type PriceSheet } from "./price-sheet-import.service";

const stores: PriceSheet["stores"] = [
  { key: "own", name: "My Store", isOwnStore: true },
  { key: "a", name: "Store A" },
  { key: "b", name: "Store B" },
];

describe("planPriceSheet", () => {
  it("orders sources own store first and keeps prices and availability", () => {
    const { currency, rows } = planPriceSheet({
      currency: "egp",
      stores: [stores[1], stores[0], stores[2]],
      rows: [
        {
          name: "  Serum 30ml ",
          brand: "Brand",
          cells: {
            a: { url: "https://store-a.com/p/serum", price: 90 },
            own: { url: "https://www.my-store.com/p/serum", price: 100 },
            b: { url: "https://store-b.com/p/serum", outOfStock: true },
          },
        },
      ],
    });
    expect(currency).toBe("EGP");
    expect(rows[0].name).toBe("Serum 30ml");
    expect(rows[0].size).toBeNull();
    expect(rows[0].sources).toEqual([
      expect.objectContaining({ storeName: "My Store", isOwnStore: true, domain: "my-store.com", sortOrder: 0, price: 100 }),
      expect.objectContaining({ storeName: "Store A", sortOrder: 1, price: 90, availability: "unknown" }),
      expect.objectContaining({ storeName: "Store B", sortOrder: 2, price: null, availability: "out_of_stock" }),
    ]);
  });

  it("reports priced cells it cannot import and ignores stores that do not list the product", () => {
    const { rows } = planPriceSheet({
      currency: "EGP",
      stores,
      rows: [
        {
          name: "Mask",
          cells: {
            own: { url: "https://my-store.com/mask", price: 100 },
            a: { url: null, price: 80 },
            b: { url: "not a url", price: 70 },
          },
        },
        { name: "Shampoo", cells: { own: { url: "https://my-store.com/shampoo", price: 50 }, a: {} } },
      ],
    });
    expect(rows[0].sources).toHaveLength(1);
    expect(rows[0].skipped).toEqual([
      { storeName: "Store A", reason: "MISSING_URL", price: 80 },
      { storeName: "Store B", reason: "INVALID_URL", price: 70 },
    ]);
    expect(rows[1].skipped).toEqual([]);
    expect(rows[1].sources).toHaveLength(1);
  });

  it("rejects sheets without exactly one own store, unknown store keys and duplicate names", () => {
    expect(() => planPriceSheet({ currency: "EGP", stores: stores.slice(1), rows: [] })).toThrow(/exactly one own store/);
    expect(() =>
      planPriceSheet({ currency: "EGP", stores, rows: [{ name: "X", cells: { zzz: { url: "https://z.com/x" } } }] }),
    ).toThrow(/unknown store "zzz"/);
    expect(() =>
      planPriceSheet({ currency: "EGP", stores, rows: [{ name: "Mask", cells: {} }, { name: "mask", cells: {} }] }),
    ).toThrow(/Duplicate product name/);
  });
});

describe("hair care price sheet data", () => {
  it("is valid and only skips the cells whose links were cut off", () => {
    const { rows } = planPriceSheet(hairCarePriceSheet);
    expect(rows).toHaveLength(10);
    expect(rows.every((r) => r.sources[0]?.isOwnStore)).toBe(true);
    const skipped = rows.flatMap((r) => r.skipped.map((s) => `${r.name} @ ${s.storeName}`));
    expect(skipped).toHaveLength(6);
    expect(rows.flatMap((r) => r.skipped).every((s) => s.reason === "MISSING_URL")).toBe(true);
  });
});
