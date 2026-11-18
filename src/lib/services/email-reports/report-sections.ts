import type { EmailReportAudience } from "@/types";

export const REPORT_SECTION_IDS = [
  "decisions",
  "priceChanges",
  "brandCompliance",
  "storeBriefs",
  "storeCompliance",
  "restocks",
  "newListings",
  "outOfStock",
  "unopenedDoors",
  "contentHealth",
  "contentChanges",
  "campaignInsights",
] as const;

export type ReportSectionId = (typeof REPORT_SECTION_IDS)[number];

/**
 * Sections below the headline, actions and KPIs. Each role gets what it can act on:
 * the CEO sees pricing decisions, sales sees the store call list, marketing sees content and reviews.
 */
const AUDIENCE_SECTIONS: Record<EmailReportAudience, readonly ReportSectionId[]> = {
  ceo: ["decisions", "priceChanges", "brandCompliance"],
  sales: ["storeBriefs", "restocks", "storeCompliance", "outOfStock", "newListings", "unopenedDoors"],
  marketing: ["contentHealth", "contentChanges", "campaignInsights"],
  all: [
    "decisions",
    "priceChanges",
    "brandCompliance",
    "storeBriefs",
    "restocks",
    "storeCompliance",
    "outOfStock",
    "newListings",
    "unopenedDoors",
    "contentHealth",
    "contentChanges",
    "campaignInsights",
  ],
};

/** Ordered section ids for a report audience. Pure helper for the builder, renderer and tests. */
export function sectionsForAudience(audience: EmailReportAudience): readonly ReportSectionId[] {
  return AUDIENCE_SECTIONS[audience];
}

export function audienceHas(audience: EmailReportAudience, section: ReportSectionId): boolean {
  return AUDIENCE_SECTIONS[audience].includes(section);
}

export function audienceLabel(audience: EmailReportAudience): string {
  switch (audience) {
    case "ceo":
      return "CEO";
    case "sales":
      return "Sales";
    case "marketing":
      return "Marketing";
    case "all":
      return "All teams";
  }
}

/** One-line description of what this role's brief is for. */
export function audiencePurpose(audience: EmailReportAudience): string {
  switch (audience) {
    case "ceo":
      return "Pricing decisions and market risks that need your call";
    case "sales":
      return "Stores to call, shelves to refill and partners to correct";
    case "marketing":
      return "Content gaps, competitor rewrites and campaign angles";
    case "all":
      return "Everything the pricing, sales and marketing teams need to act on";
  }
}
