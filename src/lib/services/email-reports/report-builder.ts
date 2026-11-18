import { connectToDatabase } from "@/lib/db/mongoose";
import { ALERT_GAP_THRESHOLD } from "@/lib/services/alerts/alert-rules";
import { listAlerts } from "@/lib/services/alerts/alert.service";
import { ensureBrands, getBrandDetail } from "@/lib/services/brands/brand.service";
import { getContentOverview } from "@/lib/services/content/content-overview.service";
import { getDashboardStats } from "@/lib/services/dashboard/dashboard.service";
import { getMarketOpportunities } from "@/lib/services/opportunities/market-opportunities";
import { getCampaignsOverview } from "@/lib/services/reviews/campaign.service";
import { CONTENT_SCORE_THRESHOLDS } from "@/lib/validation/content.schema";
import { EmailReportLog, Product, type ProductDoc } from "@/models";
import type { AlertType, EmailReportAudience, EmailReportPeriodDays, PricePosition } from "@/types";
import type {
  ExecutiveReportDTO,
  ReportAlertItemDTO,
  ReportBrandComplianceDTO,
  ReportCampaignInsightDTO,
  ReportContentGapDTO,
  ReportDecisionItemDTO,
  ReportOpportunityItemDTO,
  ReportStoreBriefDTO,
  ReportStoreComplianceDTO,
  ReportUnopenedDoorDTO,
} from "@/types/dto";
import {
  createLinkBuilder,
  normalizeAppUrl,
  reportPaths,
  resolveLink,
  type LinkBuilder,
} from "./report-links";
import { deriveReportInsights, type KpiSnapshot, type ReportBody } from "./report-insights";
import { audienceHas } from "./report-sections";

const DECISION_LIMIT = 12;
const ALERT_LIMIT = 10;
const OPPORTUNITY_LIMIT = 8;
const STORE_BRIEF_LIMIT = 6;
const STORE_COMPLIANCE_LIMIT = 8;
const UNOPENED_DOOR_LIMIT = 6;
const CONTENT_GAP_LIMIT = 5;
const INSIGHT_LIMIT = 6;

export interface BuildExecutiveReportOptions {
  audience: EmailReportAudience;
  periodDays: EmailReportPeriodDays;
  note?: string | null;
  appUrl?: string | null;
}

function changePercentageFromPayload(payload: Record<string, unknown>): number | null {
  const value = payload.changePercentage;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Rank price-change alerts by absolute percentage move, largest first. */
export function rankPriceChangeAlerts(items: ReportAlertItemDTO[]): ReportAlertItemDTO[] {
  return [...items].sort((a, b) => {
    const aPct = Math.abs(a.changePercentage ?? 0);
    const bPct = Math.abs(b.changePercentage ?? 0);
    return bPct - aPct || b.createdAt.localeCompare(a.createdAt);
  });
}

export interface DecisionCandidate {
  id: string;
  name: string;
  brand: string | null;
  currency: string | null;
  ownPrice: number | null;
  marketMedian: number | null;
  gapPercentage: number | null;
  suggestedPrice: number | null;
  position: PricePosition | null;
}

/** Keeps products beyond the gap threshold, largest gap first, and reports how many there were in total. */
export function selectDecisionsNeeded(
  products: DecisionCandidate[],
  options: { threshold?: number; limit?: number; hrefFor?: (productId: string) => string | null } = {},
): { items: ReportDecisionItemDTO[]; total: number } {
  const { threshold = ALERT_GAP_THRESHOLD, limit = DECISION_LIMIT, hrefFor } = options;
  const beyond = products
    .filter((p) => p.gapPercentage !== null && Math.abs(p.gapPercentage) > threshold)
    .sort((a, b) => Math.abs(b.gapPercentage!) - Math.abs(a.gapPercentage!) || a.name.localeCompare(b.name));

  const items = beyond.slice(0, limit).map<ReportDecisionItemDTO>((p) => ({
    productId: p.id,
    productName: p.name,
    brand: p.brand,
    ownPrice: p.ownPrice,
    marketMedian: p.marketMedian,
    gapPercentage: p.gapPercentage,
    suggestedPrice: p.suggestedPrice,
    currency: p.currency,
    position: p.position,
    direction: p.gapPercentage! > 0 ? "lower" : "raise",
    priceChange: p.suggestedPrice !== null && p.ownPrice !== null ? p.suggestedPrice - p.ownPrice : null,
    href: hrefFor ? hrefFor(p.id) : null,
  }));
  return { items, total: beyond.length };
}

async function loadDecisionCandidates(workspaceId: string): Promise<DecisionCandidate[]> {
  await connectToDatabase();
  const docs = await Product.find({
    workspaceId,
    isDemo: { $ne: true },
    "latestAnalysis.status": "OK",
    "latestAnalysis.gapPercentage": { $ne: null },
  })
    .select({ name: 1, brand: 1, currency: 1, latestAnalysis: 1 })
    .lean<Pick<ProductDoc, "_id" | "name" | "brand" | "currency" | "latestAnalysis">[]>();

  return docs.map((doc) => ({
    id: String(doc._id),
    name: doc.name,
    brand: doc.brand ?? null,
    currency: doc.currency ?? doc.latestAnalysis?.currency ?? null,
    ownPrice: doc.latestAnalysis?.ownPrice ?? null,
    marketMedian: doc.latestAnalysis?.marketMedian ?? null,
    gapPercentage: doc.latestAnalysis?.gapPercentage ?? null,
    suggestedPrice: doc.latestAnalysis?.suggestedPrice ?? null,
    position: (doc.latestAnalysis?.position as PricePosition | null) ?? null,
  }));
}

async function loadAlertsOfType(
  workspaceId: string,
  type: AlertType,
  periodDays: EmailReportPeriodDays,
  hrefFor: (productId: string) => string | null,
): Promise<ReportAlertItemDTO[]> {
  const since = Date.now() - periodDays * 24 * 60 * 60 * 1000;
  const page = await listAlerts(workspaceId, { status: "all", type, page: 1, pageSize: 100 });
  return page.items
    .filter((alert) => new Date(alert.createdAt).getTime() >= since)
    .map((alert) => ({
      id: alert.id,
      type: alert.type,
      title: alert.title,
      message: alert.message,
      productId: alert.productId,
      productName: alert.productName,
      retailerName: alert.retailerName,
      changePercentage: changePercentageFromPayload(alert.payload),
      createdAt: alert.createdAt,
      href: hrefFor(alert.productId),
    }));
}

async function loadBrandData(
  workspaceId: string,
  link: LinkBuilder,
): Promise<{ brandCompliance: ReportBrandComplianceDTO[]; storeCompliance: ReportStoreComplianceDTO[] }> {
  const brands = await ensureBrands(workspaceId);
  const details = await Promise.all(brands.map((brand) => getBrandDetail(workspaceId, brand.slug)));

  const brandCompliance: ReportBrandComplianceDTO[] = [];
  const storeRows: ReportStoreComplianceDTO[] = [];
  for (const detail of details) {
    const partners = detail.storeCompliance.filter((row) => !row.isBrandStore);
    const href = resolveLink(link, reportPaths.brand(detail.slug));
    brandCompliance.push({
      brandName: detail.name,
      brandSlug: detail.slug,
      belowOfficial: partners.reduce((sum, row) => sum + row.belowOfficial, 0),
      aboveOfficial: partners.reduce((sum, row) => sum + row.aboveOfficial, 0),
      outOfStock: partners.reduce((sum, row) => sum + row.outOfStock, 0),
      productCount: detail.productCount,
      storeCount: partners.length,
      href,
    });
    for (const row of partners) {
      if (row.belowOfficial === 0) continue;
      storeRows.push({
        brandName: detail.name,
        brandSlug: detail.slug,
        storeName: row.name,
        domain: row.domain,
        listings: row.listings,
        belowOfficial: row.belowOfficial,
        outOfStock: row.outOfStock,
        averageGapPercentage: row.averageGapPercentage,
        href,
      });
    }
  }

  storeRows.sort((a, b) => b.belowOfficial - a.belowOfficial || a.storeName.localeCompare(b.storeName));
  return { brandCompliance, storeCompliance: storeRows.slice(0, STORE_COMPLIANCE_LIMIT) };
}

type OpportunitySlice = Pick<
  ExecutiveReportDTO,
  "opportunitySummary" | "storeBriefs" | "restocks" | "newListings" | "unopenedDoors"
>;

async function loadOpportunityData(workspaceId: string, link: LinkBuilder): Promise<OpportunitySlice> {
  const data = await getMarketOpportunities(workspaceId, { brand: "all" });

  const storeBriefs = data.stores
    .filter((store) => store.outOfStock > 0 || store.pitchCount > 0)
    .sort(
      (a, b) =>
        b.outOfStock + b.pitchCount - (a.outOfStock + a.pitchCount) || a.name.localeCompare(b.name),
    )
    .slice(0, STORE_BRIEF_LIMIT)
    .map<ReportStoreBriefDTO>((store) => ({
      name: store.name,
      domain: store.domain,
      brand: store.brand,
      catalogSize: store.catalogSize,
      restockCount: store.outOfStock,
      pitchCount: store.pitchCount,
      coveragePercentage: store.coveragePercentage,
      talkingPoints: [...store.restocks, ...store.pitches].map((item) => item.productName).slice(0, 4),
      href: resolveLink(link, reportPaths.opportunities("stores", store.brand)),
    }));

  const toOpportunity = (
    item: (typeof data.restocks)[number],
    view: "restock" | "listings",
  ): ReportOpportunityItemDTO => ({
    productName: item.productName,
    brand: item.brand,
    retailerName: item.retailerName,
    action: item.action,
    tone: item.tone,
    href: resolveLink(link, reportPaths.opportunities(view, item.brand)),
  });

  return {
    opportunitySummary: {
      restockCount: data.summary.restockCount,
      newListingCount: data.summary.newListingCount,
      storesWithGaps: data.summary.storesWithGaps,
      unopenedProductCount: data.summary.unopenedProductCount,
      unopenedDoorCount: data.summary.unopenedDoorCount,
    },
    storeBriefs,
    restocks: data.restocks
      .filter((item) => item.tone === "ready")
      .slice(0, OPPORTUNITY_LIMIT)
      .map((item) => toOpportunity(item, "restock")),
    newListings: data.newListings.slice(0, OPPORTUNITY_LIMIT).map((item) => toOpportunity(item, "listings")),
    unopenedDoors: data.unopenedDoors.slice(0, UNOPENED_DOOR_LIMIT).map<ReportUnopenedDoorDTO>((door) => ({
      name: door.name,
      domain: door.domain,
      brand: door.brand,
      otherBrandListings: door.otherBrandListings,
      href: resolveLink(link, reportPaths.opportunities("stores", door.brand)),
    })),
  };
}

async function loadContentData(
  workspaceId: string,
  link: LinkBuilder,
): Promise<Pick<ExecutiveReportDTO, "contentHealth" | "contentGaps">> {
  const overview = await getContentOverview(workspaceId, { sort: "score", order: "asc", page: 1, pageSize: 100 });
  const contentGaps = overview.items
    .filter((row) => row.ownPageCaptured && row.score !== null && row.score < CONTENT_SCORE_THRESHOLDS.good)
    .slice(0, CONTENT_GAP_LIMIT)
    .map<ReportContentGapDTO>((row) => ({
      productId: row.productId,
      productName: row.name,
      score: row.score,
      issueLabels: row.issueLabels,
      topMissingKeywords: row.topMissingKeywords,
      missingFacts: row.missingFacts,
      href: resolveLink(link, reportPaths.productContent(row.productId)),
    }));

  return {
    contentHealth: {
      productsAnalyzed: overview.summary.productsAnalyzed,
      averageScore: overview.summary.averageScore,
      needsWork: overview.summary.needsWork,
      notCaptured: overview.summary.notCaptured,
      competitorChanges30d: overview.summary.competitorChanges30d,
      href: resolveLink(link, reportPaths.content("needs_work")),
    },
    contentGaps,
  };
}

async function loadCampaignData(
  workspaceId: string,
  link: LinkBuilder,
): Promise<Pick<ExecutiveReportDTO, "campaignSummary" | "campaignInsights">> {
  const overview = await getCampaignsOverview(workspaceId, { brand: "all" });
  return {
    campaignSummary: {
      competitorWeaknesses: overview.summary.competitorWeaknesses,
      ourWeaknesses: overview.summary.ourWeaknesses,
      strengths: overview.summary.strengths,
    },
    campaignInsights: overview.insights.slice(0, INSIGHT_LIMIT).map<ReportCampaignInsightDTO>((insight) => ({
      title: insight.title,
      type: insight.type,
      suggestedAction: insight.suggestedAction,
      evidence: insight.evidence,
      href: resolveLink(link, reportPaths.campaigns(insight.type)),
    })),
  };
}

/** KPI snapshot saved with the last report that reached at least one recipient of this audience. */
export async function loadPreviousReport(
  workspaceId: string,
  audience: EmailReportAudience,
): Promise<{ snapshot: KpiSnapshot | null; sentAt: string | null }> {
  await connectToDatabase();
  const last = await EmailReportLog.findOne({
    workspaceId,
    audience,
    "results.status": "sent",
    kpiSnapshot: { $ne: null },
  })
    .sort({ createdAt: -1 })
    .select({ kpiSnapshot: 1, createdAt: 1 })
    .lean<{ kpiSnapshot?: KpiSnapshot | null; createdAt: Date }>();

  return {
    snapshot: last?.kpiSnapshot ?? null,
    sentAt: last ? new Date(last.createdAt).toISOString() : null,
  };
}

/**
 * Builds the report for one audience. Only the data that audience reads is loaded, so a Marketing
 * brief never pays for pricing queries and a CEO brief never scans content pages.
 */
export async function buildExecutiveReport(
  workspaceId: string,
  options: BuildExecutiveReportOptions,
): Promise<ExecutiveReportDTO> {
  const { audience, periodDays } = options;
  const note = options.note?.trim() ? options.note.trim() : null;
  const appUrl = normalizeAppUrl(options.appUrl ?? process.env.NEXT_PUBLIC_APP_URL);
  const link = createLinkBuilder(appUrl);
  const productHref = (productId: string) => resolveLink(link, reportPaths.product(productId));
  const productContentHref = (productId: string) => resolveLink(link, reportPaths.productContent(productId));

  const wants = (section: Parameters<typeof audienceHas>[1]) => audienceHas(audience, section);
  const needsPricing = wants("decisions");
  const needsBrands = wants("brandCompliance") || wants("storeCompliance");
  const needsOpportunities =
    wants("storeBriefs") || wants("restocks") || wants("newListings") || wants("unopenedDoors");
  const needsContent = wants("contentHealth");
  const needsCampaigns = wants("campaignInsights");

  const none = Promise.resolve(null);
  const [stats, decisionCandidates, priceChanges, outOfStock, contentChanges, brandData, opportunityData, contentData, campaignData, previous] =
    await Promise.all([
      needsPricing ? getDashboardStats(workspaceId) : none,
      needsPricing ? loadDecisionCandidates(workspaceId) : Promise.resolve<DecisionCandidate[]>([]),
      wants("priceChanges") ? loadAlertsOfType(workspaceId, "PRICE_CHANGE", periodDays, productHref) : Promise.resolve([]),
      wants("outOfStock") ? loadAlertsOfType(workspaceId, "OUT_OF_STOCK", periodDays, productHref) : Promise.resolve([]),
      wants("contentChanges")
        ? loadAlertsOfType(workspaceId, "CONTENT_CHANGE", periodDays, productContentHref)
        : Promise.resolve([]),
      needsBrands ? loadBrandData(workspaceId, link) : none,
      needsOpportunities ? loadOpportunityData(workspaceId, link) : none,
      needsContent ? loadContentData(workspaceId, link) : none,
      needsCampaigns ? loadCampaignData(workspaceId, link) : none,
      loadPreviousReport(workspaceId, audience),
    ]);

  const decisions = selectDecisionsNeeded(decisionCandidates, { hrefFor: productHref });

  const body: ReportBody = {
    generatedAt: new Date().toISOString(),
    audience,
    periodDays,
    appUrl,
    note,
    previousReportAt: previous.sentAt,
    pricing: stats
      ? {
          totalProducts: stats.totalProducts,
          productsCompared: stats.productsCompared,
          underpriced: stats.underpriced,
          overpriced: stats.overpriced,
          marketAligned: stats.marketAligned,
          newAlerts: stats.newAlerts,
        }
      : null,
    opportunitySummary: opportunityData?.opportunitySummary ?? null,
    campaignSummary: campaignData?.campaignSummary ?? null,
    contentHealth: contentData?.contentHealth ?? null,
    decisionsTotal: decisions.total,
    decisionsNeeded: decisions.items,
    priceChanges: rankPriceChangeAlerts(priceChanges).slice(0, ALERT_LIMIT),
    outOfStock: outOfStock.slice(0, ALERT_LIMIT),
    contentChanges: contentChanges.slice(0, ALERT_LIMIT),
    brandCompliance: brandData?.brandCompliance ?? [],
    storeCompliance: brandData?.storeCompliance ?? [],
    storeBriefs: opportunityData?.storeBriefs ?? [],
    restocks: opportunityData?.restocks ?? [],
    newListings: opportunityData?.newListings ?? [],
    unopenedDoors: opportunityData?.unopenedDoors ?? [],
    contentGaps: contentData?.contentGaps ?? [],
    campaignInsights: campaignData?.campaignInsights ?? [],
  };

  return { ...body, ...deriveReportInsights(body, link, previous.snapshot) };
}
