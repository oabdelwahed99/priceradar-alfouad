import type { EmailReportAudience } from "@/types";
import type { ReportAlertItemDTO, ReportDecisionItemDTO } from "@/types/dto";
import type { ReportBody } from "./report-insights";

export const TEST_APP_URL = "https://radar.example.com";

export function makeBody(overrides: Partial<ReportBody> = {}, audience: EmailReportAudience = "ceo"): ReportBody {
  return {
    generatedAt: "2026-11-18T10:00:00.000Z",
    audience,
    periodDays: 7,
    appUrl: TEST_APP_URL,
    note: null,
    previousReportAt: null,
    pricing: null,
    opportunitySummary: null,
    campaignSummary: null,
    contentHealth: null,
    decisionsTotal: 0,
    decisionsNeeded: [],
    priceChanges: [],
    outOfStock: [],
    contentChanges: [],
    brandCompliance: [],
    storeCompliance: [],
    storeBriefs: [],
    restocks: [],
    newListings: [],
    unopenedDoors: [],
    contentGaps: [],
    campaignInsights: [],
    ...overrides,
  };
}

export function decision(overrides: Partial<ReportDecisionItemDTO> = {}): ReportDecisionItemDTO {
  return {
    productId: "p1",
    productName: "Hyalu Serum",
    brand: "Dermaelle",
    ownPrice: 400,
    marketMedian: 300,
    gapPercentage: 33.3,
    suggestedPrice: 310,
    currency: "EGP",
    position: "OVERPRICED",
    direction: "lower",
    priceChange: -90,
    href: `${TEST_APP_URL}/products/p1`,
    ...overrides,
  };
}

export function alertItem(overrides: Partial<ReportAlertItemDTO> = {}): ReportAlertItemDTO {
  return {
    id: "a1",
    type: "PRICE_CHANGE",
    title: "Price change: Noon",
    message: "Hyalu Serum at Noon: EGP 300 → EGP 240 (-20.0%)",
    productId: "p1",
    productName: "Hyalu Serum",
    retailerName: "Noon",
    changePercentage: -20,
    createdAt: "2026-11-17T10:00:00.000Z",
    href: `${TEST_APP_URL}/products/p1`,
    ...overrides,
  };
}
