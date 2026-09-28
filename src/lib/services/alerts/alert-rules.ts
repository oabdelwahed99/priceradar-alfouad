import type { AlertType, Availability } from "@/types";
import { priceDifferencePercentage } from "../pricing/pricing-analysis.service";
import { roundPercentage } from "../pricing/rounding";

export const ALERT_GAP_THRESHOLD = 10;
const PRICE_EPSILON = 0.005;

export interface ObservationSnapshot {
  price: number;
  availability: Availability;
  currency: string | null;
}

export interface SourceChange {
  sourceId: string;
  retailerId: string;
  retailerName: string;
  isOwnStore: boolean;
  previous: ObservationSnapshot | null;
  current: ObservationSnapshot;
}

export interface AlertRuleInput {
  productName: string;
  changes: SourceChange[];
  previousGap: number | null;
  currentGap: number | null;
  marketMedian: number | null;
  currency: string | null;
}

export interface AlertDraft {
  type: AlertType;
  sourceId: string | null;
  retailerId: string | null;
  title: string;
  message: string;
  payload: Record<string, unknown>;
}

const fmt = (value: number, currency: string | null) => {
  if (currency) {
    try {
      return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
    } catch {
      // fall through
    }
  }
  return value.toFixed(2);
};

/**
 * Deterministic alert rules:
 *  1. Competitor price changed since the previous observation.
 *  2. Own price moved above +10% of the market median (transition only).
 *  3. Own price moved below -10% of the market median (transition only).
 *  4. Competitor went out of stock (transition only).
 * Content changes are detected separately by `detectContentAlerts`.
 */
export function detectAlerts(input: AlertRuleInput): AlertDraft[] {
  const alerts: AlertDraft[] = [];

  for (const change of input.changes) {
    if (change.isOwnStore || !change.previous) continue;
    const { previous, current } = change;
    const currency = current.currency ?? previous.currency ?? input.currency;

    if (Math.abs(current.price - previous.price) >= PRICE_EPSILON) {
      const pct = roundPercentage(priceDifferencePercentage(current.price, previous.price));
      alerts.push({
        type: "PRICE_CHANGE",
        sourceId: change.sourceId,
        retailerId: change.retailerId,
        title: `Price change: ${change.retailerName}`,
        message: `${input.productName} at ${change.retailerName}: ${fmt(previous.price, currency)} → ${fmt(current.price, currency)} (${pct > 0 ? "+" : ""}${pct.toFixed(1)}%)`,
        payload: { previousPrice: previous.price, currentPrice: current.price, changePercentage: pct, currency },
      });
    }

    if (current.availability === "out_of_stock" && previous.availability !== "out_of_stock") {
      alerts.push({
        type: "OUT_OF_STOCK",
        sourceId: change.sourceId,
        retailerId: change.retailerId,
        title: `Out of stock: ${change.retailerName}`,
        message: `${input.productName} is now out of stock at ${change.retailerName}.`,
        payload: { previousAvailability: previous.availability },
      });
    }
  }

  const { previousGap, currentGap } = input;
  if (currentGap !== null) {
    const wasOver = previousGap !== null && previousGap > ALERT_GAP_THRESHOLD;
    const wasUnder = previousGap !== null && previousGap < -ALERT_GAP_THRESHOLD;
    const median = input.marketMedian !== null ? fmt(input.marketMedian, input.currency) : "the market median";

    if (currentGap > ALERT_GAP_THRESHOLD && !wasOver) {
      alerts.push({
        type: "OVERPRICED",
        sourceId: null,
        retailerId: null,
        title: "Your price is more than 10% above market",
        message: `${input.productName} is ${currentGap.toFixed(2)}% above the market median (${median}).`,
        payload: { gapPercentage: currentGap, previousGap, marketMedian: input.marketMedian },
      });
    }
    if (currentGap < -ALERT_GAP_THRESHOLD && !wasUnder) {
      alerts.push({
        type: "UNDERPRICED",
        sourceId: null,
        retailerId: null,
        title: "Your price is more than 10% below market",
        message: `${input.productName} is ${Math.abs(currentGap).toFixed(2)}% below the market median (${median}).`,
        payload: { gapPercentage: currentGap, previousGap, marketMedian: input.marketMedian },
      });
    }
  }

  return alerts;
}

const CONTENT_FIELD_LABELS: Record<string, string> = {
  title: "title",
  metaDescription: "meta description",
  description: "description",
  headings: "headings",
  bulletPoints: "bullet points",
  faqQuestions: "FAQ",
};

export interface ContentChange {
  sourceId: string;
  retailerId: string;
  retailerName: string;
  isOwnStore: boolean;
  fields: string[];
}

/** 5. A competitor rewrote its product page copy (often an SEO push or repositioning). */
export function detectContentAlerts(productName: string, changes: ContentChange[]): AlertDraft[] {
  return changes
    .filter((c) => !c.isOwnStore && c.fields.length > 0)
    .map((c) => {
      const parts = new Intl.ListFormat("en", { type: "conjunction" }).format(c.fields.map((f) => CONTENT_FIELD_LABELS[f] ?? f));
      return {
        type: "CONTENT_CHANGE" as const,
        sourceId: c.sourceId,
        retailerId: c.retailerId,
        title: `Page updated: ${c.retailerName}`,
        message: `${c.retailerName} changed the ${parts} of its ${productName} page.`,
        payload: { fields: c.fields },
      };
    });
}
