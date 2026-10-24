import { describe, expect, it } from "vitest";
import type { ProductReviewGapDTO, StoreReviewSummaryDTO } from "@/types/dto";
import { buildBrandCampaign, buildCampaignInsights, summarizeInsightCounts, type CampaignReviewInput } from "./campaign-insights";
import { analyzeSentiment, detectThemes } from "./review-analysis";

function store(
  overrides: Partial<StoreReviewSummaryDTO> & Pick<StoreReviewSummaryDTO, "retailerId" | "retailerName" | "isOwnStore">,
): StoreReviewSummaryDTO {
  return {
    domain: "example.com",
    isBrandStore: false,
    reviewCount: 10,
    averageRating: 4,
    sentiment: { positive: 6, neutral: 2, negative: 2 },
    positivePercentage: 60,
    negativePercentage: 20,
    topPraised: [],
    topComplained: [],
    themes: [],
    ...overrides,
  };
}

function theme(
  themeId: StoreReviewSummaryDTO["themes"][number]["themeId"],
  positive: number,
  negative: number,
  mentions = positive + negative,
) {
  return {
    themeId,
    label: themeId,
    mentions,
    positive,
    neutral: 0,
    negative,
    netSentiment: mentions === 0 ? 0 : (positive - negative) / mentions,
  };
}

describe("buildCampaignInsights", () => {
  it("flags competitor weaknesses we do not share", () => {
    const insights = buildCampaignInsights({
      stores: [
        store({
          retailerId: "own",
          retailerName: "Us",
          isOwnStore: true,
          themes: [theme("delivery", 5, 0)],
        }),
        store({
          retailerId: "c1",
          retailerName: "Rival",
          isOwnStore: false,
          themes: [theme("delivery", 0, 5)],
        }),
      ],
      productGaps: [],
    });
    expect(insights.some((i) => i.type === "competitor_weakness" && i.themeId === "delivery")).toBe(true);
  });

  it("flags our weaknesses and review gaps", () => {
    const gaps: ProductReviewGapDTO[] = [
      {
        productId: "p1",
        productName: "Serum",
        brand: "Acme",
        size: "30ml",
        ownReviewCount: 0,
        ownAverageRating: null,
        competitorReviewCount: 12,
        competitorMedianRating: 4.5,
        ratingGap: null,
        reviewCountGap: -12,
      },
    ];
    const insights = buildCampaignInsights({
      stores: [
        store({
          retailerId: "own",
          retailerName: "Us",
          isOwnStore: true,
          themes: [theme("packaging", 0, 4)],
        }),
      ],
      productGaps: gaps,
    });
    expect(insights.some((i) => i.type === "our_weakness" && i.themeId === "packaging")).toBe(true);
    expect(insights.some((i) => i.type === "review_gap" && i.productIds.includes("p1"))).toBe(true);
  });

  it("suggests price/value when competitors complain about price and we are cheaper", () => {
    const insights = buildCampaignInsights({
      stores: [
        store({ retailerId: "own", retailerName: "Us", isOwnStore: true, themes: [] }),
        store({
          retailerId: "c1",
          retailerName: "Rival",
          isOwnStore: false,
          themes: [theme("price", 0, 4)],
        }),
      ],
      productGaps: [
        {
          productId: "p1",
          productName: "Shampoo",
          brand: "Acme",
          size: null,
          ownReviewCount: 3,
          ownAverageRating: 4.5,
          competitorReviewCount: 3,
          competitorMedianRating: 4,
          ratingGap: 0.5,
          reviewCountGap: 0,
        },
      ],
      priceGapsByProduct: new Map([["p1", -8]]),
    });
    expect(insights.some((i) => i.type === "price_value")).toBe(true);
    const counts = summarizeInsightCounts(insights);
    expect(counts.priceValue).toBeGreaterThan(0);
  });

  it("filters insights by brand when product-linked", () => {
    const insights = buildCampaignInsights({
      stores: [store({ retailerId: "own", retailerName: "Us", isOwnStore: true, themes: [] })],
      productGaps: [
        {
          productId: "p1",
          productName: "Serum",
          brand: "Acme",
          size: null,
          ownReviewCount: 0,
          ownAverageRating: null,
          competitorReviewCount: 5,
          competitorMedianRating: 4,
          ratingGap: null,
          reviewCountGap: -5,
        },
        {
          productId: "p2",
          productName: "Cream",
          brand: "Other",
          size: null,
          ownReviewCount: 0,
          ownAverageRating: null,
          competitorReviewCount: 5,
          competitorMedianRating: 4,
          ratingGap: null,
          reviewCountGap: -5,
        },
      ],
      brandFilter: "Acme",
    });
    const gaps = insights.filter((i) => i.type === "review_gap");
    expect(gaps).toHaveLength(1);
    expect(gaps[0].productNames).toEqual(["Serum"]);
  });
});

function review(partial: Omit<CampaignReviewInput, "sentiment" | "themes"> & { sentiment?: CampaignReviewInput["sentiment"]; themes?: CampaignReviewInput["themes"] }): CampaignReviewInput {
  return {
    ...partial,
    sentiment: partial.sentiment ?? analyzeSentiment({ rating: partial.rating, text: partial.text }),
    themes: partial.themes ?? detectThemes(partial.text),
  };
}

describe("buildBrandCampaign", () => {
  it("uses official-store reviews as quoteable product briefs", () => {
    const result = buildBrandCampaign({
      brand: "Dermaelle",
      products: [
        { id: "spf", name: "SPF Gel", brand: "Dermaelle" },
        { id: "silent", name: "Toner", brand: "Dermaelle" },
      ],
      reviews: [
        review({
          productId: "spf",
          productName: "SPF Gel",
          brand: "Dermaelle",
          retailerId: "off",
          retailerName: "Dermaelle Official",
          isOfficial: true,
          rating: 5,
          text: "حلو جدا و حمايته عاليه ومش بيسيب علامات بيضاء ولا بيعرق بجد تحفه",
        }),
        review({
          productId: "spf",
          productName: "SPF Gel",
          brand: "Dermaelle",
          retailerId: "off",
          retailerName: "Dermaelle Official",
          isOfficial: true,
          rating: 5,
          text: "I loved the dry touch afterwards especially because I have oily skin",
        }),
        review({
          productId: "spf",
          productName: "SPF Gel",
          brand: "Dermaelle",
          retailerId: "pharmacy",
          retailerName: "Al Fouad",
          isOfficial: false,
          rating: 1,
          text: "وصلتوا الاوردر غلط غير اللي طلباه وفضلت اكلمكم محدش رد",
        }),
        review({
          productId: "gel",
          productName: "Other SPF",
          brand: "Bobai",
          retailerId: "noon",
          retailerName: "Noon",
          isOfficial: false,
          rating: 2,
          text: "بيعرق اووي اووي مش فاهمة لية الصراحة",
        }),
      ],
    });

    expect(result.brandReviewCount).toBe(3);
    expect(result.reviewsUsed).toBe(3);
    const spf = result.productAngles.find((a) => a.productId === "spf");
    expect(spf?.praise.some((q) => q.official && q.text.includes("حمايته"))).toBe(true);
    expect(spf?.complaints).toHaveLength(0);
    expect(result.insights.some((i) => i.title.includes("Al Fouad"))).toBe(true);
    expect(result.insights.some((i) => i.type === "competitor_weakness")).toBe(true);
    expect(result.insights.some((i) => i.type === "review_gap" && i.productNames.includes("Toner"))).toBe(true);
  });
});
