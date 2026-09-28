import { connectToDatabase } from "@/lib/db/mongoose";
import { assertObjectId } from "@/lib/db/object-id";
import { AppError, ConflictError } from "@/lib/errors";
import { Product, ProductSource, type PriceObservationDoc, type ProductSourceDoc, type RetailerDoc } from "@/models";
import type { Availability, HistoryRange, ScrapeErrorCode } from "@/types";
import type { Types } from "mongoose";
import type {
  CompetitorComparisonRowDTO,
  ComparisonRunResultDTO,
  ContentCaptureResultDTO,
  HistorySeriesDTO,
  ProductAnalysisDTO,
} from "@/types/dto";
import { detectAlerts, detectContentAlerts, type ContentChange, type SourceChange } from "../alerts/alert-rules";
import { createAlerts } from "../alerts/alert.service";
import { recordContentSnapshot } from "../content/content.service";
import { toIso } from "../mappers";
import {
  getLatestObservationsBySource,
  getObservationsSince,
  recordObservation,
} from "../prices/price-observation.service";
import { competitorDifferencePercentage } from "../pricing/pricing-analysis.service";
import { buildPricingSummary, EXCLUSION_MESSAGES, type PricingSummary, type SourcePriceInput } from "../pricing/pricing-summary";
import { getProductDoc, getProductSources } from "../products/product.service";
import { scrapeContentMany, scrapeMany } from "../scraping/scraper.service";
import type { PageContent, ScrapedContent, ScrapedProduct } from "../scraping/types";

/** Demo products point at non-existent `.example` stores, so scraping them would only erase their sample data. */
export const DEMO_REFRESH_MESSAGE =
  "Demo products use generated sample data and cannot be refreshed. Add a real product to scrape live prices.";

/** Minimum spacing between full manual refreshes of the same product. */
export const REFRESH_COOLDOWN_SECONDS = 30;

declare global {
  var __runningComparisons: Set<string> | undefined;
}
const running = (globalThis.__runningComparisons ??= new Set<string>());

type SourceWithRetailer = { source: ProductSourceDoc; retailer: RetailerDoc };

function toSourceInputs(
  sources: SourceWithRetailer[],
  latest: Map<string, PriceObservationDoc>,
): SourcePriceInput[] {
  return sources.map(({ source }) => {
    const obs = latest.get(String(source._id));
    const success = source.scrapingStatus === "success" && Boolean(obs);
    return {
      sourceId: String(source._id),
      isOwnStore: Boolean(source.isOwnStore),
      success,
      price: success ? obs!.price : null,
      currency: success ? (obs!.currency ?? null) : null,
      availability: success ? ((obs!.availability ?? "unknown") as Availability) : null,
    };
  });
}

async function loadState(workspaceId: string, productId: string) {
  assertObjectId(productId, "Product");
  const [product, sources] = await Promise.all([
    getProductDoc(workspaceId, productId),
    getProductSources(workspaceId, productId),
  ]);
  const latest = await getLatestObservationsBySource(sources.map((s) => s.source._id));
  const summary = buildPricingSummary(toSourceInputs(sources, latest));
  return { product, sources, latest, summary };
}

type ProductState = Awaited<ReturnType<typeof loadState>>;

/**
 * Rebuilds the product's `latestAnalysis` snapshot from the latest observation of each source,
 * for price writes that bypass `compareProduct` (e.g. spreadsheet imports).
 */
export async function recomputeProductAnalysis(
  workspaceId: string,
  productId: string,
  checkedAt: Date = new Date(),
  options: { updateLastCheckedAt?: boolean } = {},
): Promise<PricingSummary> {
  await connectToDatabase();
  const { product, summary } = await loadState(workspaceId, productId);
  await Product.updateOne(
    { _id: product._id },
    {
      $set: {
        latestAnalysis: { ...summary.snapshot, computedAt: checkedAt },
        ...(options.updateLastCheckedAt === false ? {} : { lastCheckedAt: checkedAt }),
        currency: product.currency ?? summary.selection.currency ?? null,
      },
    },
  );
  return summary;
}

/** Stores the page's content; returns the change when it rewrote an earlier version. */
async function saveContent(
  workspaceId: string,
  productId: Types.ObjectId,
  { source, retailer }: SourceWithRetailer,
  content: PageContent,
  capturedAt: Date,
): Promise<ContentChange | null> {
  const recorded = await recordContentSnapshot({
    workspaceId,
    productId,
    retailerId: retailer._id,
    sourceId: source._id,
    content,
    capturedAt,
  });
  if (recorded.kind !== "changed") return null;
  return {
    sourceId: String(source._id),
    retailerId: String(retailer._id),
    retailerName: retailer.name,
    isOwnStore: Boolean(source.isOwnStore),
    fields: recorded.fields,
  };
}

function acquireLock(workspaceId: string, productId: string): string {
  const lockKey = `${workspaceId}:${productId}`;
  if (running.has(lockKey)) throw new ConflictError("A check for this product is already running.");
  running.add(lockKey);
  return lockKey;
}

/**
 * Reads every source page's copy for the Content & SEO analysis without recording prices, so imported
 * or manual prices stay untouched. Pages without a detectable price still succeed.
 */
export async function captureProductContent(workspaceId: string, productId: string): Promise<ContentCaptureResultDTO> {
  await connectToDatabase();
  const product = await getProductDoc(workspaceId, productId);
  if (product.isDemo) {
    throw new AppError(DEMO_REFRESH_MESSAGE, 400, "DEMO_PRODUCT");
  }

  const lockKey = acquireLock(workspaceId, productId);
  try {
    const sources = await getProductSources(workspaceId, productId);
    const results: ScrapedContent[] = await scrapeContentMany(sources.map((s) => s.source.url));

    const changes: ContentChange[] = [];
    const saved = await Promise.all(
      sources.map(async (target, i) => {
        const result = results[i];
        if (!result.success) return { ok: false, error: result.error };
        try {
          const change = await saveContent(workspaceId, product._id, target, result.content, new Date(result.scrapedAt));
          if (change) changes.push(change);
          return { ok: true, error: null };
        } catch (error) {
          console.error(`[content] could not save page content for ${target.source.url}:`, error);
          return { ok: false, error: "The page was read but its content could not be saved." };
        }
      }),
    );

    const alertsCreated = await createAlerts(workspaceId, productId, detectContentAlerts(product.name, changes));
    const captured = saved.filter((s) => s.ok).length;
    return {
      productId,
      scraped: sources.length,
      captured,
      failed: sources.length - captured,
      changed: changes.length,
      alertsCreated,
      results: sources.map(({ source, retailer }, i) => ({
        sourceId: String(source._id),
        retailerName: retailer.name,
        isOwnStore: Boolean(source.isOwnStore),
        success: saved[i].ok,
        error: saved[i].error,
      })),
    };
  } finally {
    running.delete(lockKey);
  }
}

export interface CompareOptions {
  /** Restrict scraping to these sources (used by per-row Retry). Defaults to all sources. */
  sourceIds?: string[];
  /** Enforce the refresh cooldown (manual refresh button). */
  enforceCooldown?: boolean;
}

/**
 * Scrapes the product's own and competitor URLs, stores an append-only PriceObservation and a
 * content snapshot for every successful scrape, recomputes the analysis snapshot and raises alerts.
 * Individual failures are recorded on their source and never abort the run.
 */
export async function compareProduct(
  workspaceId: string,
  productId: string,
  { sourceIds, enforceCooldown = false }: CompareOptions = {},
): Promise<ComparisonRunResultDTO> {
  await connectToDatabase();
  const product = await getProductDoc(workspaceId, productId);
  if (product.isDemo) {
    throw new AppError(DEMO_REFRESH_MESSAGE, 400, "DEMO_PRODUCT");
  }

  const partial = Boolean(sourceIds?.length);
  if (enforceCooldown && !partial && product.lastCheckedAt) {
    const elapsed = (Date.now() - new Date(product.lastCheckedAt).getTime()) / 1000;
    if (elapsed < REFRESH_COOLDOWN_SECONDS) {
      throw new ConflictError(
        `Prices were checked ${Math.floor(elapsed)}s ago. Please wait ${Math.ceil(REFRESH_COOLDOWN_SECONDS - elapsed)}s before refreshing again.`,
      );
    }
  }

  const lockKey = acquireLock(workspaceId, productId);

  try {
    const sources = await getProductSources(workspaceId, productId);
    const targets = partial ? sources.filter((s) => sourceIds!.includes(String(s.source._id))) : sources;
    const previousLatest = await getLatestObservationsBySource(sources.map((s) => s.source._id));
    const previousGap = product.latestAnalysis?.gapPercentage ?? null;

    const results: ScrapedProduct[] = await scrapeMany(targets.map((t) => t.source.url));
    const ownScrape = results.find((r, i) => r.success && targets[i].source.isOwnStore);
    const referenceCurrency = product.currency ?? (ownScrape?.success ? ownScrape.currency : null);

    const changes: SourceChange[] = [];
    const contentChanges: ContentChange[] = [];
    await Promise.all(
      targets.map(async ({ source, retailer }, i) => {
        const result = results[i];
        const scrapedAt = new Date(result.scrapedAt);
        if (result.success) {
          await recordObservation({
            workspaceId,
            productId: product._id,
            retailerId: retailer._id,
            sourceId: source._id,
            price: result.price,
            originalPrice: result.originalPrice,
            currency: result.currency,
            availability: result.availability,
            scrapedAt,
          });
          await ProductSource.updateOne(
            { _id: source._id },
            { $set: { scrapingStatus: "success", lastScrapedAt: scrapedAt, lastError: null, lastErrorCode: null } },
          );
          if (result.content) {
            try {
              const change = await saveContent(workspaceId, product._id, { source, retailer }, result.content, scrapedAt);
              if (change) contentChanges.push(change);
            } catch (error) {
              console.error(`[compare] could not save page content for ${source.url}:`, error);
            }
          }
          const prev = previousLatest.get(String(source._id));
          changes.push({
            sourceId: String(source._id),
            retailerId: String(retailer._id),
            retailerName: retailer.name,
            isOwnStore: Boolean(source.isOwnStore),
            previous: prev
              ? { price: prev.price, availability: (prev.availability ?? "unknown") as Availability, currency: prev.currency ?? null }
              : null,
            current: { price: result.price, availability: result.availability, currency: result.currency },
          });
        } else {
          await ProductSource.updateOne(
            { _id: source._id },
            { $set: { scrapingStatus: "failed", lastScrapedAt: scrapedAt, lastError: result.error, lastErrorCode: result.errorCode } },
          );
        }
      }),
    );

    const state = await loadState(workspaceId, productId);
    const anyResult = results.find((r) => r.success);
    const enrich = ownScrape?.success ? ownScrape : anyResult?.success ? anyResult : null;

    await Product.updateOne(
      { _id: product._id },
      {
        $set: {
          latestAnalysis: state.summary.snapshot,
          lastCheckedAt: new Date(),
          currency: state.summary.selection.currency ?? referenceCurrency ?? product.currency ?? null,
          ...(!product.brand && enrich?.brand ? { brand: enrich.brand } : {}),
          ...(!product.imageUrl && enrich?.imageUrl ? { imageUrl: enrich.imageUrl } : {}),
        },
      },
    );

    const drafts = detectAlerts({
      productName: product.name,
      changes,
      previousGap,
      currentGap: state.summary.snapshot.gapPercentage,
      marketMedian: state.summary.snapshot.marketMedian,
      currency: state.summary.selection.currency,
    });
    drafts.push(...detectContentAlerts(product.name, contentChanges));
    const alertsCreated = await createAlerts(workspaceId, productId, drafts);

    const succeeded = results.filter((r) => r.success).length;
    return {
      productId,
      scraped: results.length,
      succeeded,
      failed: results.length - succeeded,
      alertsCreated,
      results: targets.map(({ source, retailer }, i) => {
        const r = results[i];
        return {
          sourceId: String(source._id),
          retailerName: retailer.name,
          isOwnStore: Boolean(source.isOwnStore),
          success: r.success,
          price: r.success ? r.price : null,
          currency: r.success ? r.currency : null,
          error: r.success ? null : r.error,
          errorCode: r.success ? null : r.errorCode,
        };
      }),
    };
  } finally {
    running.delete(lockKey);
  }
}

function toAnalysisDTO(summary: PricingSummary): ProductAnalysisDTO {
  const { analysis, recommendation, selection } = summary;
  return {
    status: analysis.status,
    reason: analysis.reason,
    currency: selection.currency,
    ownPrice: analysis.ownPrice,
    marketMinimum: analysis.marketMinimum,
    marketMaximum: analysis.marketMaximum,
    marketAverage: analysis.marketAverage,
    marketMedian: analysis.marketMedian,
    ownPriceVsAverage: analysis.ownPriceVsAverage,
    ownPriceVsMedian: analysis.ownPriceVsMedian,
    ownPriceVsMinimum: analysis.ownPriceVsMinimum,
    ownPriceVsMaximum: analysis.ownPriceVsMaximum,
    gapPercentage: analysis.gapPercentage,
    position: analysis.position,
    cheaperCompetitors: analysis.cheaperCompetitors.length,
    moreExpensiveCompetitors: analysis.moreExpensiveCompetitors.length,
    equalCompetitors: analysis.equalCompetitors.length,
    competitorCount: summary.snapshot.competitorCount,
    includedCompetitorCount: selection.included.length,
    suggestedPrice: recommendation?.suggestedPrice ?? null,
    suggestion: recommendation
      ? {
          basis: recommendation.basis,
          multiplier: recommendation.multiplier,
          changeAmount: recommendation.changeAmount,
          changePercentage: recommendation.changePercentage,
          explanation: recommendation.explanation,
          disclaimer: recommendation.disclaimer,
        }
      : null,
  };
}

export async function getProductAnalysis(workspaceId: string, productId: string): Promise<ProductAnalysisDTO> {
  await connectToDatabase();
  const { summary } = await loadState(workspaceId, productId);
  return toAnalysisDTO(summary);
}

export async function getComparisonRows(workspaceId: string, productId: string): Promise<CompetitorComparisonRowDTO[]> {
  await connectToDatabase();
  return buildComparisonRows(await loadState(workspaceId, productId));
}

function buildComparisonRows({ sources, latest, summary }: ProductState): CompetitorComparisonRowDTO[] {
  const ownPrice = summary.analysis.ownPrice;
  const exclusions = new Map(summary.selection.excluded.map((e) => [e.source.sourceId, e.reason]));

  return sources.map(({ source, retailer }) => {
    const id = String(source._id);
    const obs = latest.get(id);
    const ok = source.scrapingStatus === "success" && obs;
    const price = ok ? obs.price : null;
    const exclusion = exclusions.get(id);
    const currency = ok ? (obs.currency ?? null) : null;
    return {
      sourceId: id,
      retailerName: retailer.name,
      url: source.url,
      isOwnStore: Boolean(source.isOwnStore),
      price,
      currency: currency ?? summary.selection.currency,
      differencePercentage:
        !source.isOwnStore && price !== null && ownPrice !== null ? competitorDifferencePercentage(price, ownPrice) : null,
      availability: ok ? ((obs.availability ?? "unknown") as Availability) : null,
      lastCheckedAt: toIso(source.lastScrapedAt),
      scrapingStatus: (source.scrapingStatus ?? "pending") as CompetitorComparisonRowDTO["scrapingStatus"],
      error: source.scrapingStatus === "failed" ? (source.lastError ?? "Scrape failed") : null,
      errorCode: (source.lastErrorCode ?? null) as ScrapeErrorCode | null,
      exclusion: exclusion && exclusion !== "FAILED" ? EXCLUSION_MESSAGES[exclusion] : null,
      note:
        ok && !obs.currency && summary.selection.currency
          ? `Currency not detected; assumed ${summary.selection.currency}.`
          : null,
    };
  });
}

export async function getPriceHistory(
  workspaceId: string,
  productId: string,
  range: HistoryRange,
): Promise<HistorySeriesDTO[]> {
  await connectToDatabase();
  assertObjectId(productId, "Product");
  const [, sources, observations] = await Promise.all([
    getProductDoc(workspaceId, productId),
    getProductSources(workspaceId, productId),
    getObservationsSince(productId, range),
  ]);
  return buildHistorySeries(sources, observations);
}

/** Everything the product detail page needs, loaded with one pass over the product's data. */
export async function getProductOverview(workspaceId: string, productId: string, range: HistoryRange = "30d") {
  await connectToDatabase();
  assertObjectId(productId, "Product");
  const [state, observations] = await Promise.all([
    loadState(workspaceId, productId),
    getObservationsSince(productId, range),
  ]);
  return {
    product: state.product,
    analysis: toAnalysisDTO(state.summary),
    rows: buildComparisonRows(state),
    history: buildHistorySeries(state.sources, observations),
  };
}

function buildHistorySeries(
  sources: SourceWithRetailer[],
  observations: Pick<PriceObservationDoc, "sourceId" | "scrapedAt" | "price">[],
): HistorySeriesDTO[] {
  const series = new Map<string, HistorySeriesDTO>(
    sources.map(({ source, retailer }) => [
      String(source._id),
      { sourceId: String(source._id), retailerName: retailer.name, isOwnStore: Boolean(source.isOwnStore), points: [] },
    ]),
  );
  for (const obs of observations) {
    series.get(String(obs.sourceId))?.points.push({ scrapedAt: toIso(obs.scrapedAt)!, price: obs.price });
  }
  return [...series.values()];
}
