/**
 * Price sheet import: pnpm import:sheet
 *
 * Loads the products, store links and prices in scripts/data/hair-care-price-sheet.ts as real
 * (refreshable) products. Safe to re-run: only new products and store links are added.
 */
import "./load-env";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import { importPriceSheet } from "@/lib/services/imports/price-sheet-import.service";
import { PRICE_POSITION_LABELS } from "@/lib/services/pricing/price-position";
import { getCurrentWorkspaceId } from "@/lib/workspace";
import { hairCarePriceSheet } from "./data/hair-care-price-sheet";

async function main() {
  await connectToDatabase();
  const workspaceId = getCurrentWorkspaceId();
  const reports = await importPriceSheet(workspaceId, hairCarePriceSheet);

  for (const r of reports) {
    const position = r.position ? PRICE_POSITION_LABELS[r.position] : "Not enough data";
    const gap = r.gapPercentage === null ? "" : ` (${r.gapPercentage > 0 ? "+" : ""}${r.gapPercentage}% vs median)`;
    console.log(`${r.created ? "+" : "="} ${r.name}`);
    console.log(`    ${r.sourcesAdded} store links added, ${r.pricesRecorded} prices recorded. ${position}${gap}`);
    if (r.pendingStores.length > 0) console.log(`    No price yet: ${r.pendingStores.join(", ")}`);
    for (const s of r.skipped) {
      const why = s.reason === "MISSING_URL" ? "link missing" : "invalid link";
      console.log(`    Skipped ${s.storeName} (${why}${s.price !== null ? `, sheet price ${s.price}` : ""})`);
    }
  }

  const created = reports.filter((r) => r.created).length;
  const skipped = reports.reduce((n, r) => n + r.skipped.length, 0);
  console.log(
    `\nImported ${reports.length} products (${created} new) into workspace "${workspaceId}". ${skipped} cells skipped.`,
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
