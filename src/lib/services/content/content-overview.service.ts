import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import type { ContentOverviewQuery, ContentScoreBand, ContentSortField } from "@/lib/validation/content.schema";
import { Product, ProductSource, Retailer, type ProductSourceDoc, type RetailerDoc } from "@/models";
import type { ContentOverviewDTO, ContentOverviewRowDTO, ProductContentAnalysisDTO } from "@/types/dto";
import { escapeRegex, type LeanProduct } from "../products/product.service";
import { buildContentAnalysis, missingFacts } from "./content-analysis";
import { getLatestContentBySource, toContentPageInput } from "./content.service";

export const CONTENT_OVERVIEW_MAX_PRODUCTS = 500;
export const CONTENT_SCORE_THRESHOLDS = { good: 80, fair: 50 } as const;
const RECENT_CHANGE_DAYS = 30;

type OverviewProduct = Pick<LeanProduct, "_id" | "name" | "brand" | "size">;

/** One table row per product, condensed from its full content analysis. */
export function summarizeContentRow(product: OverviewProduct, analysis: ProductContentAnalysisDTO): ContentOverviewRowDTO {
  const issues = [...analysis.checks.filter((c) => c.status === "fail"), ...analysis.checks.filter((c) => c.status === "warn")];
  const lastChange = analysis.pages
    .filter((p) => !p.isOwnStore && p.versionCount > 1 && p.contentSince)
    .sort((a, b) => b.contentSince!.localeCompare(a.contentSince!))[0];

  return {
    productId: String(product._id),
    name: product.name,
    brand: product.brand ?? null,
    size: product.size ?? null,
    score: analysis.score,
    ownPageCaptured: analysis.ownPageCaptured,
    competitorCount: analysis.competitorCount,
    competitorPagesCaptured: analysis.competitorPagesCaptured,
    failedChecks: analysis.checks.filter((c) => c.status === "fail").length,
    warningChecks: analysis.checks.filter((c) => c.status === "warn").length,
    issueLabels: issues.map((c) => c.label),
    missingKeywordCount: analysis.ownPageCaptured ? analysis.keywords.missing.length : 0,
    topMissingKeywords: analysis.ownPageCaptured ? analysis.keywords.missing.slice(0, 3).map((t) => t.term) : [],
    missingFacts: missingFacts(analysis.attributes, analysis.competitorPagesCaptured).map((a) => a.label),
    descriptionWords: analysis.benchmark.own?.descriptionWords ?? null,
    competitorMedianWords: analysis.benchmark.competitorMedian.descriptionWords,
    lastCompetitorChange: lastChange ? { retailerName: lastChange.retailerName, at: lastChange.contentSince! } : null,
  };
}

export function scoreBand(row: Pick<ContentOverviewRowDTO, "ownPageCaptured" | "score">): ContentScoreBand {
  if (!row.ownPageCaptured || row.score === null) return "not_captured";
  if (row.score >= CONTENT_SCORE_THRESHOLDS.good) return "good";
  if (row.score >= CONTENT_SCORE_THRESHOLDS.fair) return "fair";
  return "needs_work";
}

const SORT_VALUE: Record<Exclude<ContentSortField, "name">, (r: ContentOverviewRowDTO) => number | string | null> = {
  score: (r) => r.score,
  issues: (r) => (r.ownPageCaptured ? r.failedChecks * 100 + r.warningChecks : null),
  missingKeywords: (r) => (r.ownPageCaptured ? r.missingKeywordCount : null),
  descriptionWords: (r) => r.descriptionWords,
  lastChange: (r) => r.lastCompetitorChange?.at ?? null,
};

/** Rows without a value (page not captured) always sort last; ties fall back to name. */
export function sortContentRows(rows: ContentOverviewRowDTO[], sort: ContentSortField, order: "asc" | "desc"): ContentOverviewRowDTO[] {
  const dir = order === "asc" ? 1 : -1;
  const byName = (a: ContentOverviewRowDTO, b: ContentOverviewRowDTO) => a.name.localeCompare(b.name, "en", { sensitivity: "base" });
  if (sort === "name") return [...rows].sort((a, b) => dir * byName(a, b));
  const value = SORT_VALUE[sort];
  return [...rows].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    if (va === null || vb === null) return va === vb ? byName(a, b) : va === null ? 1 : -1;
    const cmp = typeof va === "string" ? va.localeCompare(vb as string) : va - (vb as number);
    return cmp !== 0 ? dir * cmp : byName(a, b);
  });
}

/** Filters by score band, sorts and paginates; the summary covers every row before the band filter. */
export function buildContentOverview(
  rows: ContentOverviewRowDTO[],
  query: Pick<ContentOverviewQuery, "band" | "sort" | "order" | "page" | "pageSize">,
  { truncated = false, now = new Date() }: { truncated?: boolean; now?: Date } = {},
): ContentOverviewDTO {
  const scored = rows.filter((r) => r.score !== null).map((r) => r.score!);
  const since = now.getTime() - RECENT_CHANGE_DAYS * 24 * 60 * 60 * 1000;

  const filtered = query.band ? rows.filter((r) => scoreBand(r) === query.band) : rows;
  const sorted = sortContentRows(filtered, query.sort, query.order);
  const start = (query.page - 1) * query.pageSize;

  return {
    items: sorted.slice(start, start + query.pageSize),
    total: sorted.length,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(sorted.length / query.pageSize)),
    summary: {
      productsAnalyzed: rows.length,
      averageScore: scored.length ? Math.round(scored.reduce((s, v) => s + v, 0) / scored.length) : null,
      needsWork: rows.filter((r) => scoreBand(r) === "needs_work").length,
      notCaptured: rows.filter((r) => scoreBand(r) === "not_captured").length,
      competitorChanges30d: rows.filter((r) => r.lastCompetitorChange && new Date(r.lastCompetitorChange.at).getTime() >= since).length,
    },
    productIds: sorted.map((r) => r.productId),
    truncated,
  };
}

export async function getContentOverview(workspaceId: string, query: ContentOverviewQuery): Promise<ContentOverviewDTO> {
  await connectToDatabase();

  const filter: Record<string, unknown> = { workspaceId, isDemo: { $ne: true } };
  if (query.q) {
    const rx = new RegExp(escapeRegex(query.q), "i");
    filter.$or = [{ name: rx }, { brand: rx }];
  }
  const matched = await Product.find(filter, { name: 1, brand: 1, size: 1 })
    .sort({ lastCheckedAt: -1, _id: 1 })
    .limit(CONTENT_OVERVIEW_MAX_PRODUCTS + 1)
    .lean<OverviewProduct[]>();
  const truncated = matched.length > CONTENT_OVERVIEW_MAX_PRODUCTS;
  const products = matched.slice(0, CONTENT_OVERVIEW_MAX_PRODUCTS);

  const sources = await ProductSource.find({ workspaceId, productId: { $in: products.map((p) => p._id) } })
    .sort({ sortOrder: 1 })
    .lean<ProductSourceDoc[]>();
  const retailerIds = [...new Set(sources.map((s) => String(s.retailerId)))].map((id) => new Types.ObjectId(id));
  const [retailers, latest] = await Promise.all([
    Retailer.find({ workspaceId, _id: { $in: retailerIds } }, { name: 1 }).lean<Pick<RetailerDoc, "_id" | "name">[]>(),
    getLatestContentBySource(sources.map((s) => s._id)),
  ]);
  const retailerById = new Map(retailers.map((r) => [String(r._id), r]));

  const sourcesByProduct = new Map<string, ProductSourceDoc[]>();
  for (const s of sources) {
    if (!retailerById.has(String(s.retailerId))) continue;
    const key = String(s.productId);
    sourcesByProduct.set(key, [...(sourcesByProduct.get(key) ?? []), s]);
  }

  const rows = products.map((product) => {
    const pages = (sourcesByProduct.get(String(product._id)) ?? []).map((s) =>
      toContentPageInput(s, retailerById.get(String(s.retailerId))!, latest),
    );
    return summarizeContentRow(product, buildContentAnalysis(pages));
  });

  return buildContentOverview(rows, query, { truncated });
}
