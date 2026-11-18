import type { CampaignInsightTypeDTO, ExecutiveReportDTO, ReportKpiDTO, ReportPriority, ReportStatus } from "@/types/dto";
import { formatDateTime, formatMoney, formatPercent } from "@/utils/format";
import { createLinkBuilder, reportPaths, resolveLink, type LinkBuilder } from "./report-links";
import { audienceLabel, audiencePurpose, sectionsForAudience, type ReportSectionId } from "./report-sections";

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export interface RenderOptions {
  /** Used for the greeting. Falls back to a neutral greeting. */
  recipientName?: string | null;
}

type Block = { html: string; text: string };

const FONT = "font-family:Arial,Helvetica,sans-serif;";
const INK = "#111827";
const MUTED = "#6b7280";
const LINE = "#e5e7eb";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const esc = escapeHtml;

/** Only http(s) URLs are allowed in href attributes. */
function safeHref(href: string | null | undefined): string | null {
  if (!href) return null;
  return /^https?:\/\//i.test(href) ? href : null;
}

function anchor(text: string, href: string | null, style = `color:${INK};text-decoration:underline;`): string {
  const url = safeHref(href);
  return url ? `<a href="${esc(url)}" style="${style}">${esc(text)}</a>` : esc(text);
}

function button(label: string, href: string | null, tone: "dark" | "light" = "light"): string {
  const url = safeHref(href);
  if (!url) return "";
  const style =
    tone === "dark"
      ? `display:inline-block;padding:10px 18px;background:${INK};color:#ffffff;text-decoration:none;border-radius:6px;${FONT}font-size:14px;font-weight:600;`
      : `display:inline-block;padding:6px 12px;background:#ffffff;color:${INK};text-decoration:none;border:1px solid #d1d5db;border-radius:6px;${FONT}font-size:12px;font-weight:600;`;
  return `<a href="${esc(url)}" style="${style}">${esc(label)} &rarr;</a>`;
}

function badge(text: string, fg: string, bg: string): string {
  return `<span style="display:inline-block;padding:2px 8px;border-radius:999px;background:${bg};color:${fg};${FONT}font-size:11px;font-weight:700;letter-spacing:0.02em;">${esc(text)}</span>`;
}

const PRIORITY_STYLE: Record<ReportPriority, { label: string; fg: string; bg: string }> = {
  high: { label: "Do first", fg: "#991b1b", bg: "#fee2e2" },
  medium: { label: "Soon", fg: "#92400e", bg: "#fef3c7" },
  low: { label: "When you can", fg: "#374151", bg: "#f3f4f6" },
};

const STATUS_STYLE: Record<ReportStatus, { fg: string; bg: string; border: string; label: string }> = {
  critical: { fg: "#991b1b", bg: "#fef2f2", border: "#fecaca", label: "Action needed" },
  attention: { fg: "#92400e", bg: "#fffbeb", border: "#fde68a", label: "Worth a look" },
  healthy: { fg: "#065f46", bg: "#ecfdf5", border: "#a7f3d0", label: "All clear" },
};

const INSIGHT_LABEL: Record<CampaignInsightTypeDTO, string> = {
  competitor_weakness: "Competitor weakness",
  our_weakness: "Our weakness",
  strength: "Strength",
  review_gap: "Review gap",
  price_value: "Price / value",
};

function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

function row(index: number, inner: string): string {
  const bg = index % 2 === 0 ? "#ffffff" : "#f9fafb";
  return `<tr><td style="padding:12px;border-bottom:1px solid ${LINE};background:${bg};${FONT}font-size:13px;line-height:1.5;color:${INK};">${inner}</td></tr>`;
}

function section(title: string, subtitle: string, viewAll: { label: string; href: string | null } | null, rows: string[]): string {
  const link = viewAll ? button(viewAll.label, viewAll.href) : "";
  return `
    <tr>
      <td style="padding:24px 24px 4px;${FONT}">
        <div style="font-size:16px;font-weight:700;color:${INK};">${esc(title)}</div>
        <div style="font-size:12px;color:${MUTED};margin-top:2px;">${esc(subtitle)}</div>
      </td>
    </tr>
    <tr>
      <td style="padding:8px 24px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid ${LINE};">
          ${rows.join("")}
        </table>
      </td>
    </tr>
    ${link ? `<tr><td style="padding:10px 24px 0;">${link}</td></tr>` : ""}`;
}

function textSection(title: string, lines: string[], viewAllHref: string | null): string {
  const out = [title.toUpperCase(), ...lines];
  if (viewAllHref) out.push(`  See all: ${viewAllHref}`);
  return out.join("\n");
}

function withUrl(line: string, href: string | null): string {
  return href ? `${line}\n    ${href}` : line;
}

function deltaText(kpi: ReportKpiDTO): { text: string; color: string } | null {
  if (kpi.delta === null) return null;
  if (kpi.delta === 0) return { text: "no change", color: MUTED };
  const up = kpi.delta > 0;
  const good = kpi.goodWhen === "neutral" ? null : kpi.goodWhen === "up" ? up : !up;
  const color = good === null ? MUTED : good ? "#047857" : "#b91c1c";
  return { text: `${up ? "\u25B2" : "\u25BC"} ${up ? "+" : ""}${kpi.delta}`, color };
}

function renderKpis(report: ExecutiveReportDTO): Block | null {
  if (report.kpis.length === 0) return null;
  const perRow = 3;
  const rows: string[] = [];
  for (let i = 0; i < report.kpis.length; i += perRow) {
    const cells = report.kpis.slice(i, i + perRow).map((kpi) => {
      const delta = deltaText(kpi);
      const inner = `
        <div style="font-size:11px;color:${MUTED};text-transform:uppercase;letter-spacing:0.04em;">${esc(kpi.label)}</div>
        <div style="font-size:24px;font-weight:700;color:${INK};margin-top:4px;">${esc(kpi.display)}</div>
        <div style="font-size:11px;margin-top:2px;color:${delta?.color ?? MUTED};">${delta ? esc(delta.text) : "&nbsp;"}</div>`;
      const url = safeHref(kpi.href);
      return `<td width="33%" valign="top" style="padding:12px;border:1px solid ${LINE};background:#f9fafb;${FONT}">${
        url ? `<a href="${esc(url)}" style="text-decoration:none;color:inherit;display:block;">${inner}</a>` : inner
      }</td>`;
    });
    while (cells.length < perRow) cells.push(`<td width="33%" style="padding:12px;"></td>`);
    rows.push(`<tr>${cells.join("")}</tr>`);
  }

  const since = report.previousReportAt
    ? `Change since the last ${audienceLabel(report.audience)} report (${formatDateTime(report.previousReportAt)})`
    : "Current numbers. Changes will appear after the next report.";

  const html = `
    <tr>
      <td style="padding:24px 24px 4px;${FONT}">
        <div style="font-size:16px;font-weight:700;color:${INK};">Key numbers</div>
        <div style="font-size:12px;color:${MUTED};margin-top:2px;">${esc(since)}</div>
      </td>
    </tr>
    <tr>
      <td style="padding:8px 24px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="6" style="border-collapse:separate;">
          ${rows.join("")}
        </table>
      </td>
    </tr>`;

  const text = [
    "KEY NUMBERS",
    ...report.kpis.map((kpi) => {
      const delta = deltaText(kpi);
      return `- ${kpi.label}: ${kpi.display}${delta ? ` (${delta.text})` : ""}`;
    }),
  ].join("\n");
  return { html, text };
}

function renderActions(report: ExecutiveReportDTO): Block | null {
  if (report.actions.length === 0) return null;
  const cards = report.actions.map((action, index) => {
    const style = PRIORITY_STYLE[action.priority];
    return `
      <tr>
        <td style="padding:14px;border:1px solid ${LINE};border-left:4px solid ${style.fg};background:#ffffff;${FONT}">
          <div>${badge(style.label, style.fg, style.bg)} <span style="font-size:12px;color:${MUTED};">#${index + 1}</span></div>
          <div style="font-size:15px;font-weight:700;color:${INK};margin-top:6px;">${anchor(action.title, action.href)}</div>
          <div style="font-size:13px;color:#4b5563;margin-top:4px;line-height:1.5;">${esc(action.detail)}</div>
          ${action.href ? `<div style="margin-top:10px;">${button(action.ctaLabel, action.href)}</div>` : ""}
        </td>
      </tr>
      <tr><td style="height:8px;line-height:8px;font-size:0;">&nbsp;</td></tr>`;
  });

  const html = `
    <tr>
      <td style="padding:24px 24px 4px;${FONT}">
        <div style="font-size:16px;font-weight:700;color:${INK};">Your top actions</div>
        <div style="font-size:12px;color:${MUTED};margin-top:2px;">Ranked by urgency. Each one opens the right page in Price Radar.</div>
      </td>
    </tr>
    <tr>
      <td style="padding:8px 24px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          ${cards.join("")}
        </table>
      </td>
    </tr>`;

  const text = [
    "YOUR TOP ACTIONS",
    ...report.actions.map((action, index) =>
      withUrl(`${index + 1}. [${PRIORITY_STYLE[action.priority].label}] ${action.title}\n   ${action.detail}`, action.href),
    ),
  ].join("\n");
  return { html, text };
}

function renderSection(id: ReportSectionId, report: ExecutiveReportDTO, link: LinkBuilder): Block | null {
  switch (id) {
    case "decisions": {
      if (report.decisionsNeeded.length === 0) return null;
      const viewAll = { label: "See all products by gap", href: resolveLink(link, reportPaths.productsByGap()) };
      const rows = report.decisionsNeeded.map((item, index) => {
        const lower = item.direction === "lower";
        const tag = lower ? badge("Lower the price", "#991b1b", "#fee2e2") : badge("Room to raise", "#065f46", "#d1fae5");
        return row(
          index,
          `<div><strong>${anchor(item.productName, item.href)}</strong>${item.brand ? ` <span style="color:${MUTED};">${esc(item.brand)}</span>` : ""} ${tag}</div>
           <div style="color:#4b5563;margin-top:4px;">Now ${esc(formatMoney(item.ownPrice, item.currency))} &middot; market median ${esc(formatMoney(item.marketMedian, item.currency))} &middot; gap ${esc(formatPercent(item.gapPercentage, 0))}${
             item.suggestedPrice !== null ? ` &rarr; suggested <strong>${esc(formatMoney(item.suggestedPrice, item.currency))}</strong>` : ""
           }</div>`,
        );
      });
      const more =
        report.decisionsTotal > report.decisionsNeeded.length
          ? `Showing ${report.decisionsNeeded.length} of ${report.decisionsTotal}, largest gap first.`
          : "Largest gap first.";
      return {
        html: section("Pricing decisions", `Products more than 10% away from the market median. ${more}`, viewAll, rows),
        text: textSection(
          "Pricing decisions",
          report.decisionsNeeded.map((item) =>
            withUrl(
              `- ${item.productName}: ${item.direction === "lower" ? "lower" : "raise"}, gap ${formatPercent(item.gapPercentage, 0)}${
                item.suggestedPrice !== null ? `, suggested ${formatMoney(item.suggestedPrice, item.currency)}` : ""
              }`,
              item.href,
            ),
          ),
          viewAll.href,
        ),
      };
    }
    case "priceChanges": {
      if (report.priceChanges.length === 0) return null;
      const viewAll = { label: "All price alerts", href: resolveLink(link, reportPaths.alerts("PRICE_CHANGE")) };
      const rows = report.priceChanges.map((item, index) => {
        const pct = item.changePercentage;
        const tag =
          pct === null ? "" : badge(formatPercent(pct, 0), pct < 0 ? "#991b1b" : "#065f46", pct < 0 ? "#fee2e2" : "#d1fae5");
        return row(
          index,
          `<div><strong>${anchor(item.title, item.href)}</strong> ${tag}</div><div style="color:#4b5563;margin-top:4px;">${esc(item.message)}</div>`,
        );
      });
      return {
        html: section("Competitor price moves", `Last ${report.periodDays} days, biggest moves first`, viewAll, rows),
        text: textSection(
          "Competitor price moves",
          report.priceChanges.map((item) => withUrl(`- ${item.message}`, item.href)),
          viewAll.href,
        ),
      };
    }
    case "brandCompliance": {
      if (report.brandCompliance.length === 0) return null;
      const viewAll = { label: "All brands", href: resolveLink(link, reportPaths.brands()) };
      const rows = report.brandCompliance.map((item, index) =>
        row(
          index,
          `<div><strong>${anchor(item.brandName, item.href)}</strong></div>
           <div style="color:#4b5563;margin-top:4px;">${item.belowOfficial} below the official price &middot; ${item.aboveOfficial} above &middot; ${item.outOfStock} out of stock &middot; ${plural(item.storeCount, "store")}</div>`,
        ),
      );
      return {
        html: section("Brand price compliance", "How partner stores price against each official brand shop", viewAll, rows),
        text: textSection(
          "Brand price compliance",
          report.brandCompliance.map((item) =>
            withUrl(`- ${item.brandName}: ${item.belowOfficial} below official, ${item.outOfStock} out of stock`, item.href),
          ),
          viewAll.href,
        ),
      };
    }
    case "storeBriefs": {
      if (report.storeBriefs.length === 0) return null;
      const viewAll = { label: "Open store briefs", href: resolveLink(link, reportPaths.opportunities("stores")) };
      const rows = report.storeBriefs.map((item, index) =>
        row(
          index,
          `<div><strong>${anchor(item.name, item.href)}</strong> <span style="color:${MUTED};">${esc(item.domain)}</span></div>
           <div style="color:#4b5563;margin-top:4px;">${esc(item.brand)}: ${item.restockCount} out of stock &middot; ${item.pitchCount} not listed &middot; ${item.coveragePercentage}% of the range</div>
           ${item.talkingPoints.length > 0 ? `<div style="color:${MUTED};margin-top:4px;font-size:12px;">Mention: ${esc(item.talkingPoints.join(", "))}</div>` : ""}`,
        ),
      );
      return {
        html: section("Store call list", "Stores that need a call, most urgent first", viewAll, rows),
        text: textSection(
          "Store call list",
          report.storeBriefs.map((item) =>
            withUrl(`- ${item.name}: ${item.restockCount} out of stock, ${item.pitchCount} not listed`, item.href),
          ),
          viewAll.href,
        ),
      };
    }
    case "restocks":
    case "newListings": {
      const items = id === "restocks" ? report.restocks : report.newListings;
      if (items.length === 0) return null;
      const title = id === "restocks" ? "Shelves to refill" : "Products to get listed";
      const subtitle =
        id === "restocks"
          ? "Partner shelves that are empty while you have stock to offer"
          : "Products a partner store has never listed";
      const viewAll = {
        label: id === "restocks" ? "All restock chances" : "All listing chances",
        href: resolveLink(link, reportPaths.opportunities(id === "restocks" ? "restock" : "listings")),
      };
      const rows = items.map((item, index) =>
        row(
          index,
          `<div><strong>${anchor(item.productName, item.href)}</strong> <span style="color:${MUTED};">at ${esc(item.retailerName)}</span></div>
           <div style="color:#4b5563;margin-top:4px;">${esc(item.action)}</div>`,
        ),
      );
      return {
        html: section(title, subtitle, viewAll, rows),
        text: textSection(
          title,
          items.map((item) => withUrl(`- ${item.productName} at ${item.retailerName}: ${item.action}`, item.href)),
          viewAll.href,
        ),
      };
    }
    case "storeCompliance": {
      if (report.storeCompliance.length === 0) return null;
      const viewAll = { label: "Prices by store", href: resolveLink(link, reportPaths.brands()) };
      const rows = report.storeCompliance.map((item, index) =>
        row(
          index,
          `<div><strong>${anchor(item.storeName, item.href)}</strong> <span style="color:${MUTED};">${esc(item.brandName)}</span></div>
           <div style="color:#4b5563;margin-top:4px;">${item.belowOfficial} of ${plural(item.listings, "listing")} below the official price${
             item.averageGapPercentage !== null ? `, on average ${esc(formatPercent(item.averageGapPercentage, 0))}` : ""
           }</div>`,
        ),
      );
      return {
        html: section("Stores selling below the official price", "Ask these partners to align", viewAll, rows),
        text: textSection(
          "Stores selling below the official price",
          report.storeCompliance.map((item) =>
            withUrl(`- ${item.storeName} (${item.brandName}): ${item.belowOfficial} of ${item.listings} listings below official`, item.href),
          ),
          viewAll.href,
        ),
      };
    }
    case "outOfStock": {
      if (report.outOfStock.length === 0) return null;
      const viewAll = { label: "All stock alerts", href: resolveLink(link, reportPaths.alerts("OUT_OF_STOCK")) };
      const rows = report.outOfStock.map((item, index) =>
        row(index, `<div><strong>${anchor(item.title, item.href)}</strong></div><div style="color:#4b5563;margin-top:4px;">${esc(item.message)}</div>`),
      );
      return {
        html: section("Competitor stock-outs", `Last ${report.periodDays} days. Demand moves to whoever has stock.`, viewAll, rows),
        text: textSection(
          "Competitor stock-outs",
          report.outOfStock.map((item) => withUrl(`- ${item.message}`, item.href)),
          viewAll.href,
        ),
      };
    }
    case "unopenedDoors": {
      if (report.unopenedDoors.length === 0) return null;
      const viewAll = { label: "All store briefs", href: resolveLink(link, reportPaths.opportunities("stores")) };
      const rows = report.unopenedDoors.map((item, index) =>
        row(
          index,
          `<div><strong>${anchor(item.name, item.href)}</strong> <span style="color:${MUTED};">${esc(item.domain)}</span></div>
           <div style="color:#4b5563;margin-top:4px;">Has never listed ${esc(item.brand)}, but already sells ${plural(item.otherBrandListings, "product")} from other tracked brands.</div>`,
        ),
      );
      return {
        html: section("Stores to open", "Good first calls for new distribution", viewAll, rows),
        text: textSection(
          "Stores to open",
          report.unopenedDoors.map((item) => withUrl(`- ${item.name} (${item.domain}): never listed ${item.brand}`, item.href)),
          viewAll.href,
        ),
      };
    }
    case "contentHealth": {
      const health = report.contentHealth;
      if (!health || health.productsAnalyzed === 0) return null;
      const viewAll = { label: "Open Content & SEO", href: health.href };
      const stats =
        `Average score ${health.averageScore !== null ? `${health.averageScore}/100` : "n/a"} &middot; ${health.needsWork} need work &middot; ${health.notCaptured} not captured &middot; ${health.competitorChanges30d} competitor rewrites in 30 days`;
      const rows = [
        row(0, `<div style="color:#4b5563;">${stats}</div>`),
        ...report.contentGaps.map((item, index) => {
          const issues = item.issueLabels.slice(0, 3).join(", ");
          const keywords = item.topMissingKeywords.join(", ");
          return row(
            index + 1,
            `<div><strong>${anchor(item.productName, item.href)}</strong> ${item.score !== null ? badge(`${item.score}/100`, "#92400e", "#fef3c7") : ""}</div>
             ${issues ? `<div style="color:#4b5563;margin-top:4px;">Fix: ${esc(issues)}</div>` : ""}
             ${keywords ? `<div style="color:${MUTED};margin-top:2px;font-size:12px;">Competitors rank for: ${esc(keywords)}</div>` : ""}`,
          );
        }),
      ];
      return {
        html: section("Content health", "Your product pages against competitor pages, weakest first", viewAll, rows),
        text: textSection(
          "Content health",
          [
            `- Average score ${health.averageScore ?? "n/a"}, ${health.needsWork} need work, ${health.notCaptured} not captured`,
            ...report.contentGaps.map((item) =>
              withUrl(`- ${item.productName}${item.score !== null ? ` (${item.score}/100)` : ""}: ${item.issueLabels.slice(0, 3).join(", ")}`, item.href),
            ),
          ],
          viewAll.href,
        ),
      };
    }
    case "contentChanges": {
      if (report.contentChanges.length === 0) return null;
      const viewAll = { label: "All page changes", href: resolveLink(link, reportPaths.alerts("CONTENT_CHANGE")) };
      const rows = report.contentChanges.map((item, index) =>
        row(index, `<div><strong>${anchor(item.title, item.href)}</strong></div><div style="color:#4b5563;margin-top:4px;">${esc(item.message)}</div>`),
      );
      return {
        html: section("Competitor page rewrites", `Last ${report.periodDays} days. Open the product to compare old and new copy.`, viewAll, rows),
        text: textSection(
          "Competitor page rewrites",
          report.contentChanges.map((item) => withUrl(`- ${item.message}`, item.href)),
          viewAll.href,
        ),
      };
    }
    case "campaignInsights": {
      if (report.campaignInsights.length === 0) return null;
      const viewAll = { label: "Open campaign briefs", href: resolveLink(link, reportPaths.campaigns()) };
      const rows = report.campaignInsights.map((item, index) =>
        row(
          index,
          `<div>${badge(INSIGHT_LABEL[item.type], "#1e40af", "#dbeafe")} <strong>${anchor(item.title, item.href)}</strong></div>
           <div style="color:#4b5563;margin-top:4px;">${esc(item.suggestedAction)}</div>
           <div style="color:${MUTED};margin-top:2px;font-size:12px;">${esc(item.evidence)}</div>`,
        ),
      );
      return {
        html: section("Campaign angles from customer reviews", "What shoppers say about you and your competitors", viewAll, rows),
        text: textSection(
          "Campaign angles from customer reviews",
          report.campaignInsights.map((item) => withUrl(`- [${INSIGHT_LABEL[item.type]}] ${item.title}: ${item.suggestedAction}`, item.href)),
          viewAll.href,
        ),
      };
    }
  }
}

function buildSubject(report: ExecutiveReportDTO): string {
  const status = report.headline.status;
  const tail = status === "healthy" ? "All clear" : report.headline.title;
  const prefix = status === "critical" ? "Action needed: " : "";
  return `${prefix}Price Radar ${audienceLabel(report.audience)} brief \u00B7 ${tail}`.slice(0, 150);
}

function greeting(report: ExecutiveReportDTO, options: RenderOptions): string {
  const name = options.recipientName?.trim();
  if (name) return `Hi ${name},`;
  return report.audience === "all" ? "Hi team," : `Hi ${audienceLabel(report.audience)} team,`;
}

export function renderReportEmail(report: ExecutiveReportDTO, options: RenderOptions = {}): RenderedEmail {
  const subject = buildSubject(report);
  const link = createLinkBuilder(report.appUrl);
  const status = STATUS_STYLE[report.headline.status];
  const hello = greeting(report, options);

  const blocks: Block[] = [];
  const actions = renderActions(report);
  if (actions) blocks.push(actions);
  const kpis = renderKpis(report);
  if (kpis) blocks.push(kpis);
  for (const id of sectionsForAudience(report.audience)) {
    const block = renderSection(id, report, link);
    if (block) blocks.push(block);
  }

  const dashboardHref = resolveLink(link, reportPaths.dashboard());
  const noteHtml = report.note
    ? `<tr><td style="padding:14px 24px;background:#eff6ff;border-bottom:1px solid #dbeafe;${FONT}font-size:14px;color:#1f2937;"><strong>Note:</strong> ${esc(report.note)}</td></tr>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:640px;max-width:100%;background:#ffffff;border:1px solid ${LINE};border-radius:8px;overflow:hidden;">
          <tr>
            <td style="padding:24px;background:${INK};color:#ffffff;${FONT}">
              <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.8;">Price Radar &middot; ${esc(audienceLabel(report.audience))} brief</div>
              <div style="font-size:13px;margin-top:6px;opacity:0.85;">Last ${report.periodDays} days &middot; ${esc(formatDateTime(report.generatedAt))}</div>
            </td>
          </tr>
          ${noteHtml}
          <tr>
            <td style="padding:24px 24px 0;${FONT}font-size:14px;color:${INK};line-height:1.5;">
              ${esc(hello)}<br />
              <span style="color:${MUTED};">${esc(audiencePurpose(report.audience))}.</span>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr>
                  <td style="padding:16px;border:1px solid ${status.border};background:${status.bg};border-radius:6px;${FONT}">
                    <div>${badge(status.label, status.fg, "#ffffff")}</div>
                    <div style="font-size:18px;font-weight:700;color:${status.fg};margin-top:8px;">${esc(report.headline.title)}</div>
                    <ul style="margin:8px 0 0;padding-left:18px;font-size:13px;line-height:1.6;color:${INK};">
                      ${report.headline.summary.map((line) => `<li>${esc(line)}</li>`).join("")}
                    </ul>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ${blocks.map((block) => block.html).join("")}
          ${
            dashboardHref
              ? `<tr><td style="padding:28px 24px;text-align:center;">${button("Open Price Radar", dashboardHref, "dark")}</td></tr>`
              : ""
          }
          <tr>
            <td style="padding:8px 24px 24px;${FONT}font-size:12px;color:#9ca3af;line-height:1.5;">
              Built from live pricing, alerts and opportunity data. Links open Price Radar and ask you to sign in first.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const textLines = [
    subject,
    `${audienceLabel(report.audience)} brief, last ${report.periodDays} days, ${formatDateTime(report.generatedAt)}`,
    "",
    hello,
    `${audiencePurpose(report.audience)}.`,
    "",
    `${status.label.toUpperCase()}: ${report.headline.title}`,
    ...report.headline.summary.map((line) => `- ${line}`),
    "",
  ];
  if (report.note) textLines.splice(3, 0, `Note: ${report.note}`, "");
  for (const block of blocks) textLines.push(block.text, "");
  if (dashboardHref) textLines.push(`Open Price Radar: ${dashboardHref}`);

  return { subject, html, text: `${textLines.join("\n").trim()}\n` };
}
