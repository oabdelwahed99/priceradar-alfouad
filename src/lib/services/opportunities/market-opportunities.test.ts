import { describe, expect, it } from "vitest";
import { buildMarketOpportunities, type OpportunityBuildInput, type OpportunityObservation, type OpportunityProduct, type OpportunityRetailer, type OpportunitySource } from "./market-opportunities";

const at = new Date("2026-10-01T00:00:00.000Z");

const official: OpportunityRetailer = {
  id: "off",
  name: "Dermaelle Official",
  domain: "e-dermaelle.com",
  isOwnStore: true,
  isBrandStore: true,
};
const noon: OpportunityRetailer = { id: "noon", name: "Noon", domain: "noon.com", isOwnStore: false, isBrandStore: false };
const pharmacy: OpportunityRetailer = {
  id: "pharm",
  name: "El Ezaby",
  domain: "elezabypharmacy.com",
  isOwnStore: false,
  isBrandStore: false,
};
const bobaiStore: OpportunityRetailer = {
  id: "bobai",
  name: "Bobai Official",
  domain: "eparkville.com",
  isOwnStore: true,
  isBrandStore: true,
};

const serum: OpportunityProduct = {
  id: "serum",
  name: "Hyalu Serum",
  brand: "Dermaelle",
  size: "30ml",
  category: "SERUMS",
  currency: "EGP",
};
const toner: OpportunityProduct = {
  id: "toner",
  name: "Hyalu Toner",
  brand: "Dermaelle",
  size: "200ml",
  category: "TONERS",
  currency: "EGP",
};
const cream: OpportunityProduct = {
  id: "cream",
  name: "Cica Cream",
  brand: "Dermaelle",
  size: "50ml",
  category: "CICA",
  currency: "EGP",
};
const mask: OpportunityProduct = {
  id: "mask",
  name: "Night Mask",
  brand: "Dermaelle",
  size: null,
  category: null,
  currency: "EGP",
};
const gel: OpportunityProduct = {
  id: "gel",
  name: "Bobai Gel",
  brand: "Bobai",
  size: "30ml",
  category: null,
  currency: "EGP",
};

function tracked(
  sources: OpportunitySource[],
  latest: Map<string, OpportunityObservation>,
  input: {
    id: string;
    productId: string;
    retailerId: string;
    official?: boolean;
    state: "in_stock" | "out_of_stock" | "failed";
    price?: number;
  },
) {
  sources.push({
    id: input.id,
    productId: input.productId,
    retailerId: input.retailerId,
    url: `https://example.com/${input.id}`,
    isOwnStore: Boolean(input.official),
    scrapingStatus: input.state === "failed" ? "failed" : "success",
  });
  latest.set(input.id, {
    price: input.price ?? 0,
    currency: "EGP",
    availability: input.state === "out_of_stock" ? "out_of_stock" : "unknown",
    scrapedAt: at,
  });
}

function dermaelleFixture(): OpportunityBuildInput {
  const sources: OpportunitySource[] = [];
  const latest = new Map<string, OpportunityObservation>();
  tracked(sources, latest, { id: "s-off", productId: "serum", retailerId: "off", official: true, state: "in_stock", price: 690 });
  tracked(sources, latest, { id: "s-noon", productId: "serum", retailerId: "noon", state: "out_of_stock", price: 414 });
  tracked(sources, latest, { id: "s-pharm", productId: "serum", retailerId: "pharm", state: "in_stock", price: 450 });
  tracked(sources, latest, { id: "t-off", productId: "toner", retailerId: "off", official: true, state: "in_stock", price: 200 });
  tracked(sources, latest, { id: "t-noon", productId: "toner", retailerId: "noon", state: "in_stock", price: 180 });
  tracked(sources, latest, { id: "c-off", productId: "cream", retailerId: "off", official: true, state: "out_of_stock" });
  tracked(sources, latest, { id: "c-noon", productId: "cream", retailerId: "noon", state: "out_of_stock" });
  tracked(sources, latest, { id: "m-off", productId: "mask", retailerId: "off", official: true, state: "in_stock", price: 320 });
  tracked(sources, latest, { id: "g-off", productId: "gel", retailerId: "bobai", official: true, state: "in_stock", price: 150 });
  tracked(sources, latest, { id: "g-noon", productId: "gel", retailerId: "noon", state: "in_stock", price: 140 });

  return {
    products: [serum, toner, cream, mask, gel],
    retailers: [official, noon, pharmacy, bobaiStore],
    sources,
    latest,
    brand: "Dermaelle",
    focusBrands: new Set(["Dermaelle"]),
    selectedBrandSlug: "dermaelle",
  };
}

describe("buildMarketOpportunities", () => {
  it("ranks shelf refills ahead of supply gaps and pitches products the store has never listed", () => {
    const result = buildMarketOpportunities(dermaelleFixture());

    expect(result.selectedBrand).toBe("Dermaelle");
    expect(result.summary).toMatchObject({
      productCount: 4,
      partnerStoreCount: 2,
      restockCount: 2,
      newListingCount: 3,
      storesWithGaps: 2,
      unopenedProductCount: 1,
      unopenedDoorCount: 0,
    });

    expect(result.restocks.map((row) => [row.productName, row.retailerName, row.tone, row.action])).toEqual([
      ["Hyalu Serum", "Noon", "ready", "Refill the shelf"],
      ["Cica Cream", "Noon", "supply_gap", "Supply gap"],
    ]);
    expect(result.restocks[0]).toMatchObject({
      price: 414,
      currency: "EGP",
      inStockStores: 2,
      url: "https://example.com/s-noon",
      detail: "Out of stock at Noon. It is in stock at 2 other stores.",
    });
    expect(result.restocks[1].detail).toMatch(/Sort supply before you promise a refill/);

    expect(result.newListings.map((row) => [row.productName, row.retailerName])).toEqual([
      ["Hyalu Toner", "El Ezaby"],
      ["Night Mask", "El Ezaby"],
      ["Night Mask", "Noon"],
    ]);
    expect(result.newListings[0]).toMatchObject({
      action: "Open a first listing",
      inStockStores: 2,
      storeBrandListings: 1,
      detail: "El Ezaby already sells 1 Dermaelle product and has never listed this one. It is in stock at 2 stores.",
    });
    expect(result.newListings.some((row) => row.productId === "cream")).toBe(false);

    expect(result.stores.map((store) => store.name)).toEqual(["Noon", "El Ezaby"]);
    expect(result.stores[0]).toMatchObject({
      listed: 3,
      catalogSize: 4,
      outOfStock: 2,
      pitchCount: 1,
      coveragePercentage: 75,
    });
    expect(result.stores[1].pitches.map((row) => row.productName)).toEqual(["Hyalu Toner", "Night Mask"]);
    expect(result.unopenedProducts.map((row) => row.productName)).toEqual(["Night Mask"]);
    expect(result.coveredStores).toEqual([]);
    expect(result.brands.map((brand) => brand.name)).toEqual(["Dermaelle", "Bobai"]);
    expect(result.brands[0].isFocus).toBe(true);
  });

  it("treats a store that sells another brand as a new door, not a first listing of this brand", () => {
    const result = buildMarketOpportunities({ ...dermaelleFixture(), brand: "Bobai", selectedBrandSlug: "bobai" });

    expect(result.summary.restockCount).toBe(0);
    expect(result.summary.newListingCount).toBe(0);
    expect(result.unopenedDoors).toEqual([
      {
        retailerId: "pharm",
        name: "El Ezaby",
        domain: "elezabypharmacy.com",
        brand: "Bobai",
        catalogSize: 1,
        otherBrandListings: 1,
      },
    ]);
    expect(result.coveredStores.map((store) => store.name)).toEqual(["Noon"]);
  });

  it("does not treat a failed price check as out of stock", () => {
    const sources: OpportunitySource[] = [];
    const latest = new Map<string, OpportunityObservation>();
    tracked(sources, latest, { id: "ok", productId: "serum", retailerId: "off", official: true, state: "in_stock", price: 690 });
    tracked(sources, latest, { id: "bad", productId: "serum", retailerId: "noon", state: "failed", price: 414 });
    latest.set("bad", { price: 414, currency: "EGP", availability: "out_of_stock", scrapedAt: at });

    const result = buildMarketOpportunities({
      products: [serum],
      retailers: [official, noon],
      sources,
      latest,
      brand: "Dermaelle",
      focusBrands: new Set(["Dermaelle"]),
    });

    expect(result.summary.restockCount).toBe(0);
    expect(result.summary.newListingCount).toBe(0);
    expect(result.coveredStores.map((store) => store.name)).toEqual(["Noon"]);
  });

  it("keeps an in-stock listing when the same store also has an out-of-stock source", () => {
    const result = buildMarketOpportunities({
      products: [serum],
      retailers: [official, noon],
      sources: [
        {
          id: "stocked",
          productId: "serum",
          retailerId: "noon",
          url: "https://noon.com/a",
          isOwnStore: false,
          scrapingStatus: "success",
        },
        {
          id: "empty",
          productId: "serum",
          retailerId: "noon",
          url: "https://noon.com/b",
          isOwnStore: false,
          scrapingStatus: "success",
        },
      ],
      latest: new Map([
        ["stocked", { price: 450, currency: "EGP", availability: "unknown", scrapedAt: at }],
        ["empty", { price: 0, currency: "EGP", availability: "out_of_stock", scrapedAt: at }],
      ]),
      brand: "Dermaelle",
      focusBrands: new Set(),
    });

    expect(result.summary.restockCount).toBe(0);
    expect(result.coveredStores.map((store) => store.name)).toEqual(["Noon"]);
  });
});
