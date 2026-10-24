import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import { NotFoundError } from "@/lib/errors";
import { Brand, Product, ProductSource, Retailer, type BrandDoc, type ProductSourceDoc, type RetailerDoc } from "@/models";
import type { BrandDetailDTO, BrandListItemDTO, BrandStoreComplianceDTO, PriceMatrixDTO } from "@/types/dto";
import { getLatestObservationsBySource } from "../prices/price-observation.service";
import { competitorDifferencePercentage, isValidPrice } from "../pricing/pricing-analysis.service";
import { buildPriceMatrix } from "../matrix/price-matrix.service";
import type { LeanProduct } from "../products/product.service";

export const FOCUS_BRANDS = [
  { name: "Dermaelle", slug: "dermaelle", officialDomain: "e-dermaelle.com", isFocus: true },
  { name: "Bobai", slug: "bobai", officialDomain: "eparkville.com", isFocus: false },
] as const;

/** Creates Dermaelle and Bobai if missing. Safe to call on every brand import. */
export async function ensureBrands(workspaceId: string): Promise<BrandDoc[]> {
  await connectToDatabase();
  const out: BrandDoc[] = [];
  for (const b of FOCUS_BRANDS) {
    const doc = await Brand.findOneAndUpdate(
      { workspaceId, slug: b.slug },
      {
        $set: { name: b.name, officialDomain: b.officialDomain, isFocus: b.isFocus },
        $setOnInsert: { workspaceId, slug: b.slug },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    ).lean<BrandDoc>();
    out.push(doc!);
  }
  return out;
}

export async function getBrandBySlug(workspaceId: string, slug: string): Promise<BrandDoc> {
  await connectToDatabase();
  const brand = await Brand.findOne({ workspaceId, slug: slug.toLowerCase() }).lean<BrandDoc>();
  if (!brand) throw new NotFoundError("Brand");
  return brand;
}

async function productsForBrand(workspaceId: string, brandName: string): Promise<LeanProduct[]> {
  return Product.find({ workspaceId, brand: brandName, isDemo: { $ne: true } })
    .collation({ locale: "en", strength: 2 })
    .sort({ name: 1 })
    .lean<LeanProduct[]>();
}

function computeStoreCompliance(
  products: LeanProduct[],
  sources: ProductSourceDoc[],
  retailers: RetailerDoc[],
  latest: Map<string, { price: number; availability?: string | null }>,
): BrandStoreComplianceDTO[] {
  const retailerById = new Map(retailers.map((r) => [String(r._id), r]));
  const ownByProduct = new Map<string, number>();
  for (const s of sources) {
    if (!s.isOwnStore) continue;
    const obs = latest.get(String(s._id));
    if (obs && isValidPrice(obs.price)) ownByProduct.set(String(s.productId), obs.price);
  }

  type Acc = {
    retailerId: string;
    name: string;
    domain: string;
    isBrandStore: boolean;
    listings: number;
    belowOfficial: number;
    aboveOfficial: number;
    outOfStock: number;
    gapSum: number;
    gapCount: number;
  };
  const byRetailer = new Map<string, Acc>();

  for (const s of sources) {
    if (s.isOwnStore) continue;
    const retailer = retailerById.get(String(s.retailerId));
    if (!retailer) continue;
    const key = String(retailer._id);
    const acc =
      byRetailer.get(key) ??
      ({
        retailerId: key,
        name: retailer.name,
        domain: retailer.domain,
        isBrandStore: Boolean(retailer.isBrandStore),
        listings: 0,
        belowOfficial: 0,
        aboveOfficial: 0,
        outOfStock: 0,
        gapSum: 0,
        gapCount: 0,
      } satisfies Acc);
    acc.listings += 1;
    const obs = latest.get(String(s._id));
    if (obs?.availability === "out_of_stock") acc.outOfStock += 1;
    const official = ownByProduct.get(String(s.productId));
    if (obs && isValidPrice(obs.price) && official !== undefined && obs.availability !== "out_of_stock") {
      const gap = competitorDifferencePercentage(obs.price, official);
      acc.gapSum += gap;
      acc.gapCount += 1;
      if (gap < -0.05) acc.belowOfficial += 1;
      else if (gap > 0.05) acc.aboveOfficial += 1;
    }
    byRetailer.set(key, acc);
  }

  return [...byRetailer.values()]
    .map(
      (a): BrandStoreComplianceDTO => ({
        retailerId: a.retailerId,
        name: a.name,
        domain: a.domain,
        isBrandStore: a.isBrandStore,
        listings: a.listings,
        belowOfficial: a.belowOfficial,
        aboveOfficial: a.aboveOfficial,
        outOfStock: a.outOfStock,
        averageGapPercentage: a.gapCount ? Math.round((a.gapSum / a.gapCount) * 100) / 100 : null,
      }),
    )
    .sort((a, b) => b.listings - a.listings || a.name.localeCompare(b.name));
}

function summarizeBrand(
  brand: BrandDoc,
  products: LeanProduct[],
  sources: ProductSourceDoc[],
  retailers: RetailerDoc[],
  latest: Map<string, { price: number; availability?: string | null }>,
): BrandListItemDTO {
  const compliance = computeStoreCompliance(products, sources, retailers, latest);
  return {
    id: String(brand._id),
    name: brand.name,
    slug: brand.slug,
    officialDomain: brand.officialDomain,
    isFocus: Boolean(brand.isFocus),
    productCount: products.length,
    storeCount: compliance.length,
    belowOfficial: compliance.reduce((n, c) => n + c.belowOfficial, 0),
    aboveOfficial: compliance.reduce((n, c) => n + c.aboveOfficial, 0),
    outOfStock: compliance.reduce((n, c) => n + c.outOfStock, 0),
  };
}

export async function listBrands(workspaceId: string): Promise<BrandListItemDTO[]> {
  await connectToDatabase();
  await ensureBrands(workspaceId);
  const brands = await Brand.find({ workspaceId }).lean<BrandDoc[]>();
  const items: BrandListItemDTO[] = [];
  for (const brand of brands) {
    const products = await productsForBrand(workspaceId, brand.name);
    const sources = await ProductSource.find({
      workspaceId,
      productId: { $in: products.map((p) => p._id) },
    }).lean<ProductSourceDoc[]>();
    const retailerIds = [...new Set(sources.map((s) => String(s.retailerId)))].map((id) => new Types.ObjectId(id));
    const [retailers, latest] = await Promise.all([
      Retailer.find({ workspaceId, _id: { $in: retailerIds } }).lean<RetailerDoc[]>(),
      getLatestObservationsBySource(sources.map((s) => s._id)),
    ]);
    items.push(summarizeBrand(brand, products, sources, retailers, latest));
  }
  return items.sort((a, b) => Number(b.isFocus) - Number(a.isFocus) || a.name.localeCompare(b.name));
}

export async function getBrandDetail(workspaceId: string, slug: string): Promise<BrandDetailDTO & { matrix: PriceMatrixDTO }> {
  await connectToDatabase();
  const brand = await getBrandBySlug(workspaceId, slug);
  const products = await productsForBrand(workspaceId, brand.name);
  const sources = await ProductSource.find({
    workspaceId,
    productId: { $in: products.map((p) => p._id) },
  }).lean<ProductSourceDoc[]>();
  const retailerIds = [...new Set(sources.map((s) => String(s.retailerId)))].map((id) => new Types.ObjectId(id));
  const [retailers, latest] = await Promise.all([
    Retailer.find({ workspaceId, _id: { $in: retailerIds } }).lean<RetailerDoc[]>(),
    getLatestObservationsBySource(sources.map((s) => s._id)),
  ]);
  const storeCompliance = computeStoreCompliance(products, sources, retailers, latest);
  const matrix = {
    ...buildPriceMatrix({ products, sources, retailers, latest }),
    categories: [],
    demoProductCount: 0,
    truncated: false,
  };
  return {
    id: String(brand._id),
    name: brand.name,
    slug: brand.slug,
    officialDomain: brand.officialDomain,
    isFocus: Boolean(brand.isFocus),
    productCount: products.length,
    storeCompliance,
    matrix,
  };
}
