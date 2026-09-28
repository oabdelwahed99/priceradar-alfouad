import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import type { PriceMatrixQuery } from "@/lib/validation/matrix.schema";
import {
  Product,
  ProductSource,
  Retailer,
  type PriceObservationDoc,
  type ProductSourceDoc,
  type RetailerDoc,
} from "@/models";
import type { PriceMatrixCellDTO, PriceMatrixCellState, PriceMatrixColumnDTO, PriceMatrixDTO, PriceMatrixRowDTO } from "@/types/dto";
import { toAnalysisDTO, toIso } from "../mappers";
import { getLatestObservationsBySource } from "../prices/price-observation.service";
import { competitorDifferencePercentage, isValidPrice } from "../pricing/pricing-analysis.service";
import { PRICE_POSITION_LABELS } from "../pricing/price-position";
import { escapeRegex, type LeanProduct } from "../products/product.service";

export const PRICE_MATRIX_MAX_PRODUCTS = 500;

type MatrixSource = Pick<
  ProductSourceDoc,
  "_id" | "productId" | "retailerId" | "url" | "isOwnStore" | "sortOrder" | "scrapingStatus" | "lastError"
>;
type MatrixObservation = Pick<PriceObservationDoc, "price" | "currency" | "availability" | "scrapedAt" | "origin">;
type MatrixRetailer = Pick<RetailerDoc, "_id" | "name" | "domain" | "isOwnStore">;
type MatrixProduct = Pick<LeanProduct, "_id" | "name" | "brand" | "size" | "currency" | "isDemo" | "latestAnalysis">;

export interface PriceMatrixInput {
  /** Rows appear in this order. */
  products: MatrixProduct[];
  sources: MatrixSource[];
  retailers: MatrixRetailer[];
  /** Latest observation per source id. */
  latest: Map<string, MatrixObservation>;
}

function cellState(source: MatrixSource, obs: MatrixObservation | undefined): PriceMatrixCellState {
  const failed = source.scrapingStatus === "failed";
  if (obs && !failed) return obs.availability === "out_of_stock" ? "out_of_stock" : "current";
  if (obs) return "stale";
  return failed ? "failed" : "pending";
}

/** Arranges the latest price of every product at every store into a products × stores grid. */
export function buildPriceMatrix({ products, sources, retailers, latest }: PriceMatrixInput): Pick<PriceMatrixDTO, "columns" | "rows"> {
  const retailerById = new Map(retailers.map((r) => [String(r._id), r]));
  const sourcesByProduct = new Map<string, MatrixSource[]>();
  for (const s of sources) {
    if (!retailerById.has(String(s.retailerId))) continue;
    const key = String(s.productId);
    sourcesByProduct.set(key, [...(sourcesByProduct.get(key) ?? []), s]);
  }

  const columnStats = new Map<string, { isOwnStore: boolean; products: number; sortOrderSum: number }>();
  const rows = products.map((product): PriceMatrixRowDTO => {
    const ownPrice = product.latestAnalysis?.ownPrice ?? null;
    const currency = product.latestAnalysis?.currency ?? product.currency ?? null;
    const productSources = [...(sourcesByProduct.get(String(product._id)) ?? [])].sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
    );

    const cells: Record<string, PriceMatrixCellDTO> = {};
    for (const source of productSources) {
      const retailerId = String(source.retailerId);
      if (cells[retailerId]) continue;
      const obs = latest.get(String(source._id));
      const state = cellState(source, obs);
      const price = obs && isValidPrice(obs.price) ? obs.price : null;
      cells[retailerId] = {
        sourceId: String(source._id),
        url: source.url,
        state,
        price,
        currency: obs?.currency ?? currency,
        differencePercentage:
          !source.isOwnStore && price !== null && isValidPrice(ownPrice)
            ? competitorDifferencePercentage(price, ownPrice)
            : null,
        isLowest: false,
        isManual: obs?.origin === "manual",
        observedAt: toIso(obs?.scrapedAt),
        error: state === "failed" || state === "stale" ? (source.lastError ?? "Last price check failed") : null,
      };
      const stats = columnStats.get(retailerId) ?? { isOwnStore: false, products: 0, sortOrderSum: 0 };
      stats.isOwnStore ||= Boolean(source.isOwnStore);
      stats.products += 1;
      stats.sortOrderSum += source.sortOrder ?? 0;
      columnStats.set(retailerId, stats);
    }

    const priced = Object.values(cells).filter((c) => c.state === "current" && c.price !== null);
    if (priced.length >= 2) {
      const lowest = Math.min(...priced.map((c) => c.price!));
      for (const c of priced) c.isLowest = c.price === lowest;
    }

    return {
      productId: String(product._id),
      name: product.name,
      brand: product.brand ?? null,
      size: product.size ?? null,
      currency,
      isDemo: Boolean(product.isDemo),
      analysis: toAnalysisDTO(product.latestAnalysis),
      cells,
    };
  });

  const columns: PriceMatrixColumnDTO[] = [...columnStats.entries()]
    .map(([retailerId, stats]) => {
      const r = retailerById.get(retailerId)!;
      return {
        column: {
          retailerId,
          name: r.name,
          domain: r.domain,
          isOwnStore: stats.isOwnStore || Boolean(r.isOwnStore),
          productCount: stats.products,
        },
        averageSortOrder: stats.sortOrderSum / stats.products,
      };
    })
    .sort(
      (a, b) =>
        Number(b.column.isOwnStore) - Number(a.column.isOwnStore) ||
        a.averageSortOrder - b.averageSortOrder ||
        a.column.name.localeCompare(b.column.name),
    )
    .map((c) => c.column);

  return { columns, rows };
}

export async function getPriceMatrix(workspaceId: string, query: PriceMatrixQuery): Promise<PriceMatrixDTO> {
  await connectToDatabase();

  const filter: Record<string, unknown> = { workspaceId };
  if (!query.demo) filter.isDemo = { $ne: true };
  if (query.q) {
    const rx = new RegExp(escapeRegex(query.q), "i");
    filter.$or = [{ name: rx }, { brand: rx }];
  }
  if (query.position) filter["latestAnalysis.position"] = query.position;

  const [matched, demoProductCount] = await Promise.all([
    Product.find(filter)
      .collation({ locale: "en", strength: 2 })
      .sort({ name: 1, _id: 1 })
      .limit(PRICE_MATRIX_MAX_PRODUCTS + 1)
      .lean<LeanProduct[]>(),
    Product.countDocuments({ workspaceId, isDemo: true }),
  ]);
  const truncated = matched.length > PRICE_MATRIX_MAX_PRODUCTS;
  const products = matched.slice(0, PRICE_MATRIX_MAX_PRODUCTS);

  const sources = await ProductSource.find({ workspaceId, productId: { $in: products.map((p) => p._id) } }).lean<
    ProductSourceDoc[]
  >();
  const retailerIds = [...new Set(sources.map((s) => String(s.retailerId)))].map((id) => new Types.ObjectId(id));
  const [retailers, latest] = await Promise.all([
    Retailer.find({ workspaceId, _id: { $in: retailerIds } }).lean<RetailerDoc[]>(),
    getLatestObservationsBySource(sources.map((s) => s._id)),
  ]);

  return { ...buildPriceMatrix({ products, sources, retailers, latest }), demoProductCount, truncated };
}

/** Cells that start like a formula are prefixed so spreadsheet apps treat them as text. */
function csvText(value: string | null | undefined): string {
  if (!value) return "";
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function csvNumber(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value) ? "" : String(value);
}

function csvCell(cell: PriceMatrixCellDTO | undefined): string {
  if (!cell) return "";
  if (cell.state === "out_of_stock") return "Out of stock";
  return cell.state === "current" || cell.state === "stale" ? csvNumber(cell.price) : "";
}

/** One row per product, one column per store, in the same layout as the matrix page. */
export function priceMatrixToCsv({ columns, rows }: Pick<PriceMatrixDTO, "columns" | "rows">): string {
  const header = [
    "Product",
    "Brand",
    "Size",
    "Currency",
    ...columns.map((c) => (c.isOwnStore ? `${c.name} (your price)` : c.name)),
    "Market median",
    "Gap vs median (%)",
    "Position",
    "Suggested price",
  ].map(csvText);

  const lines = rows.map((row) => {
    const a = row.analysis;
    return [
      csvText(row.name),
      csvText(row.brand),
      csvText(row.size),
      csvText(row.currency),
      ...columns.map((c) => csvCell(row.cells[c.retailerId])),
      csvNumber(a?.marketMedian),
      csvNumber(a?.gapPercentage),
      csvText(a?.position ? PRICE_POSITION_LABELS[a.position] : null),
      csvNumber(a?.suggestedPrice),
    ].join(",");
  });

  return `\uFEFF${[header.join(","), ...lines].join("\r\n")}\r\n`;
}
