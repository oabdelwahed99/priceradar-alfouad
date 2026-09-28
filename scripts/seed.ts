/**
 * Demo data: pnpm seed          (replace demo data)
 *            pnpm seed --clear  (remove demo data only)
 *
 * Only documents flagged isDemo are touched; real products are never modified.
 */
import "./load-env";
import mongoose, { type Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import {
  DEMO_PRODUCT_COUNT,
  DEMO_RETAILERS,
  generateDemoCatalog,
  type DemoProduct,
  type DemoRetailerKey,
} from "@/lib/demo/demo-catalog";
import { detectAlerts, type SourceChange } from "@/lib/services/alerts/alert-rules";
import { buildPricingSummary, type SourcePriceInput } from "@/lib/services/pricing/pricing-summary";
import { getCurrentWorkspaceId } from "@/lib/workspace";
import { Alert, PriceObservation, Product, ProductSource, Retailer } from "@/models";

async function clearDemoData(workspaceId: string) {
  const demoProducts = await Product.find({ workspaceId, isDemo: true }, { _id: 1 }).lean();
  const productIds = demoProducts.map((p) => p._id);
  await Promise.all([
    ProductSource.deleteMany({ workspaceId, productId: { $in: productIds } }),
    PriceObservation.deleteMany({ workspaceId, productId: { $in: productIds } }),
    Alert.deleteMany({ workspaceId, productId: { $in: productIds } }),
    Product.deleteMany({ workspaceId, _id: { $in: productIds } }),
  ]);

  const demoRetailers = await Retailer.find({ workspaceId, isDemo: true }, { _id: 1 }).lean();
  const stillUsed = await ProductSource.distinct("retailerId", {
    workspaceId,
    retailerId: { $in: demoRetailers.map((r) => r._id) },
  });
  const used = new Set(stillUsed.map(String));
  await Retailer.deleteMany({ _id: { $in: demoRetailers.filter((r) => !used.has(String(r._id))).map((r) => r._id) } });
  return { products: productIds.length, retailers: demoRetailers.length - used.size };
}

async function ensureDemoRetailers(workspaceId: string): Promise<Map<DemoRetailerKey, Types.ObjectId>> {
  const ids = new Map<DemoRetailerKey, Types.ObjectId>();
  for (const r of DEMO_RETAILERS) {
    const doc = await Retailer.findOneAndUpdate(
      { workspaceId, domain: r.domain },
      { $set: { name: r.name, isOwnStore: r.isOwnStore, isDemo: true }, $setOnInsert: { workspaceId, domain: r.domain } },
      { upsert: true, returnDocument: "after" },
    ).lean();
    ids.set(r.key, doc!._id);
  }
  return ids;
}

type SourceIds = { sourceId: Types.ObjectId; retailerId: Types.ObjectId };

function sourceInputs(product: DemoProduct, ids: SourceIds[], offsetFromEnd: number): SourcePriceInput[] {
  return product.sources.map((s, i) => {
    const obs = s.failure && offsetFromEnd === 0 ? undefined : s.observations[s.observations.length - 1 - offsetFromEnd];
    return {
      sourceId: String(ids[i].sourceId),
      isOwnStore: s.isOwnStore,
      success: Boolean(obs),
      price: obs?.price ?? null,
      currency: obs ? product.currency : null,
      availability: obs?.availability ?? null,
    };
  });
}

async function seedProduct(workspaceId: string, product: DemoProduct, retailerIds: Map<DemoRetailerKey, Types.ObjectId>) {
  const doc = await Product.create({
    workspaceId,
    name: product.name,
    brand: product.brand,
    category: product.category,
    size: product.size,
    currency: product.currency,
    isDemo: true,
  });

  const sources = await ProductSource.insertMany(
    product.sources.map((s) => ({
      workspaceId,
      productId: doc._id,
      retailerId: retailerIds.get(s.retailerKey)!,
      url: s.url,
      isOwnStore: s.isOwnStore,
      sortOrder: s.sortOrder,
      lastScrapedAt: s.lastCheckedAt,
      scrapingStatus: s.failure ? "failed" : "success",
      lastError: s.failure?.message ?? null,
      lastErrorCode: s.failure?.code ?? null,
    })),
  );
  const ids: SourceIds[] = sources.map((s) => ({ sourceId: s._id, retailerId: s.retailerId }));

  await PriceObservation.insertMany(
    product.sources.flatMap((s, i) =>
      s.observations.map((o) => ({
        workspaceId,
        productId: doc._id,
        retailerId: ids[i].retailerId,
        sourceId: ids[i].sourceId,
        price: o.price,
        originalPrice: o.originalPrice,
        currency: product.currency,
        availability: o.availability,
        scrapedAt: o.at,
        isDemo: true,
      })),
    ),
  );

  const current = buildPricingSummary(sourceInputs(product, ids, 0), product.lastCheckedAt);
  const previous = buildPricingSummary(sourceInputs(product, ids, 1));
  await Product.updateOne({ _id: doc._id }, { $set: { latestAnalysis: current.snapshot, lastCheckedAt: product.lastCheckedAt } });

  const changes: SourceChange[] = product.sources.flatMap((s, i) => {
    if (s.failure || s.observations.length < 2) return [];
    const [prev, cur] = s.observations.slice(-2);
    const retailer = DEMO_RETAILERS.find((r) => r.key === s.retailerKey)!;
    return [
      {
        sourceId: String(ids[i].sourceId),
        retailerId: String(ids[i].retailerId),
        retailerName: retailer.name,
        isOwnStore: s.isOwnStore,
        previous: { price: prev.price, availability: prev.availability, currency: product.currency },
        current: { price: cur.price, availability: cur.availability, currency: product.currency },
      },
    ];
  });
  const drafts = detectAlerts({
    productName: product.name,
    changes,
    previousGap: previous.analysis.gapPercentage,
    currentGap: current.analysis.gapPercentage,
    marketMedian: current.analysis.marketMedian,
    currency: product.currency,
  });
  if (drafts.length > 0) {
    await Alert.insertMany(
      drafts.map((d) => ({
        workspaceId,
        productId: doc._id,
        retailerId: d.retailerId,
        sourceId: d.sourceId,
        type: d.type,
        title: d.title,
        message: d.message,
        payload: d.payload,
        createdAt: product.lastCheckedAt,
      })),
    );
  }

  const observations = product.sources.reduce((sum, s) => sum + s.observations.length, 0);
  return { position: current.snapshot.position, observations, alerts: drafts.length };
}

async function main() {
  const clearOnly = process.argv.includes("--clear");
  await connectToDatabase();
  const workspaceId = getCurrentWorkspaceId();

  const removed = await clearDemoData(workspaceId);
  console.log(`Removed ${removed.products} demo products and ${removed.retailers} demo retailers.`);
  if (clearOnly) return;

  const retailerIds = await ensureDemoRetailers(workspaceId);
  let observations = 0;
  let alerts = 0;
  for (const product of generateDemoCatalog()) {
    const result = await seedProduct(workspaceId, product, retailerIds);
    observations += result.observations;
    alerts += result.alerts;
    console.log(`  ${product.name.padEnd(16)} ${result.position ?? "INSUFFICIENT_DATA"}`);
  }
  console.log(
    `Seeded ${DEMO_RETAILERS.length} demo retailers, ${DEMO_PRODUCT_COUNT} demo products, ${observations} price observations and ${alerts} alerts (workspace "${workspaceId}").`,
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
