import type { EmailReportAudience } from "@/types";
import type {
  ExecutiveReportDTO,
  ReportActionDTO,
  ReportHeadlineDTO,
  ReportKpiDTO,
  ReportPriority,
} from "@/types/dto";
import { formatMoney } from "@/utils/format";
import { resolveLink, reportPaths, type LinkBuilder } from "./report-links";

/** The report before the role-specific headline, actions and KPIs are derived from it. */
export type ReportBody = Omit<ExecutiveReportDTO, "headline" | "actions" | "kpis">;

export type KpiSnapshot = Record<string, number>;

const MAX_ACTIONS = 5;
const MAX_ACTIONS_ALL = 6;
const PRIORITY_ORDER: Record<ReportPriority, number> = { high: 0, medium: 1, low: 2 };

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;
const absPct = (value: number | null) => (value === null ? "?" : Math.abs(value).toFixed(0));

function sortByPriority(actions: ReportActionDTO[]): ReportActionDTO[] {
  return actions
    .map((action, index) => ({ action, index }))
    .sort((a, b) => PRIORITY_ORDER[a.action.priority] - PRIORITY_ORDER[b.action.priority] || a.index - b.index)
    .map((entry) => entry.action);
}

function totalBelowOfficial(body: ReportBody): number {
  return body.brandCompliance.reduce((sum, brand) => sum + brand.belowOfficial, 0);
}

function ceoActions(body: ReportBody, link: LinkBuilder): ReportActionDTO[] {
  const actions: ReportActionDTO[] = [];
  const lower = body.decisionsNeeded.filter((item) => item.direction === "lower");
  const raise = body.decisionsNeeded.filter((item) => item.direction === "raise");

  lower.slice(0, 2).forEach((item) => {
    const gap = Math.abs(item.gapPercentage ?? 0);
    actions.push({
      id: `lower-${item.productId}`,
      priority: gap >= 25 ? "high" : "medium",
      title:
        item.suggestedPrice !== null
          ? `Lower ${item.productName} to ${formatMoney(item.suggestedPrice, item.currency)}`
          : `Review the price of ${item.productName}`,
      detail: `You are ${absPct(item.gapPercentage)}% above the market median (${formatMoney(item.marketMedian, item.currency)}). Cheaper stores are likely winning these sales.`,
      href: item.href,
      ctaLabel: "Review price",
    });
  });
  if (lower.length > 2) {
    actions.push({
      id: "lower-more",
      priority: "low",
      title: `${plural(lower.length - 2, "more product")} priced well above market`,
      detail: "Sorted by the size of the gap, largest first.",
      href: resolveLink(link, reportPaths.productsByGap()),
      ctaLabel: "See all products",
    });
  }

  const topRaise = raise[0];
  if (topRaise) {
    const extra = topRaise.priceChange !== null ? Math.abs(topRaise.priceChange) : null;
    actions.push({
      id: `raise-${topRaise.productId}`,
      priority: "medium",
      title:
        topRaise.suggestedPrice !== null
          ? `Raise ${topRaise.productName} to ${formatMoney(topRaise.suggestedPrice, topRaise.currency)}`
          : `Review the price of ${topRaise.productName}`,
      detail: `Priced ${absPct(topRaise.gapPercentage)}% below the market median${
        extra !== null ? `, which leaves about ${formatMoney(extra, topRaise.currency)} of margin per unit on the table` : ""
      }.`,
      href: topRaise.href,
      ctaLabel: "Review price",
    });
  }

  const cut = body.priceChanges.find((item) => (item.changePercentage ?? 0) <= -10);
  if (cut) {
    const pct = absPct(cut.changePercentage);
    actions.push({
      id: `cut-${cut.id}`,
      priority: Math.abs(cut.changePercentage ?? 0) >= 20 ? "high" : "medium",
      title: `${cut.retailerName ?? "A competitor"} cut ${cut.productName ?? "a product"} by ${pct}%`,
      detail: cut.message,
      href: cut.href,
      ctaLabel: "See the comparison",
    });
  }

  const below = totalBelowOfficial(body);
  const worstBrand = [...body.brandCompliance].sort((a, b) => b.belowOfficial - a.belowOfficial)[0];
  if (below > 0 && worstBrand) {
    actions.push({
      id: "below-official",
      priority: below >= 10 ? "high" : "medium",
      title: `${plural(below, "partner listing")} below the official price`,
      detail: `${worstBrand.brandName} has the most (${worstBrand.belowOfficial}). Undercutting hurts the brand's price position.`,
      href: worstBrand.href,
      ctaLabel: "See which stores",
    });
  }

  return actions;
}

function salesActions(body: ReportBody): ReportActionDTO[] {
  const actions: ReportActionDTO[] = [];

  const callStore = [...body.storeBriefs].sort((a, b) => b.restockCount - a.restockCount)[0];
  if (callStore && callStore.restockCount > 0) {
    actions.push({
      id: `call-${callStore.domain}`,
      priority: callStore.restockCount >= 3 ? "high" : "medium",
      title: `Call ${callStore.name}: ${plural(callStore.restockCount, "product")} out of stock`,
      detail: `They already sell ${callStore.brand}.${
        callStore.talkingPoints.length > 0 ? ` Offer a refill of ${callStore.talkingPoints.slice(0, 3).join(", ")}.` : ""
      }`,
      href: callStore.href,
      ctaLabel: "Open the store brief",
    });
  }

  const undercutter = [...body.storeCompliance].sort((a, b) => b.belowOfficial - a.belowOfficial)[0];
  if (undercutter && undercutter.belowOfficial > 0) {
    const gap = undercutter.averageGapPercentage;
    actions.push({
      id: `undercut-${undercutter.domain}-${undercutter.brandSlug}`,
      priority: undercutter.belowOfficial >= 3 ? "high" : "medium",
      title: `${undercutter.storeName} sells ${plural(undercutter.belowOfficial, `${undercutter.brandName} product`)} below the official price`,
      detail:
        gap !== null
          ? `On average ${absPct(gap)}% off the official price. Ask them to align.`
          : "Ask them to align with the official price.",
      href: undercutter.href,
      ctaLabel: "See prices by store",
    });
  }

  const stockOut = body.outOfStock[0];
  if (stockOut) {
    actions.push({
      id: `stockout-${stockOut.id}`,
      priority: "medium",
      title: `${stockOut.retailerName ?? "A competitor"} is out of stock on ${stockOut.productName ?? "a product"}`,
      detail: "Shoppers will look elsewhere. Make sure your own channels and partners have stock ready.",
      href: stockOut.href,
      ctaLabel: "Open the product",
    });
  }

  const pitch = [...body.storeBriefs].filter((s) => s.pitchCount > 0 && s.restockCount === 0).sort((a, b) => b.pitchCount - a.pitchCount)[0];
  if (pitch) {
    actions.push({
      id: `pitch-${pitch.domain}`,
      priority: "low",
      title: `Pitch ${pitch.name}: ${plural(pitch.pitchCount, "product")} they do not list yet`,
      detail: `They stock ${pitch.coveragePercentage}% of the ${pitch.brand} range.`,
      href: pitch.href,
      ctaLabel: "Open the store brief",
    });
  }

  const door = body.unopenedDoors[0];
  if (door) {
    actions.push({
      id: `door-${door.domain}`,
      priority: "low",
      title: `Open ${door.name} for ${door.brand}`,
      detail: `They already sell ${plural(door.otherBrandListings, "product")} from other tracked brands and have never listed ${door.brand}.`,
      href: door.href,
      ctaLabel: "See the store",
    });
  }

  return actions;
}

function marketingActions(body: ReportBody, link: LinkBuilder): ReportActionDTO[] {
  const actions: ReportActionDTO[] = [];

  const weak = body.contentGaps[0];
  if (weak) {
    const issues = weak.issueLabels.slice(0, 2).join(", ");
    const keywords = weak.topMissingKeywords.slice(0, 3).join(", ");
    actions.push({
      id: `content-${weak.productId}`,
      priority: weak.score !== null && weak.score < 60 ? "high" : "medium",
      title: `Improve the ${weak.productName} page${weak.score !== null ? ` (score ${weak.score}/100)` : ""}`,
      detail: [issues ? `Fix: ${issues}.` : "", keywords ? `Competitors rank for: ${keywords}.` : ""].filter(Boolean).join(" ") ||
        "Its content scores below the target.",
      href: weak.href,
      ctaLabel: "Open the content tab",
    });
  }

  const rewrite = body.contentChanges[0];
  if (rewrite) {
    actions.push({
      id: `rewrite-${rewrite.id}`,
      priority: "medium",
      title: `${rewrite.retailerName ?? "A competitor"} rewrote the ${rewrite.productName ?? "product"} page`,
      detail: rewrite.message,
      href: rewrite.href,
      ctaLabel: "Compare the copy",
    });
  }

  const ours = body.campaignInsights.find((insight) => insight.type === "our_weakness");
  if (ours) {
    actions.push({
      id: "insight-ours",
      priority: "medium",
      title: `Fix before promoting: ${ours.title}`,
      detail: ours.suggestedAction,
      href: ours.href,
      ctaLabel: "See the evidence",
    });
  }

  const angle = body.campaignInsights.find((insight) => insight.type === "competitor_weakness");
  if (angle) {
    actions.push({
      id: "insight-angle",
      priority: "medium",
      title: `Campaign angle: ${angle.title}`,
      detail: angle.suggestedAction,
      href: angle.href,
      ctaLabel: "Open campaign briefs",
    });
  }

  const notCaptured = body.contentHealth?.notCaptured ?? 0;
  if (notCaptured > 0) {
    actions.push({
      id: "content-not-captured",
      priority: "low",
      title: `Capture content for ${plural(notCaptured, "product page")}`,
      detail: "Without a captured page there is nothing to compare with competitors.",
      href: resolveLink(link, reportPaths.content("not_captured")),
      ctaLabel: "See the list",
    });
  }

  return actions;
}

/** Ranked "do this first" list for the role. */
export function deriveActions(body: ReportBody, link: LinkBuilder): ReportActionDTO[] {
  if (body.audience === "ceo") return sortByPriority(ceoActions(body, link)).slice(0, MAX_ACTIONS);
  if (body.audience === "sales") return sortByPriority(salesActions(body)).slice(0, MAX_ACTIONS);
  if (body.audience === "marketing") return sortByPriority(marketingActions(body, link)).slice(0, MAX_ACTIONS);

  const merged = [
    ...sortByPriority(ceoActions(body, link)).slice(0, 2),
    ...sortByPriority(salesActions(body)).slice(0, 2),
    ...sortByPriority(marketingActions(body, link)).slice(0, 2),
  ];
  return sortByPriority(merged).slice(0, MAX_ACTIONS_ALL);
}

function ceoSummary(body: ReportBody): string[] {
  const lines: string[] = [];
  const pricing = body.pricing;
  if (pricing && pricing.productsCompared > 0) {
    lines.push(
      `${pricing.productsCompared} products compared: ${pricing.overpriced} priced above market, ${pricing.underpriced} below, ${pricing.marketAligned} aligned.`,
    );
  }
  if (body.decisionsTotal > 0) {
    lines.push(`${plural(body.decisionsTotal, "product")} sit more than 10% away from the market median.`);
  }
  const move = body.priceChanges[0];
  if (move && move.changePercentage !== null) {
    lines.push(
      `Biggest competitor move: ${move.retailerName ?? "a store"} ${move.changePercentage < 0 ? "cut" : "raised"} ${move.productName ?? "a product"} by ${absPct(move.changePercentage)}%.`,
    );
  }
  const below = totalBelowOfficial(body);
  if (below > 0) lines.push(`${plural(below, "partner listing")} below the official brand price.`);
  return lines;
}

function salesSummary(body: ReportBody): string[] {
  const lines: string[] = [];
  const opp = body.opportunitySummary;
  if (opp && opp.restockCount > 0) {
    lines.push(`${plural(opp.restockCount, "restock chance")} across ${plural(opp.storesWithGaps, "store")}.`);
  }
  if (opp && opp.unopenedProductCount > 0) {
    lines.push(`${plural(opp.unopenedProductCount, "product")} not listed at any partner yet.`);
  }
  const below = totalBelowOfficial(body);
  if (below > 0) lines.push(`${plural(below, "listing")} priced below the official brand price.`);
  if (body.outOfStock.length > 0) {
    lines.push(`${plural(body.outOfStock.length, "competitor stock-out")} in the last ${body.periodDays} days.`);
  }
  return lines;
}

function marketingSummary(body: ReportBody): string[] {
  const lines: string[] = [];
  const content = body.contentHealth;
  if (content && content.averageScore !== null) {
    lines.push(`Average content score ${content.averageScore}/100, with ${plural(content.needsWork, "page")} that need work.`);
  }
  if (content && content.competitorChanges30d > 0) {
    lines.push(`${plural(content.competitorChanges30d, "competitor page")} rewritten in the last 30 days.`);
  }
  const campaign = body.campaignSummary;
  if (campaign && (campaign.ourWeaknesses > 0 || campaign.competitorWeaknesses > 0)) {
    lines.push(
      `Customer reviews show ${plural(campaign.ourWeaknesses, "weak spot")} to fix and ${plural(campaign.competitorWeaknesses, "competitor weakness", "competitor weaknesses")} to use.`,
    );
  }
  return lines;
}

export function deriveHeadline(body: ReportBody, actions: ReportActionDTO[]): ReportHeadlineDTO {
  const high = actions.filter((action) => action.priority === "high").length;
  const status: ReportHeadlineDTO["status"] = high > 0 ? "critical" : actions.length > 0 ? "attention" : "healthy";
  const title =
    status === "critical"
      ? `${plural(high, "item")} ${high === 1 ? "needs" : "need"} action now`
      : status === "attention"
        ? `${plural(actions.length, "thing")} worth a look`
        : "All clear. Nothing needs action right now.";

  const byAudience: Record<EmailReportAudience, string[]> = {
    ceo: ceoSummary(body),
    sales: salesSummary(body),
    marketing: marketingSummary(body),
    all: [...ceoSummary(body).slice(0, 2), ...salesSummary(body).slice(0, 2), ...marketingSummary(body).slice(0, 2)],
  };
  const summary = byAudience[body.audience];
  return { status, title, summary: summary.length > 0 ? summary : ["No notable changes in this period."] };
}

type KpiSeed = {
  id: string;
  label: string;
  value: number | null;
  goodWhen: ReportKpiDTO["goodWhen"];
  href: string | null;
  display?: string;
};

function candidateKpis(body: ReportBody, link: LinkBuilder): KpiSeed[] {
  const { pricing, opportunitySummary: opp, contentHealth: content, campaignSummary: campaign } = body;
  const hasBrands = body.brandCompliance.length > 0;
  const link2 = (target: Parameters<typeof resolveLink>[1]) => resolveLink(link, target);

  return [
    { id: "compared", label: "Products compared", value: pricing?.productsCompared ?? null, goodWhen: "up", href: link2(reportPaths.productsByGap()) },
    { id: "overpriced", label: "Priced above market", value: pricing?.overpriced ?? null, goodWhen: "down", href: link2(reportPaths.productsByPosition("OVERPRICED")) },
    { id: "underpriced", label: "Priced below market", value: pricing?.underpriced ?? null, goodWhen: "down", href: link2(reportPaths.productsByPosition("UNDERPRICED")) },
    { id: "aligned", label: "Market aligned", value: pricing?.marketAligned ?? null, goodWhen: "up", href: link2(reportPaths.productsByPosition("MARKET_ALIGNED")) },
    { id: "belowOfficial", label: "Below official price", value: hasBrands ? totalBelowOfficial(body) : null, goodWhen: "down", href: link2(reportPaths.brands()) },
    { id: "newAlerts", label: "New alerts", value: pricing?.newAlerts ?? null, goodWhen: "neutral", href: link2(reportPaths.alerts()) },
    { id: "restocks", label: "Restock chances", value: opp?.restockCount ?? null, goodWhen: "neutral", href: link2(reportPaths.opportunities("restock")) },
    { id: "unlisted", label: "Products to pitch", value: opp?.unopenedProductCount ?? null, goodWhen: "neutral", href: link2(reportPaths.opportunities("stores")) },
    { id: "storesWithGaps", label: "Stores with gaps", value: opp?.storesWithGaps ?? null, goodWhen: "neutral", href: link2(reportPaths.opportunities("stores")) },
    { id: "unopenedDoors", label: "Unopened stores", value: opp?.unopenedDoorCount ?? null, goodWhen: "neutral", href: link2(reportPaths.opportunities("stores")) },
    { id: "stockOuts", label: "Competitor stock-outs", value: opp ? body.outOfStock.length : null, goodWhen: "neutral", href: link2(reportPaths.alerts("OUT_OF_STOCK")) },
    {
      id: "contentScore",
      label: "Avg content score",
      value: content?.averageScore ?? null,
      goodWhen: "up",
      href: link2(reportPaths.content()),
      display: content?.averageScore !== null && content?.averageScore !== undefined ? `${content.averageScore}/100` : undefined,
    },
    { id: "needsWork", label: "Pages needing work", value: content?.needsWork ?? null, goodWhen: "down", href: link2(reportPaths.content("needs_work")) },
    { id: "notCaptured", label: "Pages not captured", value: content?.notCaptured ?? null, goodWhen: "down", href: link2(reportPaths.content("not_captured")) },
    { id: "rewrites", label: "Competitor rewrites (30d)", value: content?.competitorChanges30d ?? null, goodWhen: "neutral", href: link2(reportPaths.alerts("CONTENT_CHANGE")) },
    { id: "ourWeaknesses", label: "Our review weak spots", value: campaign?.ourWeaknesses ?? null, goodWhen: "down", href: link2(reportPaths.campaigns("our_weakness")) },
    { id: "competitorWeaknesses", label: "Competitor weak spots", value: campaign?.competitorWeaknesses ?? null, goodWhen: "neutral", href: link2(reportPaths.campaigns("competitor_weakness")) },
  ];
}

const KPI_IDS_BY_AUDIENCE: Record<EmailReportAudience, readonly string[]> = {
  ceo: ["compared", "overpriced", "underpriced", "aligned", "belowOfficial", "newAlerts"],
  sales: ["restocks", "unlisted", "storesWithGaps", "belowOfficial", "stockOuts", "unopenedDoors"],
  marketing: ["contentScore", "needsWork", "notCaptured", "rewrites", "ourWeaknesses", "competitorWeaknesses"],
  all: ["compared", "overpriced", "underpriced", "belowOfficial", "restocks", "storesWithGaps", "contentScore", "needsWork", "rewrites", "ourWeaknesses"],
};

/** Role-specific KPIs. `previous` is the snapshot saved with the last report sent to this audience. */
export function deriveKpis(body: ReportBody, link: LinkBuilder, previous: KpiSnapshot | null): ReportKpiDTO[] {
  const candidates = new Map(candidateKpis(body, link).map((seed) => [seed.id, seed]));
  const kpis: ReportKpiDTO[] = [];
  for (const id of KPI_IDS_BY_AUDIENCE[body.audience]) {
    const seed = candidates.get(id);
    if (!seed || seed.value === null) continue;
    const before = previous?.[id];
    kpis.push({
      id,
      label: seed.label,
      value: seed.value,
      display: seed.display ?? String(seed.value),
      delta: typeof before === "number" ? seed.value - before : null,
      goodWhen: seed.goodWhen,
      href: seed.href,
    });
  }
  return kpis;
}

export function kpisToSnapshot(kpis: ReportKpiDTO[]): KpiSnapshot {
  return Object.fromEntries(kpis.map((kpi) => [kpi.id, kpi.value]));
}

export function deriveReportInsights(
  body: ReportBody,
  link: LinkBuilder,
  previous: KpiSnapshot | null,
): Pick<ExecutiveReportDTO, "headline" | "actions" | "kpis"> {
  const actions = deriveActions(body, link);
  return {
    headline: deriveHeadline(body, actions),
    actions,
    kpis: deriveKpis(body, link, previous),
  };
}
