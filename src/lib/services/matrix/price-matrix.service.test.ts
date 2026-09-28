import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { buildPriceMatrix, priceMatrixToCsv, type PriceMatrixInput } from "./price-matrix.service";

const id = () => new Types.ObjectId();

const own = { _id: id(), name: "Al Fouad", domain: "alfouad.example", isOwnStore: true };
const noon = { _id: id(), name: "Noon", domain: "noon.example", isOwnStore: false };
const bloom = { _id: id(), name: "Bloom", domain: "bloom.example", isOwnStore: false };
const amazon = { _id: id(), name: "Amazon", domain: "amazon.example", isOwnStore: false };

const at = new Date("2026-09-26T10:00:00Z");

function analysis(ownPrice: number, marketMedian: number, gapPercentage: number) {
  return {
    status: "OK" as const,
    ownPrice,
    currency: "EGP",
    marketMinimum: null,
    marketMaximum: null,
    marketAverage: null,
    marketMedian,
    gapPercentage,
    position: "OVERPRICED" as const,
    suggestedPrice: 500,
    competitorCount: 3,
    successfulCompetitorCount: 2,
    computedAt: at,
  };
}

function fixture(): PriceMatrixInput & { productId: Types.ObjectId; sourceIds: Record<string, Types.ObjectId> } {
  const productId = id();
  const sourceIds = { own: id(), noon: id(), bloom: id(), amazon: id() };
  const source = (key: keyof typeof sourceIds, retailerId: Types.ObjectId, sortOrder: number, status = "success") => ({
    _id: sourceIds[key],
    productId,
    retailerId,
    url: `https://${key}.example/p`,
    isOwnStore: key === "own",
    sortOrder,
    scrapingStatus: status as "success" | "failed" | "pending",
    lastError: status === "failed" ? "Timed out" : null,
  });
  return {
    productId,
    sourceIds,
    products: [
      { _id: productId, name: "Clary Booster, 30ml", brand: "Clary", size: "30ml", currency: "EGP", isDemo: false, latestAnalysis: analysis(500, 425, 17.65) },
    ],
    retailers: [amazon, bloom, noon, own],
    sources: [
      source("amazon", amazon._id, 3, "failed"),
      source("noon", noon._id, 1),
      source("own", own._id, 0),
      source("bloom", bloom._id, 2),
    ],
    latest: new Map([
      [String(sourceIds.own), { price: 500, currency: "EGP", availability: "unknown" as const, scrapedAt: at, origin: "manual" as const }],
      [String(sourceIds.noon), { price: 350, currency: "EGP", availability: "in_stock" as const, scrapedAt: at, origin: "scrape" as const }],
      [String(sourceIds.bloom), { price: 500, currency: "EGP", availability: "out_of_stock" as const, scrapedAt: at, origin: "scrape" as const }],
      [String(sourceIds.amazon), { price: 375, currency: "EGP", availability: "in_stock" as const, scrapedAt: at, origin: "scrape" as const }],
    ]),
  };
}

describe("buildPriceMatrix", () => {
  it("puts the own store first and orders competitors by their position in the product's list", () => {
    const { columns } = buildPriceMatrix(fixture());
    expect(columns.map((c) => c.name)).toEqual(["Al Fouad", "Noon", "Bloom", "Amazon"]);
    expect(columns[0].isOwnStore).toBe(true);
    expect(columns.every((c) => c.productCount === 1)).toBe(true);
  });

  it("derives cell states from scrape status and availability", () => {
    const { rows } = buildPriceMatrix(fixture());
    const cells = rows[0].cells;
    expect(cells[String(own._id)].state).toBe("current");
    expect(cells[String(noon._id)].state).toBe("current");
    expect(cells[String(bloom._id)].state).toBe("out_of_stock");
    expect(cells[String(amazon._id)]).toMatchObject({ state: "stale", price: 375, error: "Timed out" });
  });

  it("compares competitor prices with the own price and flags the lowest current price", () => {
    const { rows } = buildPriceMatrix(fixture());
    const cells = rows[0].cells;
    expect(cells[String(noon._id)]).toMatchObject({ differencePercentage: -30, isLowest: true });
    expect(cells[String(own._id)]).toMatchObject({ differencePercentage: null, isLowest: false, isManual: true });
    // Stale and out-of-stock prices never count as the lowest.
    expect(cells[String(amazon._id)].isLowest).toBe(false);
    expect(cells[String(bloom._id)].isLowest).toBe(false);
  });

  it("marks cells never priced as failed or pending, and omits stores the product is not tracked at", () => {
    const input = fixture();
    input.latest.delete(String(input.sourceIds.amazon));
    input.latest.delete(String(input.sourceIds.noon));
    input.sources = input.sources.map((s) => (s._id === input.sourceIds.noon ? { ...s, scrapingStatus: "pending" as const } : s));
    const other = { _id: id(), name: "Other product", brand: null, size: null, currency: "EGP", isDemo: false, latestAnalysis: null };
    input.products.push(other);

    const { rows } = buildPriceMatrix(input);
    expect(rows[0].cells[String(amazon._id)]).toMatchObject({ state: "failed", price: null });
    expect(rows[0].cells[String(noon._id)]).toMatchObject({ state: "pending", price: null });
    expect(rows[1].cells).toEqual({});
    expect(rows[1].analysis).toBeNull();
  });

  it("does not flag a lowest price when only one store has a current price", () => {
    const input = fixture();
    input.sources = input.sources.filter((s) => s._id === input.sourceIds.noon);
    const { rows } = buildPriceMatrix(input);
    expect(rows[0].cells[String(noon._id)].isLowest).toBe(false);
  });
});

describe("priceMatrixToCsv", () => {
  it("writes one row per product with store prices and market columns", () => {
    const csv = priceMatrixToCsv(buildPriceMatrix(fixture()));
    const lines = csv.replace(/^\uFEFF/, "").trim().split("\r\n");
    expect(lines[0]).toBe(
      "Product,Brand,Size,Currency,Al Fouad (your price),Noon,Bloom,Amazon,Market median,Gap vs median (%),Position,Suggested price",
    );
    expect(lines[1]).toBe('"Clary Booster, 30ml",Clary,30ml,EGP,500,350,Out of stock,375,425,17.65,Overpriced,500');
  });

  it("neutralises text that spreadsheet apps would run as a formula", () => {
    const input = fixture();
    input.products[0] = { ...input.products[0], name: "=HYPERLINK(\"x\")" };
    const csv = priceMatrixToCsv(buildPriceMatrix(input));
    expect(csv.split("\r\n")[1].startsWith(`"'=HYPERLINK(""x"")"`)).toBe(true);
  });
});
