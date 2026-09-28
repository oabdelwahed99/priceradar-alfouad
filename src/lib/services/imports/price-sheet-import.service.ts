import { connectToDatabase } from "@/lib/db/mongoose";
import { currencySchema, httpUrlSchema } from "@/lib/validation/common";
import { Product, ProductSource, Retailer, type RetailerDoc } from "@/models";
import type { Availability, PricePosition } from "@/types";
import { recomputeProductAnalysis } from "../comparison/comparison.service";
import { recordObservation } from "../prices/price-observation.service";
import { isValidPrice } from "../pricing/pricing-analysis.service";
import { normalizeDomain } from "../retailers/domain";

/** A column of the sheet: one store. Exactly one store must be the own store. */
export interface PriceSheetStore {
  key: string;
  name: string;
  isOwnStore?: boolean;
}

/** `url` missing means the store has no usable link for this product; `price` missing means none was recorded. */
export interface PriceSheetCell {
  url?: string | null;
  price?: number | null;
  outOfStock?: boolean;
}

export interface PriceSheetRow {
  name: string;
  brand?: string;
  size?: string;
  cells: Partial<Record<string, PriceSheetCell>>;
}

export interface PriceSheet {
  currency: string;
  category?: string;
  stores: PriceSheetStore[];
  rows: PriceSheetRow[];
}

export type SheetSkipReason = "MISSING_URL" | "INVALID_URL";

export interface PlannedSource {
  storeName: string;
  isOwnStore: boolean;
  url: string;
  domain: string;
  sortOrder: number;
  price: number | null;
  availability: Availability;
}

export interface PlannedRow {
  name: string;
  brand: string | null;
  size: string | null;
  sources: PlannedSource[];
  skipped: { storeName: string; reason: SheetSkipReason; price: number | null }[];
}

/** Validates the sheet and decides, per cell, what will be stored. Performs no I/O. */
export function planPriceSheet(sheet: PriceSheet): { currency: string; rows: PlannedRow[] } {
  const currency = currencySchema.parse(sheet.currency);
  const ownStores = sheet.stores.filter((s) => s.isOwnStore);
  if (ownStores.length !== 1) throw new Error(`A price sheet needs exactly one own store, found ${ownStores.length}`);
  const keys = new Set(sheet.stores.map((s) => s.key));
  const ordered = [...ownStores, ...sheet.stores.filter((s) => !s.isOwnStore)];

  const rows = sheet.rows.map((row): PlannedRow => {
    for (const key of Object.keys(row.cells)) {
      if (!keys.has(key)) throw new Error(`"${row.name}" has a value for unknown store "${key}"`);
    }
    const planned: PlannedRow = {
      name: row.name.trim(),
      brand: row.brand?.trim() || null,
      size: row.size?.trim() || null,
      sources: [],
      skipped: [],
    };
    ordered.forEach((store, sortOrder) => {
      const cell = row.cells[store.key];
      if (!cell) return;
      const price = isValidPrice(cell.price) ? cell.price : null;
      if (!cell.url) {
        if (price !== null) planned.skipped.push({ storeName: store.name, reason: "MISSING_URL", price });
        return;
      }
      const url = httpUrlSchema.safeParse(cell.url);
      if (!url.success) {
        planned.skipped.push({ storeName: store.name, reason: "INVALID_URL", price });
        return;
      }
      planned.sources.push({
        storeName: store.name,
        isOwnStore: Boolean(store.isOwnStore),
        url: url.data,
        domain: normalizeDomain(url.data),
        sortOrder,
        price,
        availability: cell.outOfStock ? "out_of_stock" : "unknown",
      });
    });
    return planned;
  });

  const names = new Set<string>();
  for (const row of rows) {
    const key = row.name.toLowerCase();
    if (names.has(key)) throw new Error(`Duplicate product name in sheet: "${row.name}"`);
    names.add(key);
  }
  return { currency, rows };
}

export interface PriceSheetImportRowReport {
  name: string;
  productId: string;
  created: boolean;
  sourcesAdded: number;
  pricesRecorded: number;
  /** Store links added without a price; they get one on the next price check. */
  pendingStores: string[];
  skipped: PlannedRow["skipped"];
  position: PricePosition | null;
  gapPercentage: number | null;
}

async function upsertRetailer(workspaceId: string, source: PlannedSource): Promise<RetailerDoc> {
  const retailer = await Retailer.findOneAndUpdate(
    { workspaceId, domain: source.domain },
    {
      $setOnInsert: { workspaceId, domain: source.domain, name: source.storeName },
      ...(source.isOwnStore ? { $set: { isOwnStore: true } } : {}),
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  ).lean<RetailerDoc>();
  return retailer!;
}

/**
 * Creates or extends real (non-demo) products from a price sheet. Products are matched by name
 * and store links by URL, so re-running only adds what is new. A sheet price is stored as a
 * manual observation only when its store link is first added, so re-runs never duplicate history.
 */
export async function importPriceSheet(
  workspaceId: string,
  sheet: PriceSheet,
  importedAt: Date = new Date(),
): Promise<PriceSheetImportRowReport[]> {
  const plan = planPriceSheet(sheet);
  await connectToDatabase();

  const retailers = new Map<string, RetailerDoc>();
  const reports: PriceSheetImportRowReport[] = [];

  for (const row of plan.rows) {
    let product = await Product.findOne({ workspaceId, name: row.name, isDemo: { $ne: true } }).lean();
    const created = !product;
    if (!product) {
      const doc = await Product.create({
        workspaceId,
        name: row.name,
        brand: row.brand,
        size: row.size,
        category: sheet.category ?? null,
        currency: plan.currency,
      });
      product = doc.toObject();
    }

    let sourcesAdded = 0;
    let pricesRecorded = 0;
    const pendingStores: string[] = [];
    for (const planned of row.sources) {
      const exists = await ProductSource.exists({ productId: product._id, url: planned.url });
      if (exists) continue;

      let retailer = retailers.get(planned.domain);
      if (!retailer) {
        retailer = await upsertRetailer(workspaceId, planned);
        retailers.set(planned.domain, retailer);
      }
      const hasPrice = planned.price !== null;
      const source = await ProductSource.create({
        workspaceId,
        productId: product._id,
        retailerId: retailer._id,
        url: planned.url,
        isOwnStore: planned.isOwnStore,
        sortOrder: planned.sortOrder,
        scrapingStatus: hasPrice ? "success" : "pending",
        lastScrapedAt: hasPrice ? importedAt : null,
      });
      sourcesAdded++;

      if (hasPrice) {
        await recordObservation({
          workspaceId,
          productId: product._id,
          retailerId: retailer._id,
          sourceId: source._id,
          price: planned.price!,
          originalPrice: null,
          currency: plan.currency,
          availability: planned.availability,
          scrapedAt: importedAt,
          origin: "manual",
        });
        pricesRecorded++;
      } else {
        pendingStores.push(planned.storeName);
      }
    }

    const snapshot =
      created || sourcesAdded > 0
        ? (await recomputeProductAnalysis(workspaceId, String(product._id), importedAt)).snapshot
        : product.latestAnalysis;
    reports.push({
      name: row.name,
      productId: String(product._id),
      created,
      sourcesAdded,
      pricesRecorded,
      pendingStores,
      skipped: row.skipped,
      position: (snapshot?.position ?? null) as PricePosition | null,
      gapPercentage: snapshot?.gapPercentage ?? null,
    });
  }
  return reports;
}
