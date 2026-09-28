import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import { assertObjectId } from "@/lib/db/object-id";
import { NotFoundError } from "@/lib/errors";
import type { CreateProductInput, ListProductsQuery, ProductSortField } from "@/lib/validation/product.schema";
import {
  Alert,
  PriceObservation,
  Product,
  ProductContentSnapshot,
  ProductSource,
  Retailer,
  type ProductDoc,
  type ProductSourceDoc,
  type RetailerDoc,
} from "@/models";
import type { AnalysisSnapshot, Availability, ScrapeErrorCode, ScrapingStatus } from "@/types";
import type { PaginatedDTO, ProductDetailDTO, ProductListItemDTO, ProductSourceDTO } from "@/types/dto";
import { toAnalysisDTO, toIso, toRetailerDTO } from "../mappers";
import { getLatestObservationsBySource } from "../prices/price-observation.service";
import { findOrCreateRetailerForUrl } from "../retailers/retailer.service";

const SORT_FIELD_MAP: Record<ProductSortField, string> = {
  name: "name",
  brand: "brand",
  ownPrice: "latestAnalysis.ownPrice",
  marketMedian: "latestAnalysis.marketMedian",
  gap: "latestAnalysis.gapPercentage",
  suggestedPrice: "latestAnalysis.suggestedPrice",
  lastCheckedAt: "lastCheckedAt",
};

export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function createProduct(workspaceId: string, input: CreateProductInput): Promise<{ id: string }> {
  await connectToDatabase();

  const ownRetailer = await findOrCreateRetailerForUrl(workspaceId, input.ownStoreUrl, true);
  const competitorRetailers: RetailerDoc[] = [];
  for (const url of input.competitorUrls) {
    competitorRetailers.push(await findOrCreateRetailerForUrl(workspaceId, url, false));
  }

  const product = await Product.create({
    workspaceId,
    name: input.name,
    brand: input.brand ?? null,
    category: input.category ?? null,
    size: input.size ?? null,
  });

  try {
    await ProductSource.insertMany([
      {
        workspaceId,
        productId: product._id,
        retailerId: ownRetailer._id,
        url: input.ownStoreUrl,
        isOwnStore: true,
        sortOrder: 0,
      },
      ...input.competitorUrls.map((url, i) => ({
        workspaceId,
        productId: product._id,
        retailerId: competitorRetailers[i]._id,
        url,
        isOwnStore: false,
        sortOrder: i + 1,
      })),
    ]);
  } catch (error) {
    await Product.deleteOne({ _id: product._id });
    throw error;
  }

  return { id: String(product._id) };
}

export type LeanProduct = ProductDoc & { latestAnalysis: AnalysisSnapshot | null };

export function toProductListItem(p: LeanProduct, sourceCount: number): ProductListItemDTO {
  return {
    id: String(p._id),
    name: p.name,
    brand: p.brand ?? null,
    size: p.size ?? null,
    currency: p.currency ?? null,
    lastCheckedAt: toIso(p.lastCheckedAt),
    analysis: toAnalysisDTO(p.latestAnalysis),
    sourceCount,
    isDemo: Boolean(p.isDemo),
  };
}

export async function countSourcesByProduct(productIds: Types.ObjectId[]): Promise<Map<string, number>> {
  if (productIds.length === 0) return new Map();
  const rows = await ProductSource.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { productId: { $in: productIds } } },
    { $group: { _id: "$productId", count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.count]));
}

export async function listProducts(
  workspaceId: string,
  query: ListProductsQuery,
): Promise<PaginatedDTO<ProductListItemDTO>> {
  await connectToDatabase();

  const filter: Record<string, unknown> = { workspaceId };
  if (query.q) {
    const rx = new RegExp(escapeRegex(query.q), "i");
    filter.$or = [{ name: rx }, { brand: rx }];
  }
  if (query.position) filter["latestAnalysis.position"] = query.position;

  const direction = query.order === "asc" ? 1 : -1;
  const sort: Record<string, 1 | -1> = { [SORT_FIELD_MAP[query.sort]]: direction, _id: direction };

  const [total, products] = await Promise.all([
    Product.countDocuments(filter),
    Product.find(filter)
      .sort(sort)
      .skip((query.page - 1) * query.pageSize)
      .limit(query.pageSize)
      .lean<LeanProduct[]>(),
  ]);

  const counts = await countSourcesByProduct(products.map((p) => p._id));
  return {
    items: products.map((p) => toProductListItem(p, counts.get(String(p._id)) ?? 0)),
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

export async function getProductDoc(workspaceId: string, id: string): Promise<LeanProduct> {
  assertObjectId(id, "Product");
  await connectToDatabase();
  const product = await Product.findOne({ _id: id, workspaceId }).lean<LeanProduct>();
  if (!product) throw new NotFoundError("Product");
  return product;
}

export async function getProductSources(
  workspaceId: string,
  productId: string,
): Promise<{ source: ProductSourceDoc; retailer: RetailerDoc }[]> {
  await connectToDatabase();
  const sources = await ProductSource.find({ workspaceId, productId })
    .sort({ sortOrder: 1 })
    .lean<ProductSourceDoc[]>();
  const retailers = await Retailer.find({ _id: { $in: sources.map((s) => s.retailerId) } }).lean<RetailerDoc[]>();
  const byId = new Map(retailers.map((r) => [String(r._id), r]));
  return sources
    .filter((s) => byId.has(String(s.retailerId)))
    .map((source) => ({ source, retailer: byId.get(String(source.retailerId))! }));
}

export async function getProductDetail(workspaceId: string, id: string): Promise<ProductDetailDTO> {
  const product = await getProductDoc(workspaceId, id);
  const sources = await getProductSources(workspaceId, id);
  const latest = await getLatestObservationsBySource(sources.map((s) => s.source._id));

  const sourceDTOs: ProductSourceDTO[] = sources.map(({ source, retailer }) => {
    const obs = latest.get(String(source._id));
    return {
      id: String(source._id),
      url: source.url,
      isOwnStore: Boolean(source.isOwnStore),
      retailer: toRetailerDTO(retailer),
      scrapingStatus: (source.scrapingStatus ?? "pending") as ScrapingStatus,
      lastScrapedAt: toIso(source.lastScrapedAt),
      lastError: source.lastError ?? null,
      lastErrorCode: (source.lastErrorCode ?? null) as ScrapeErrorCode | null,
      latest: obs
        ? {
            price: obs.price,
            originalPrice: obs.originalPrice ?? null,
            currency: obs.currency ?? null,
            availability: (obs.availability ?? "unknown") as Availability,
            scrapedAt: toIso(obs.scrapedAt)!,
          }
        : null,
    };
  });

  return {
    id: String(product._id),
    name: product.name,
    brand: product.brand ?? null,
    category: product.category ?? null,
    size: product.size ?? null,
    currency: product.currency ?? null,
    imageUrl: product.imageUrl ?? null,
    lastCheckedAt: toIso(product.lastCheckedAt),
    createdAt: toIso(product.createdAt)!,
    analysis: toAnalysisDTO(product.latestAnalysis),
    sources: sourceDTOs,
    isDemo: Boolean(product.isDemo),
  };
}

export async function deleteProduct(workspaceId: string, id: string): Promise<void> {
  assertObjectId(id, "Product");
  await connectToDatabase();
  const res = await Product.deleteOne({ _id: id, workspaceId });
  if (res.deletedCount === 0) throw new NotFoundError("Product");
  await Promise.all([
    ProductSource.deleteMany({ workspaceId, productId: id }),
    PriceObservation.deleteMany({ workspaceId, productId: id }),
    Alert.deleteMany({ workspaceId, productId: id }),
    ProductContentSnapshot.deleteMany({ workspaceId, productId: id }),
  ]);
}
