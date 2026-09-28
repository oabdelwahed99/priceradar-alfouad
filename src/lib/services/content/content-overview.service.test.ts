import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import type { ContentOverviewRowDTO } from "@/types/dto";
import { buildContentAnalysis, type ContentFields } from "./content-analysis";
import { buildContentOverview, scoreBand, sortContentRows, summarizeContentRow } from "./content-overview.service";

const content = (overrides: Partial<ContentFields> = {}): ContentFields => ({
  title: "Argan Oil Shampoo 400ml for Dry Hair | Glow Store",
  metaDescription: "Sulfate-free argan oil shampoo with keratin that restores shine to dry, damaged hair. Free delivery.",
  description:
    "This nourishing argan oil shampoo gently cleanses dry damaged hair restoring natural shine softness strength moisture balance without heavy residue. Ingredients: aqua, argan oil. Halal.",
  headings: { h1: ["Argan Oil Shampoo"], h2: ["Benefits"], h3: [] },
  bulletPoints: ["Sulfate-free"],
  faqQuestions: [],
  rating: null,
  images: { total: 2, withAlt: 2 },
  language: "en",
  ...overrides,
});

const row = (overrides: Partial<ContentOverviewRowDTO>): ContentOverviewRowDTO => ({
  productId: overrides.name ?? "p",
  name: "Product",
  brand: null,
  size: null,
  score: 50,
  ownPageCaptured: true,
  competitorCount: 2,
  competitorPagesCaptured: 2,
  failedChecks: 0,
  warningChecks: 0,
  issueLabels: [],
  missingKeywordCount: 0,
  topMissingKeywords: [],
  missingFacts: [],
  descriptionWords: 100,
  competitorMedianWords: 100,
  lastCompetitorChange: null,
  ...overrides,
});

describe("summarizeContentRow", () => {
  it("condenses a product's analysis into one table row", () => {
    const analysis = buildContentAnalysis([
      {
        sourceId: "own",
        retailerName: "Glow Store",
        url: "https://glow.example/p",
        isOwnStore: true,
        content: content({ metaDescription: null, description: "Short text.", bulletPoints: [] }),
        contentSince: new Date("2026-09-01T00:00:00Z"),
        lastSeenAt: new Date("2026-09-20T00:00:00Z"),
        versionCount: 1,
      },
      ...["Store A", "Store B"].map((name, i) => ({
        sourceId: `c${i}`,
        retailerName: name,
        url: `https://store${i}.example/p`,
        isOwnStore: false,
        content: content(),
        contentSince: new Date(`2026-09-1${i}T00:00:00Z`),
        lastSeenAt: new Date("2026-09-20T00:00:00Z"),
        versionCount: i === 1 ? 2 : 1,
      })),
    ]);
    const summary = summarizeContentRow({ _id: new Types.ObjectId(), name: "Argan Shampoo", brand: "Glow", size: "400ml" }, analysis);

    expect(summary.score).toBe(analysis.score);
    expect(summary.failedChecks).toBeGreaterThan(0);
    expect(summary.issueLabels[0]).toBe("Meta description");
    expect(summary.missingKeywordCount).toBe(analysis.keywords.missing.length);
    expect(summary.topMissingKeywords).toHaveLength(3);
    expect(summary.missingFacts).toEqual(expect.arrayContaining(["Ingredients list", "Halal"]));
    expect(summary.descriptionWords).toBe(2);
    expect(summary.lastCompetitorChange).toEqual({ retailerName: "Store B", at: "2026-09-11T00:00:00.000Z" });
  });
});

describe("scoreBand", () => {
  it("maps scores to bands", () => {
    expect(scoreBand({ ownPageCaptured: true, score: 85 })).toBe("good");
    expect(scoreBand({ ownPageCaptured: true, score: 50 })).toBe("fair");
    expect(scoreBand({ ownPageCaptured: true, score: 49 })).toBe("needs_work");
    expect(scoreBand({ ownPageCaptured: false, score: null })).toBe("not_captured");
  });
});

describe("sortContentRows", () => {
  const rows = [
    row({ name: "Bravo", score: 70 }),
    row({ name: "alpha", score: 30 }),
    row({ name: "Charlie", score: null, ownPageCaptured: false, descriptionWords: null }),
    row({ name: "Delta", score: 30 }),
  ];

  it("sorts by score with ties by name and uncaptured pages last in both directions", () => {
    expect(sortContentRows(rows, "score", "asc").map((r) => r.name)).toEqual(["alpha", "Delta", "Bravo", "Charlie"]);
    expect(sortContentRows(rows, "score", "desc").map((r) => r.name)).toEqual(["Bravo", "alpha", "Delta", "Charlie"]);
  });

  it("sorts by name case-insensitively", () => {
    expect(sortContentRows(rows, "name", "asc").map((r) => r.name)).toEqual(["alpha", "Bravo", "Charlie", "Delta"]);
  });

  it("ranks failed checks above warnings", () => {
    const issues = [row({ name: "A", failedChecks: 0, warningChecks: 5 }), row({ name: "B", failedChecks: 1, warningChecks: 0 })];
    expect(sortContentRows(issues, "issues", "desc").map((r) => r.name)).toEqual(["B", "A"]);
  });
});

describe("buildContentOverview", () => {
  const now = new Date("2026-09-26T00:00:00Z");
  const rows = [
    row({ name: "A", score: 90 }),
    row({ name: "B", score: 40, lastCompetitorChange: { retailerName: "X", at: "2026-09-20T00:00:00.000Z" } }),
    row({ name: "C", score: 20, lastCompetitorChange: { retailerName: "Y", at: "2026-07-01T00:00:00.000Z" } }),
    row({ name: "D", score: null, ownPageCaptured: false }),
  ];

  it("summarizes all rows, then filters, sorts and paginates", () => {
    const overview = buildContentOverview(rows, { sort: "score", order: "asc", page: 1, pageSize: 2 }, { now });
    expect(overview.summary).toEqual({ productsAnalyzed: 4, averageScore: 50, needsWork: 2, notCaptured: 1, competitorChanges30d: 1 });
    expect(overview.items.map((r) => r.name)).toEqual(["C", "B"]);
    expect(overview.total).toBe(4);
    expect(overview.totalPages).toBe(2);
  });

  it("filters by score band without changing the summary", () => {
    const overview = buildContentOverview(rows, { band: "needs_work", sort: "score", order: "asc", page: 1, pageSize: 20 }, { now });
    expect(overview.items.map((r) => r.name)).toEqual(["C", "B"]);
    expect(overview.productIds).toEqual(["C", "B"]);
    expect(overview.summary.productsAnalyzed).toBe(4);
  });
});
