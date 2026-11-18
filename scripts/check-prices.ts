/**
 * Price checkup: pnpm check:prices [hair|brand|all] [--store <key>] [--dry-run]
 *
 * Visits every store link in scripts/data/*-price-sheet.ts and compares the live price with
 * the sheet. Changed prices are written back into the sheet file; unchanged prices, failed
 * scrapes and suspicious jumps (over MAX_CHANGE) are left as they are.
 * Then run `pnpm import:sheet <sheet>` or refresh in the app to record them.
 */
import "./load-env";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PriceSheet } from "@/lib/services/imports/price-sheet-import.service";
import { roundPrice, setCellPrice } from "@/lib/services/imports/price-sheet-file";
import { closeBrowser } from "@/lib/services/scraping/browser";
import { scrapeMany } from "@/lib/services/scraping/scraper.service";
import { brandPriceSheet } from "./data/brand-price-sheet";
import { hairCarePriceSheet } from "./data/hair-care-price-sheet";

/** Relative change above which a new price is reported for review instead of written. */
const MAX_CHANGE = 0.5;

const SHEETS: Record<string, { sheet: PriceSheet; file: string }> = {
  hair: { sheet: hairCarePriceSheet, file: "scripts/data/hair-care-price-sheet.ts" },
  brand: { sheet: brandPriceSheet, file: "scripts/data/brand-price-sheet.ts" },
};

interface Target {
  product: string;
  store: string;
  url: string;
  price: number | null;
}

function targetsOf(sheet: PriceSheet, store: string | null): Target[] {
  const storeNames = new Map(sheet.stores.map((s) => [s.key, s.name]));
  return sheet.rows.flatMap((row) =>
    Object.entries(row.cells).flatMap(([key, cell]) =>
      cell?.url && (!store || key === store)
        ? [{ product: row.name, store: storeNames.get(key) ?? key, url: cell.url, price: cell.price ?? null }]
        : [],
    ),
  );
}

async function checkSheet(name: string, dryRun: boolean, store: string | null) {
  const { sheet, file } = SHEETS[name];
  const targets = targetsOf(sheet, store);
  if (targets.length === 0) return;
  console.log(`\nChecking ${targets.length} links in "${name}" sheet...`);

  const results = await scrapeMany(targets.map((t) => t.url));
  const changed: string[] = [];
  const review: string[] = [];
  const failed: string[] = [];
  let unchanged = 0;
  let source = await readFile(path.resolve(file), "utf8");

  results.forEach((result, i) => {
    const t = targets[i];
    const label = `${t.product} @ ${t.store}`;
    if (!result.success) {
      failed.push(`${label}: ${result.errorCode} (kept ${t.price ?? "no price"})`);
      return;
    }
    if (result.currency && result.currency !== sheet.currency) {
      failed.push(`${label}: page price is in ${result.currency}, not ${sheet.currency} (kept ${t.price ?? "no price"})`);
      return;
    }
    const live = roundPrice(result.price);
    if (t.price !== null && live === roundPrice(t.price)) {
      unchanged++;
      return;
    }
    if (t.price !== null && Math.abs(live - t.price) / t.price > MAX_CHANGE) {
      review.push(`${label}: ${t.price} -> ${live} (not applied, check ${t.url})`);
      return;
    }
    changed.push(`${label}: ${t.price ?? "none"} -> ${live}`);
    source = setCellPrice(source, t.url, live);
  });

  if (changed.length > 0 && !dryRun) await writeFile(path.resolve(file), source);

  for (const line of changed) console.log(`  ~ ${line}`);
  for (const line of review) console.log(`  ? ${line}`);
  for (const line of failed) console.log(`  ! ${line}`);
  console.log(
    `"${name}": ${changed.length} changed${dryRun ? " (dry run, not saved)" : ""}, ${unchanged} unchanged, ` +
      `${review.length} need review, ${failed.length} could not be checked.`,
  );
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const storeFlag = args.indexOf("--store");
  const store = storeFlag === -1 ? null : (args[storeFlag + 1]?.toLowerCase() ?? null);
  const sheetArg = (args.find((a, i) => !a.startsWith("--") && i !== storeFlag + 1) ?? "all").toLowerCase();
  const names = sheetArg === "all" ? Object.keys(SHEETS) : [sheetArg];
  const unknown = names.find((n) => !SHEETS[n]);
  if (unknown) {
    console.error(`Unknown sheet "${unknown}". Use: ${[...Object.keys(SHEETS), "all"].join(", ")}`);
    process.exitCode = 1;
    return;
  }
  for (const name of names) await checkSheet(name, dryRun, store);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => closeBrowser());
