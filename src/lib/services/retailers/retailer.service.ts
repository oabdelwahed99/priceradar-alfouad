import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import { assertObjectId } from "@/lib/db/object-id";
import { ConflictError, NotFoundError } from "@/lib/errors";
import type { CreateRetailerInput, UpdateRetailerInput } from "@/lib/validation/retailer.schema";
import { Alert, PriceObservation, ProductSource, Retailer, type RetailerDoc } from "@/models";
import type { RetailerDTO, RetailerWithStatsDTO } from "@/types/dto";
import { toIso, toRetailerDTO } from "../mappers";
import { normalizeDomain, retailerNameFromDomain } from "./domain";

/**
 * Finds the retailer for a URL's domain, creating it if needed. Atomic via upsert on the
 * unique (workspaceId, domain) index, so concurrent product creation cannot duplicate retailers.
 */
export async function findOrCreateRetailerForUrl(
  workspaceId: string,
  url: string,
  isOwnStore: boolean,
): Promise<RetailerDoc> {
  await connectToDatabase();
  const domain = normalizeDomain(url);
  const retailer = await Retailer.findOneAndUpdate(
    { workspaceId, domain },
    {
      $setOnInsert: { workspaceId, domain, name: retailerNameFromDomain(domain) },
      ...(isOwnStore ? { $set: { isOwnStore: true } } : {}),
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  ).lean<RetailerDoc>();
  return retailer!;
}

export async function listRetailers(workspaceId: string): Promise<RetailerDTO[]> {
  await connectToDatabase();
  const retailers = await Retailer.find({ workspaceId }).sort({ isOwnStore: -1, name: 1 }).lean<RetailerDoc[]>();
  return retailers.map(toRetailerDTO);
}

export async function listRetailersWithStats(workspaceId: string): Promise<RetailerWithStatsDTO[]> {
  await connectToDatabase();
  const [retailers, stats] = await Promise.all([
    Retailer.find({ workspaceId }).sort({ isOwnStore: -1, name: 1 }).lean<RetailerDoc[]>(),
    ProductSource.aggregate<{
      _id: Types.ObjectId;
      products: Types.ObjectId[];
      lastScrapedAt: Date | null;
      failed: number;
      succeeded: number;
    }>([
      { $match: { workspaceId } },
      {
        $group: {
          _id: "$retailerId",
          products: { $addToSet: "$productId" },
          lastScrapedAt: { $max: "$lastScrapedAt" },
          failed: { $sum: { $cond: [{ $eq: ["$scrapingStatus", "failed"] }, 1, 0] } },
          succeeded: { $sum: { $cond: [{ $eq: ["$scrapingStatus", "success"] }, 1, 0] } },
        },
      },
    ]),
  ]);

  const byRetailer = new Map(stats.map((s) => [String(s._id), s]));
  return retailers.map((r) => {
    const s = byRetailer.get(String(r._id));
    const failed = s?.failed ?? 0;
    const succeeded = s?.succeeded ?? 0;
    let status: RetailerWithStatsDTO["status"] = "idle";
    if (failed + succeeded > 0) {
      status = failed === 0 ? "healthy" : succeeded === 0 ? "failing" : "degraded";
    }
    return {
      ...toRetailerDTO(r),
      productsMonitored: s?.products.length ?? 0,
      lastScrapedAt: toIso(s?.lastScrapedAt),
      failedSources: failed,
      status,
    };
  });
}

export async function createRetailer(workspaceId: string, input: CreateRetailerInput): Promise<RetailerDTO> {
  await connectToDatabase();
  const existing = await Retailer.exists({ workspaceId, domain: input.domain });
  if (existing) throw new ConflictError(`A retailer for ${input.domain} already exists`);
  const retailer = await Retailer.create({ ...input, workspaceId });
  return toRetailerDTO(retailer);
}

export async function updateRetailer(
  workspaceId: string,
  id: string,
  input: UpdateRetailerInput,
): Promise<RetailerDTO> {
  assertObjectId(id, "Retailer");
  await connectToDatabase();
  const retailer = await Retailer.findOneAndUpdate(
    { _id: id, workspaceId },
    { $set: { name: input.name } },
    { returnDocument: "after" },
  ).lean<RetailerDoc>();
  if (!retailer) throw new NotFoundError("Retailer");
  return toRetailerDTO(retailer);
}

export async function deleteRetailer(workspaceId: string, id: string): Promise<void> {
  assertObjectId(id, "Retailer");
  await connectToDatabase();
  const retailer = await Retailer.exists({ _id: id, workspaceId });
  if (!retailer) throw new NotFoundError("Retailer");

  const sources = await ProductSource.find({ workspaceId, retailerId: id })
    .select("productId")
    .lean<{ productId: Types.ObjectId }[]>();
  const productIds = [...new Set(sources.map((source) => String(source.productId)))];

  await Promise.all([
    ProductSource.deleteMany({ workspaceId, retailerId: id }),
    PriceObservation.deleteMany({ workspaceId, retailerId: id }),
    Alert.deleteMany({ workspaceId, retailerId: id }),
    Retailer.deleteOne({ _id: id, workspaceId }),
  ]);

  if (productIds.length === 0) return;
  // Imported lazily: comparison.service loads product.service, which loads this module.
  const { recomputeProductAnalysis } = await import("../comparison/comparison.service");
  await Promise.all(
    productIds.map((productId) =>
      recomputeProductAnalysis(workspaceId, productId, new Date(), { updateLastCheckedAt: false }),
    ),
  );
}
