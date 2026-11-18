/**
 * Re-scrape one store: pnpm refresh:store <domain|all>   (e.g. sourcebeauty.com)
 *
 * Runs the app's refresh (same as the refresh button) for every product link on that store,
 * recording fresh prices in the database. Links that fail only temporarily (bot check, timeout)
 * keep their last known price instead of dropping out of the comparison.
 */
import "./load-env";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import { normalizeDomain } from "@/lib/services/retailers/domain";
import { compareProduct, recomputeProductAnalysis } from "@/lib/services/comparison/comparison.service";
import { closeBrowser } from "@/lib/services/scraping/browser";
import { getCurrentWorkspaceId } from "@/lib/workspace";
import { Product, ProductSource, Retailer } from "@/models";

async function main() {
  const input = process.argv[2];
  if (!input) {
    console.error("Usage: pnpm refresh:store <domain|all>");
    process.exitCode = 1;
    return;
  }
  await connectToDatabase();
  const workspaceId = getCurrentWorkspaceId();
  const retailer = input === "all" ? null : await Retailer.findOne({ workspaceId, domain: toDomain(input) }).lean();
  if (input !== "all" && !retailer) {
    console.error(`No store with domain "${toDomain(input)}" in workspace "${workspaceId}".`);
    process.exitCode = 1;
    return;
  }

  const realProducts = await Product.find({ workspaceId, isDemo: { $ne: true } }, { _id: 1 }).lean();
  const sources = await ProductSource.find({
    workspaceId,
    productId: { $in: realProducts.map((p) => p._id) },
    ...(retailer ? { retailerId: retailer._id } : {}),
  }).lean();
  const urls = new Map(sources.map((s) => [String(s._id), s.url]));
  const byProduct = new Map<string, string[]>();
  for (const s of sources) {
    const key = String(s.productId);
    byProduct.set(key, [...(byProduct.get(key) ?? []), String(s._id)]);
  }
  console.log(`Refreshing ${sources.length} links on ${retailer?.name ?? "all stores"} across ${byProduct.size} products...`);

  const before = new Map(sources.map((s) => [String(s._id), s]));
  let ok = 0;
  let kept = 0;
  for (const [productId, sourceIds] of byProduct) {
    const run = await compareProduct(workspaceId, productId, { sourceIds });
    let restored = false;
    for (const r of run.results) {
      const prev = before.get(r.sourceId);
      if (r.success) ok++;
      else if (r.errorCode && TRANSIENT_ERRORS.has(r.errorCode) && prev?.scrapingStatus === "success") {
        await ProductSource.updateOne(
          { _id: prev._id },
          { $set: { scrapingStatus: "success", lastScrapedAt: prev.lastScrapedAt, lastError: null, lastErrorCode: null } },
        );
        restored = true;
        kept++;
      }
      const outcome = r.success ? `${r.price} ${r.currency ?? ""}`.trim() : `failed (${r.errorCode})`;
      console.log(`  ${outcome.padEnd(22)} ${urls.get(r.sourceId) ?? r.sourceId}`);
    }
    if (restored) await recomputeProductAnalysis(workspaceId, productId, new Date(), { updateLastCheckedAt: false });
  }
  console.log(`\n${ok}/${sources.length} links updated, ${kept} kept their last known price after a temporary failure.`);
}

const toDomain = (input: string) => normalizeDomain(input.includes("://") ? input : `https://${input}`);

/** Failures that say nothing about the product (bot check, slow site), so the last known price stays valid. */
const TRANSIENT_ERRORS = new Set<string>(["BLOCKED", "TIMEOUT", "RENDER_FAILURE", "EMPTY_PAGE"]);

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeBrowser();
    await mongoose.disconnect();
  });
