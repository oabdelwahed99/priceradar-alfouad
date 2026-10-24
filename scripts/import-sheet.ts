/**
 * Price sheet import: pnpm import:sheet [hair|brand]
 *
 * Loads products, store links and prices from scripts/data/*-price-sheet.ts as real
 * (refreshable) products. Safe to re-run: only new products and store links are added.
 * Default sheet is hair. Use `pnpm import:sheet brand` for the Dermaelle/Bobai sheet.
 */
import "./load-env";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import { ensureBrands } from "@/lib/services/brands/brand.service";
import { importPriceSheet, type PriceSheet } from "@/lib/services/imports/price-sheet-import.service";
import { PRICE_POSITION_LABELS } from "@/lib/services/pricing/price-position";
import { getCurrentWorkspaceId } from "@/lib/workspace";
import { brandPriceSheet } from "./data/brand-price-sheet";
import { hairCarePriceSheet } from "./data/hair-care-price-sheet";

const SHEETS: Record<string, PriceSheet> = {
  hair: hairCarePriceSheet,
  brand: brandPriceSheet,
};

async function main() {
  const sheetName = (process.argv[2] ?? "hair").toLowerCase();
  const sheet = SHEETS[sheetName];
  if (!sheet) {
    console.error(`Unknown sheet "${sheetName}". Use: ${Object.keys(SHEETS).join(", ")}`);
    process.exitCode = 1;
    return;
  }

  await connectToDatabase();
  const workspaceId = getCurrentWorkspaceId();
  if (sheetName === "brand") await ensureBrands(workspaceId);
  const reports = await importPriceSheet(workspaceId, sheet);

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
    `\nImported ${reports.length} products (${created} new) from "${sheetName}" into workspace "${workspaceId}". ${skipped} cells skipped.`,
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
