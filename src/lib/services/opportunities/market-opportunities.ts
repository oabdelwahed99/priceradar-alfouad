import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import { isValidPrice } from "@/lib/services/pricing/pricing-analysis.service";
import { toIso } from "@/lib/services/mappers";
import { getLatestObservationsBySource } from "@/lib/services/prices/price-observation.service";
import {
  Brand,
  Product,
  ProductSource,
  Retailer,
  type BrandDoc,
  type ProductSourceDoc,
  type RetailerDoc,
} from "@/models";
import type { LeanProduct } from "@/lib/services/products/product.service";
import type {
  CoveredStoreDTO,
  MarketOpportunitiesDTO,
  OpportunityTone,
  SalesOpportunityDTO,
  StoreOpportunityBriefDTO,
  UnopenedDoorDTO,
  UnopenedProductDTO,
} from "@/types/dto";

const LIST_LIMIT = 200;
const CARD_LIMIT = 5;
const UNOPENED_PRODUCT_LIMIT = 12;
const DOOR_LIMIT = 20;

export interface OpportunityProduct {
  id: string;
  name: string;
  brand: string;
  size: string | null;
  category: string | null;
  currency: string | null;
}

export interface OpportunityRetailer {
  id: string;
  name: string;
  domain: string;
  isOwnStore: boolean;
  isBrandStore: boolean;
}

export interface OpportunitySource {
  id: string;
  productId: string;
  retailerId: string;
  url: string;
  isOwnStore: boolean;
  scrapingStatus: string;
}

export interface OpportunityObservation {
  price: number;
  currency: string | null;
  availability: string;
  scrapedAt: Date;
}

export interface OpportunityBuildInput {
  products: OpportunityProduct[];
  retailers: OpportunityRetailer[];
  sources: OpportunitySource[];
  latest: Map<string, OpportunityObservation>;
  /** Canonical brand name. Null includes every brand. */
  brand: string | null;
  focusBrands: ReadonlySet<string>;
  /** Slug of the selected brand, when one is selected. */
  selectedBrandSlug?: string | null;
}

type ListingState = "in_stock" | "out_of_stock" | "unknown";

interface ResolvedListing {
  productId: string;
  retailerId: string;
  url: string;
  state: ListingState;
  price: number | null;
  currency: string | null;
  observedAt: Date | null;
  official: boolean;
}

interface DraftOpportunity extends SalesOpportunityDTO {
  rank: number;
  storeMissing: number;
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function listingState(source: OpportunitySource, obs: OpportunityObservation | undefined): ListingState {
  if (!obs || source.scrapingStatus === "failed") return "unknown";
  if (obs.availability === "out_of_stock") return "out_of_stock";
  if (isValidPrice(obs.price) || obs.availability === "in_stock" || obs.availability === "limited") return "in_stock";
  return "unknown";
}

function stateRank(state: ListingState): number {
  if (state === "in_stock") return 2;
  if (state === "out_of_stock") return 1;
  return 0;
}

function emptyResult(brand: string | null, slug: string | null): MarketOpportunitiesDTO {
  return {
    brands: [],
    selectedBrand: brand,
    selectedBrandSlug: slug,
    summary: {
      productCount: 0,
      partnerStoreCount: 0,
      restockCount: 0,
      newListingCount: 0,
      storesWithGaps: 0,
      unopenedProductCount: 0,
      unopenedDoorCount: 0,
    },
    stores: [],
    coveredStores: [],
    restocks: [],
    newListings: [],
    unopenedProducts: [],
    unopenedDoors: [],
    restocksTruncated: false,
    newListingsTruncated: false,
  };
}

function restockCopy(input: {
  retailerName: string;
  inStockStores: number;
  officialOutOfStock: boolean;
}): { tone: OpportunityTone; action: string; detail: string; rank: number } {
  const stock =
    input.inStockStores === 0
      ? "It is not in stock at any other store we track."
      : `It is in stock at ${plural(input.inStockStores, "other store")}.`;
  if (input.inStockStores === 0) {
    return {
      tone: "supply_gap",
      action: "Supply gap",
      detail: `Out of stock at ${input.retailerName}, and not in stock anywhere else we track. Sort supply before you promise a refill.`,
      rank: 0,
    };
  }
  if (input.officialOutOfStock) {
    return {
      tone: "confirm_supply",
      action: "Refill after you confirm supply",
      detail: `Out of stock at ${input.retailerName}. The official store is out of stock too. ${stock}`,
      rank: 1,
    };
  }
  return {
    tone: "ready",
    action: "Refill the shelf",
    detail: `Out of stock at ${input.retailerName}. ${stock}`,
    rank: 2,
  };
}

function listingCopy(input: {
  retailerName: string;
  brand: string;
  storeBrandListings: number;
  inStockStores: number;
  officialOutOfStock: boolean;
}): { tone: OpportunityTone; action: string; detail: string; rank: number } {
  const carried = `${input.retailerName} already sells ${plural(input.storeBrandListings, input.brand + " product")} and has never listed this one.`;
  const stock = `It is in stock at ${plural(input.inStockStores, "store")}.`;
  if (input.officialOutOfStock) {
    return {
      tone: "confirm_supply",
      action: "Open after you confirm supply",
      detail: `${carried} The official store is out of stock. ${stock}`,
      rank: 1,
    };
  }
  return {
    tone: "ready",
    action: "Open a first listing",
    detail: `${carried} ${stock}`,
    rank: 2,
  };
}

function compareOpportunities(a: DraftOpportunity, b: DraftOpportunity): number {
  return (
    b.rank - a.rank ||
    b.inStockStores - a.inStockStores ||
    b.storeMissing - a.storeMissing ||
    a.productName.localeCompare(b.productName) ||
    a.retailerName.localeCompare(b.retailerName)
  );
}

function toDto(draft: DraftOpportunity): SalesOpportunityDTO {
  const { rank, storeMissing, ...dto } = draft;
  void rank;
  void storeMissing;
  return dto;
}

/** Turns the latest listing at each store into refill calls and first-time listings. */
export function buildMarketOpportunities(input: OpportunityBuildInput): MarketOpportunitiesDTO {
  const slug = input.selectedBrandSlug ?? null;
  const products = input.products.filter((p) => p.brand.trim() !== "");
  if (products.length === 0) return emptyResult(input.brand, slug);

  const productById = new Map(products.map((p) => [p.id, p]));
  const retailerById = new Map(input.retailers.map((r) => [r.id, r]));

  const sourcesByRetailer = new Map<string, OpportunitySource[]>();
  for (const source of input.sources) {
    if (!productById.has(source.productId) || !retailerById.has(source.retailerId)) continue;
    sourcesByRetailer.set(source.retailerId, [...(sourcesByRetailer.get(source.retailerId) ?? []), source]);
  }

  const referenceRetailers = new Set<string>();
  for (const retailer of input.retailers) {
    if (retailer.isBrandStore || retailer.isOwnStore) {
      referenceRetailers.add(retailer.id);
      continue;
    }
    const sources = sourcesByRetailer.get(retailer.id) ?? [];
    if (sources.length > 0 && sources.every((s) => s.isOwnStore)) referenceRetailers.add(retailer.id);
  }

  const resolved = new Map<string, ResolvedListing>();
  for (const source of input.sources) {
    const retailer = retailerById.get(source.retailerId);
    const product = productById.get(source.productId);
    if (!retailer || !product) continue;
    const obs = input.latest.get(source.id);
    const next: ResolvedListing = {
      productId: source.productId,
      retailerId: source.retailerId,
      url: source.url,
      state: listingState(source, obs),
      price: obs && isValidPrice(obs.price) ? obs.price : null,
      currency: obs?.currency ?? product.currency,
      observedAt: obs?.scrapedAt ?? null,
      official: source.isOwnStore || referenceRetailers.has(retailer.id),
    };
    const key = `${source.productId}:${source.retailerId}`;
    const prev = resolved.get(key);
    if (
      !prev ||
      stateRank(next.state) > stateRank(prev.state) ||
      (stateRank(next.state) === stateRank(prev.state) && prev.price === null && next.price !== null)
    ) {
      resolved.set(key, next);
    }
  }

  const productsByBrand = new Map<string, OpportunityProduct[]>();
  for (const product of products) {
    const brand = product.brand.trim();
    productsByBrand.set(brand, [...(productsByBrand.get(brand) ?? []), product]);
  }

  const brands = [...productsByBrand.entries()]
    .map(([name, items]) => ({ name, productCount: items.length, isFocus: input.focusBrands.has(name) }))
    .sort((a, b) => Number(b.isFocus) - Number(a.isFocus) || a.name.localeCompare(b.name));

  const activeBrands =
    input.brand === null ? [...productsByBrand.keys()] : productsByBrand.has(input.brand) ? [input.brand] : [];

  const shelf = new Map<string, Map<string, Set<string>>>();
  const inStockRetailers = new Map<string, Set<string>>();
  const officialInStock = new Set<string>();
  const officialOutOfStock = new Set<string>();

  for (const listing of resolved.values()) {
    const product = productById.get(listing.productId)!;
    if (listing.state === "in_stock") {
      const stocked = inStockRetailers.get(listing.productId) ?? new Set<string>();
      stocked.add(listing.retailerId);
      inStockRetailers.set(listing.productId, stocked);
      if (listing.official) officialInStock.add(listing.productId);
    } else if (listing.state === "out_of_stock" && listing.official) {
      officialOutOfStock.add(listing.productId);
    }
    if (listing.official || referenceRetailers.has(listing.retailerId)) continue;
    const byBrand = shelf.get(listing.retailerId) ?? new Map<string, Set<string>>();
    const ids = byBrand.get(product.brand) ?? new Set<string>();
    ids.add(listing.productId);
    byBrand.set(product.brand, ids);
    shelf.set(listing.retailerId, byBrand);
  }

  const partnerIds = new Set<string>();
  const restockDrafts: DraftOpportunity[] = [];
  const listingDrafts: DraftOpportunity[] = [];
  const gapStores: { brief: StoreOpportunityBriefDTO; actionableRestocks: number }[] = [];
  const coveredStores: CoveredStoreDTO[] = [];
  const unopenedAll: UnopenedProductDTO[] = [];
  const unopenedDoors: UnopenedDoorDTO[] = [];
  let productCount = 0;

  for (const brand of activeBrands) {
    const catalog = productsByBrand.get(brand) ?? [];
    productCount += catalog.length;

    const partners = [...shelf.entries()].filter(([, byBrand]) => byBrand.has(brand)).map(([id]) => id);
    for (const id of partners) partnerIds.add(id);

    const listedSomewhere = new Set<string>();
    for (const retailerId of partners) {
      for (const productId of shelf.get(retailerId)?.get(brand) ?? []) listedSomewhere.add(productId);
    }

    for (const product of catalog) {
      const stocked = (inStockRetailers.get(product.id)?.size ?? 0) > 0;
      if (!listedSomewhere.has(product.id) && stocked) {
        unopenedAll.push({
          productId: product.id,
          productName: product.name,
          brand: product.brand,
          size: product.size,
        });
      }
    }

    for (const [retailerId, byBrand] of shelf) {
      if (byBrand.has(brand) || referenceRetailers.has(retailerId)) continue;
      let otherBrandListings = 0;
      for (const [other, ids] of byBrand) {
        if (other !== brand) otherBrandListings += ids.size;
      }
      if (otherBrandListings === 0) continue;
      const retailer = retailerById.get(retailerId);
      if (!retailer) continue;
      unopenedDoors.push({
        retailerId,
        name: retailer.name,
        domain: retailer.domain,
        brand,
        catalogSize: catalog.length,
        otherBrandListings,
      });
    }

    for (const retailerId of partners) {
      const retailer = retailerById.get(retailerId);
      if (!retailer) continue;
      const listedIds = shelf.get(retailerId)?.get(brand) ?? new Set<string>();
      const storeRestocks: DraftOpportunity[] = [];
      const storePitches: DraftOpportunity[] = [];
      let inStock = 0;
      let outOfStock = 0;

      for (const product of catalog) {
        const listing = resolved.get(`${product.id}:${retailerId}`);
        if (listing?.official) continue;
        const stockedElsewhere = inStockRetailers.get(product.id)?.size ?? 0;
        const officialBlocked = officialOutOfStock.has(product.id) && !officialInStock.has(product.id);
        if (!listing) {
          if (stockedElsewhere === 0) continue;
          const copy = listingCopy({
            retailerName: retailer.name,
            brand,
            storeBrandListings: listedIds.size,
            inStockStores: stockedElsewhere,
            officialOutOfStock: officialBlocked,
          });
          storePitches.push({
            productId: product.id,
            productName: product.name,
            brand,
            size: product.size,
            category: product.category,
            retailerId,
            retailerName: retailer.name,
            retailerDomain: retailer.domain,
            url: null,
            price: null,
            currency: product.currency,
            observedAt: null,
            inStockStores: stockedElsewhere,
            storeBrandListings: listedIds.size,
            brandCatalogSize: catalog.length,
            officialOutOfStock: officialBlocked,
            ...copy,
            storeMissing: catalog.length - listedIds.size,
          });
          continue;
        }
        if (listing.state === "in_stock") inStock += 1;
        if (listing.state !== "out_of_stock") continue;
        outOfStock += 1;
        const copy = restockCopy({
          retailerName: retailer.name,
          inStockStores: stockedElsewhere,
          officialOutOfStock: officialBlocked,
        });
        storeRestocks.push({
          productId: product.id,
          productName: product.name,
          brand,
          size: product.size,
          category: product.category,
          retailerId,
          retailerName: retailer.name,
          retailerDomain: retailer.domain,
          url: listing.url,
          price: listing.price,
          currency: listing.currency ?? product.currency,
          observedAt: toIso(listing.observedAt),
          inStockStores: stockedElsewhere,
          storeBrandListings: listedIds.size,
          brandCatalogSize: catalog.length,
          officialOutOfStock: officialBlocked,
          ...copy,
          storeMissing: catalog.length - listedIds.size,
        });
      }

      storeRestocks.sort(compareOpportunities);
      storePitches.sort(compareOpportunities);
      restockDrafts.push(...storeRestocks);
      listingDrafts.push(...storePitches);

      const pitchCount = storePitches.length;
      if (outOfStock === 0 && pitchCount === 0) {
        coveredStores.push({
          retailerId,
          name: retailer.name,
          domain: retailer.domain,
          brand,
          catalogSize: catalog.length,
        });
        continue;
      }

      gapStores.push({
        actionableRestocks: storeRestocks.filter((row) => row.tone !== "supply_gap").length,
        brief: {
          retailerId,
          name: retailer.name,
          domain: retailer.domain,
          brand,
          catalogSize: catalog.length,
          listed: listedIds.size,
          inStock,
          outOfStock,
          missing: catalog.length - listedIds.size,
          pitchCount,
          coveragePercentage: catalog.length === 0 ? 0 : Math.round((listedIds.size / catalog.length) * 100),
          restocks: storeRestocks.slice(0, CARD_LIMIT).map(toDto),
          pitches: storePitches.slice(0, CARD_LIMIT).map(toDto),
        },
      });
    }
  }

  const stores = gapStores
    .sort(
      (a, b) =>
        b.actionableRestocks - a.actionableRestocks ||
        b.brief.pitchCount - a.brief.pitchCount ||
        b.brief.outOfStock - a.brief.outOfStock ||
        a.brief.name.localeCompare(b.brief.name) ||
        a.brief.brand.localeCompare(b.brief.brand),
    )
    .map((entry) => entry.brief);
  unopenedAll.sort((a, b) => a.productName.localeCompare(b.productName) || a.brand.localeCompare(b.brand));
  coveredStores.sort((a, b) => a.name.localeCompare(b.name) || a.brand.localeCompare(b.brand));
  unopenedDoors.sort((a, b) => b.otherBrandListings - a.otherBrandListings || a.name.localeCompare(b.name) || a.brand.localeCompare(b.brand));

  restockDrafts.sort(compareOpportunities);
  listingDrafts.sort(compareOpportunities);

  return {
    brands,
    selectedBrand: input.brand,
    selectedBrandSlug: slug,
    summary: {
      productCount,
      partnerStoreCount: partnerIds.size,
      restockCount: restockDrafts.length,
      newListingCount: listingDrafts.length,
      storesWithGaps: stores.length,
      unopenedProductCount: unopenedAll.length,
      unopenedDoorCount: unopenedDoors.length,
    },
    stores,
    coveredStores,
    restocks: restockDrafts.slice(0, LIST_LIMIT).map(toDto),
    newListings: listingDrafts.slice(0, LIST_LIMIT).map(toDto),
    unopenedProducts: unopenedAll.slice(0, UNOPENED_PRODUCT_LIMIT),
    unopenedDoors: unopenedDoors.slice(0, DOOR_LIMIT),
    restocksTruncated: restockDrafts.length > LIST_LIMIT,
    newListingsTruncated: listingDrafts.length > LIST_LIMIT,
  };
}

function canonicalBrand(raw: string | null | undefined, docs: BrandDoc[]): string | null {
  if (!raw?.trim()) return null;
  const key = raw.trim().toLowerCase();
  const doc = docs.find((b) => b.name.trim().toLowerCase() === key || b.slug === key);
  return doc?.name ?? raw.trim();
}

export async function getMarketOpportunities(
  workspaceId: string,
  query: { brand?: string } = {},
): Promise<MarketOpportunitiesDTO> {
  await connectToDatabase();

  const [productDocs, brandDocs] = await Promise.all([
    Product.find({ workspaceId, isDemo: { $ne: true }, brand: { $nin: [null, ""] } })
      .collation({ locale: "en", strength: 2 })
      .sort({ name: 1, _id: 1 })
      .lean<LeanProduct[]>(),
    Brand.find({ workspaceId }).lean<BrandDoc[]>(),
  ]);

  const products: OpportunityProduct[] = [];
  for (const product of productDocs) {
    const brand = canonicalBrand(product.brand, brandDocs);
    if (!brand) continue;
    products.push({
      id: String(product._id),
      name: product.name,
      brand,
      size: product.size ?? null,
      category: product.category ?? null,
      currency: product.currency ?? null,
    });
  }

  const knownBrands = new Set(products.map((p) => p.brand));
  let selected: string | null;
  if (query.brand === "all") selected = null;
  else if (query.brand) selected = canonicalBrand(query.brand, brandDocs);
  else {
    const focus = brandDocs.find((b) => b.isFocus);
    const focusName = focus ? canonicalBrand(focus.name, brandDocs) : null;
    selected = focusName && knownBrands.has(focusName) ? focusName : null;
  }

  const slug = selected ? (brandDocs.find((b) => b.name === selected)?.slug ?? null) : null;
  if (products.length === 0) return emptyResult(selected, slug);

  const sources = await ProductSource.find({
    workspaceId,
    productId: { $in: productDocs.map((p) => p._id) },
  }).lean<ProductSourceDoc[]>();
  const retailerIds = [...new Set(sources.map((s) => String(s.retailerId)))].map((id) => new Types.ObjectId(id));
  const [retailers, latest] = await Promise.all([
    Retailer.find({ workspaceId, _id: { $in: retailerIds } }).lean<RetailerDoc[]>(),
    getLatestObservationsBySource(sources.map((s) => s._id)),
  ]);

  const productBrand = new Map(products.map((p) => [p.id, p.brand]));
  return buildMarketOpportunities({
    products,
    retailers: retailers.map((r) => ({
      id: String(r._id),
      name: r.name,
      domain: r.domain,
      isOwnStore: Boolean(r.isOwnStore),
      isBrandStore: Boolean(r.isBrandStore),
    })),
    sources: sources
      .filter((s) => productBrand.has(String(s.productId)))
      .map((s) => ({
        id: String(s._id),
        productId: String(s.productId),
        retailerId: String(s.retailerId),
        url: s.url,
        isOwnStore: Boolean(s.isOwnStore),
        scrapingStatus: s.scrapingStatus,
      })),
    latest: new Map(
      [...latest.entries()].map(([id, obs]) => [
        id,
        {
          price: obs.price,
          currency: obs.currency ?? null,
          availability: obs.availability ?? "unknown",
          scrapedAt: obs.scrapedAt,
        },
      ]),
    ),
    brand: selected,
    focusBrands: new Set(brandDocs.filter((b) => b.isFocus).map((b) => b.name)),
    selectedBrandSlug: slug,
  });
}
