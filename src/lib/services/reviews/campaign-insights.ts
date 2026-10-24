import type {
  CampaignInsightDTO,
  CampaignInsightTypeDTO,
  CampaignProductAngleDTO,
  CampaignQuoteDTO,
  ProductReviewGapDTO,
  ReviewThemeIdDTO,
  StoreReviewSummaryDTO,
} from "@/types/dto";
import { REVIEW_THEME_LABELS, type ReviewSentiment, type ReviewThemeId, type ThemeStats } from "./review-analysis";

export interface CampaignInsightsInput {
  stores: StoreReviewSummaryDTO[];
  productGaps: ProductReviewGapDTO[];
  /** Optional: product id → gap % vs market (negative = cheaper). */
  priceGapsByProduct?: Map<string, number | null>;
  brandFilter?: string | null;
}

function themeStatsForStore(store: StoreReviewSummaryDTO, themeId: ReviewThemeId): ThemeStats | null {
  const t = store.themes.find((x) => x.themeId === themeId);
  if (!t) return null;
  return {
    themeId: t.themeId as ReviewThemeId,
    label: t.label,
    mentions: t.mentions,
    positive: t.positive,
    neutral: t.neutral,
    negative: t.negative,
    netSentiment: t.netSentiment,
  };
}

function insightId(type: CampaignInsightTypeDTO, parts: string[]): string {
  return `${type}:${parts.join(":")}`;
}

function storeRefs(stores: { retailerId: string; retailerName: string; domain: string }[]) {
  return {
    retailerIds: stores.map((store) => store.retailerId),
    retailerNames: stores.map((store) => store.retailerName),
    retailerDomains: stores.map((store) => store.domain),
  };
}

function reviewRefs(reviews: CampaignReviewInput[]) {
  const seen = new Map<string, { retailerId: string; retailerName: string; domain: string }>();
  for (const review of reviews) {
    if (!seen.has(review.retailerId)) {
      seen.set(review.retailerId, {
        retailerId: review.retailerId,
        retailerName: review.retailerName,
        domain: review.retailerDomain ?? "",
      });
    }
  }
  return storeRefs([...seen.values()]);
}

function competitorWeaknesses(stores: StoreReviewSummaryDTO[]): CampaignInsightDTO[] {
  const own = stores.find((s) => s.isOwnStore);
  const competitors = stores.filter((s) => !s.isOwnStore);
  if (!own || competitors.length === 0) return [];

  const insights: CampaignInsightDTO[] = [];
  const themeIds = new Set<ReviewThemeId>();
  for (const store of stores) {
    for (const t of store.themes) themeIds.add(t.themeId as ReviewThemeId);
  }

  for (const themeId of themeIds) {
    const ownTheme = themeStatsForStore(own, themeId);
    const weakCompetitors = competitors.filter((c) => {
      const t = themeStatsForStore(c, themeId);
      return t && t.mentions >= 2 && t.negative >= t.positive && t.netSentiment < -0.15;
    });
    if (weakCompetitors.length === 0) continue;
    const ownOk = !ownTheme || ownTheme.netSentiment >= 0 || ownTheme.mentions === 0;
    if (!ownOk) continue;

    const label = REVIEW_THEME_LABELS[themeId];
    insights.push({
      id: insightId("competitor_weakness", [themeId]),
      type: "competitor_weakness",
      title: `Competitors struggle with ${label.toLowerCase()}`,
      evidence: `${weakCompetitors.map((c) => c.retailerName).join(", ")} show negative ${label.toLowerCase()} feedback${
        ownTheme ? `, while your store is ${ownTheme.netSentiment >= 0 ? "neutral/positive" : "mixed"} on it` : ""
      }.`,
      suggestedAction: `Run a conquest campaign highlighting your strength in ${label.toLowerCase()}. Use customer quotes as social proof.`,
      priority: 80 + weakCompetitors.length * 5 + Math.round(Math.abs(ownTheme?.netSentiment ?? 0) * 10),
      themeId: themeId as ReviewThemeIdDTO,
      themeLabel: label,
      ...storeRefs(weakCompetitors),
      productIds: [],
      productNames: [],
      sampleSnippets: [],
    });
  }
  return insights;
}

function ourWeaknesses(stores: StoreReviewSummaryDTO[]): CampaignInsightDTO[] {
  const own = stores.find((s) => s.isOwnStore);
  if (!own) return [];
  return topNegativeThemes(own.themes)
    .filter((t) => t.mentions >= 2 && t.negative > t.positive)
    .slice(0, 5)
    .map((t) => ({
      id: insightId("our_weakness", [t.themeId]),
      type: "our_weakness" as const,
      title: `Fix ${t.label.toLowerCase()} before promoting`,
      evidence: `${t.negative} of ${t.mentions} mentions of ${t.label.toLowerCase()} on your store are negative.`,
      suggestedAction: `Pause campaigns on this angle until operations or product experience improve. Reply to recent complaints and track the theme weekly.`,
      priority: 70 + t.negative * 3,
      themeId: t.themeId as ReviewThemeIdDTO,
      themeLabel: t.label,
      ...storeRefs([own]),
      productIds: [],
      productNames: [],
      sampleSnippets: [],
    }));
}

function topNegativeThemes(themes: StoreReviewSummaryDTO["themes"]) {
  return [...themes]
    .filter((t) => t.negative >= t.positive)
    .sort((a, b) => b.negative - a.negative || a.netSentiment - b.netSentiment);
}

function strengths(stores: StoreReviewSummaryDTO[], productGaps: ProductReviewGapDTO[]): CampaignInsightDTO[] {
  const insights: CampaignInsightDTO[] = [];
  const own = stores.find((s) => s.isOwnStore);
  if (own) {
    for (const t of [...own.themes]
      .filter((x) => x.mentions >= 2 && x.positive > x.negative && x.netSentiment > 0.2)
      .sort((a, b) => b.positive - a.positive)
      .slice(0, 4)) {
      insights.push({
        id: insightId("strength", [t.themeId]),
        type: "strength",
        title: `Amplify praise for ${t.label.toLowerCase()}`,
        evidence: `${t.positive} positive mentions of ${t.label.toLowerCase()} on your store (${t.mentions} total).`,
        suggestedAction: `Turn top reviews into ads, PDP testimonials and email snippets focused on ${t.label.toLowerCase()}.`,
        priority: 55 + t.positive * 2,
        themeId: t.themeId as ReviewThemeIdDTO,
        themeLabel: t.label,
        ...storeRefs([own]),
        productIds: [],
        productNames: [],
        sampleSnippets: [],
      });
    }
  }

  for (const gap of productGaps.filter((g) => (g.ratingGap ?? 0) >= 0.3 && g.ownReviewCount >= 2).slice(0, 5)) {
    insights.push({
      id: insightId("strength", ["rating", gap.productId]),
      type: "strength",
      title: `${gap.productName} outperforms the market on rating`,
      evidence: `Your average rating is ${gap.ownAverageRating ?? "—"} vs competitor median ${gap.competitorMedianRating ?? "—"} (gap ${gap.ratingGap}).`,
      suggestedAction: "Feature this product in a testimonial or comparison campaign.",
      priority: 50 + Math.round((gap.ratingGap ?? 0) * 10),
      themeId: null,
      themeLabel: null,
      retailerIds: [],
      retailerNames: [],
      productIds: [gap.productId],
      productNames: [gap.productName],
      sampleSnippets: [],
    });
  }
  return insights;
}

function reviewGaps(productGaps: ProductReviewGapDTO[]): CampaignInsightDTO[] {
  return productGaps
    .filter(
      (g) =>
        (g.reviewCountGap ?? 0) < -2 ||
        ((g.ratingGap ?? 0) < -0.3 && g.competitorReviewCount >= 2),
    )
    .slice(0, 8)
    .map((g) => ({
      id: insightId("review_gap", [g.productId]),
      type: "review_gap" as const,
      title: `Collect more reviews for ${g.productName}`,
      evidence:
        g.ownReviewCount === 0
          ? `Competitors have ${g.competitorReviewCount} reviews; you have none captured yet.`
          : `You have ${g.ownReviewCount} reviews (avg ${g.ownAverageRating ?? "—"}) vs ${g.competitorReviewCount} competitor reviews (median ${g.competitorMedianRating ?? "—"}).`,
      suggestedAction:
        "Launch a post-purchase review request (SMS/email/WhatsApp) and incentivize verified buyers.",
      priority: 60 + Math.max(0, -(g.reviewCountGap ?? 0)) + Math.max(0, Math.round(-(g.ratingGap ?? 0) * 10)),
      themeId: null,
      themeLabel: null,
      retailerIds: [],
      retailerNames: [],
      productIds: [g.productId],
      productNames: [g.productName],
      sampleSnippets: [],
    }));
}

function priceValueInsights(
  stores: StoreReviewSummaryDTO[],
  productGaps: ProductReviewGapDTO[],
  priceGapsByProduct?: Map<string, number | null>,
): CampaignInsightDTO[] {
  const insights: CampaignInsightDTO[] = [];
  const competitors = stores.filter((s) => !s.isOwnStore);
  const weakOnPrice = competitors.filter((c) => {
    const t = themeStatsForStore(c, "price");
    return t && t.mentions >= 2 && t.negative > t.positive;
  });

  if (weakOnPrice.length > 0) {
    const cheaperProducts = productGaps.filter((g) => {
      const gap = priceGapsByProduct?.get(g.productId);
      return gap != null && gap < -3;
    });
    insights.push({
      id: insightId("price_value", ["market"]),
      type: "price_value",
      title: "Lead with value where competitors feel expensive",
      evidence: `${weakOnPrice.map((c) => c.retailerName).join(", ")} receive negative price/value feedback.${
        cheaperProducts.length
          ? ` ${cheaperProducts.length} of your products are priced below the market median.`
          : ""
      }`,
      suggestedAction:
        "Run a value campaign: compare your price or bundle offer against the market, backed by review quotes about worth/quality.",
      priority: 65 + weakOnPrice.length * 4,
      themeId: "price",
      themeLabel: REVIEW_THEME_LABELS.price,
      ...storeRefs(weakOnPrice),
      productIds: cheaperProducts.slice(0, 5).map((p) => p.productId),
      productNames: cheaperProducts.slice(0, 5).map((p) => p.productName),
      sampleSnippets: [],
    });
  }
  return insights;
}

function matchesBrand(insight: CampaignInsightDTO, productGaps: ProductReviewGapDTO[], brand: string): boolean {
  if (insight.productIds.length === 0) return true;
  const brandLower = brand.toLowerCase();
  return insight.productIds.some((id) => {
    const gap = productGaps.find((g) => g.productId === id);
    return gap?.brand?.toLowerCase() === brandLower;
  });
}

/** Pure rules engine: turns store/product review analysis into ranked campaign insight cards. */
export function buildCampaignInsights(input: CampaignInsightsInput): CampaignInsightDTO[] {
  const { stores, productGaps, priceGapsByProduct, brandFilter } = input;
  let insights = [
    ...competitorWeaknesses(stores),
    ...ourWeaknesses(stores),
    ...strengths(stores, productGaps),
    ...reviewGaps(productGaps),
    ...priceValueInsights(stores, productGaps, priceGapsByProduct),
  ];

  if (brandFilter) {
    insights = insights.filter((i) => matchesBrand(i, productGaps, brandFilter));
  }

  return insights.sort((a, b) => b.priority - a.priority || a.title.localeCompare(b.title));
}

export function summarizeInsightCounts(insights: CampaignInsightDTO[]) {
  const count = (type: CampaignInsightTypeDTO) => insights.filter((i) => i.type === type).length;
  return {
    totalInsights: insights.length,
    competitorWeaknesses: count("competitor_weakness"),
    ourWeaknesses: count("our_weakness"),
    strengths: count("strength"),
    reviewGaps: count("review_gap"),
    priceValue: count("price_value"),
  };
}

/** Delivery and service complaints describe the store, not the formula. */
const STORE_THEMES = new Set<ReviewThemeId>(["delivery", "customer_service"]);
const QUOTE_MIN = 18;

export interface CampaignReviewInput {
  productId: string;
  productName: string;
  brand: string;
  retailerId: string;
  retailerName: string;
  retailerDomain?: string;
  /** Official shop for this product's brand. */
  isOfficial: boolean;
  rating: number | null;
  text: string;
  sentiment: ReviewSentiment;
  themes: ReviewThemeId[];
}

export interface CampaignProductRef {
  id: string;
  name: string;
  brand: string;
}

export interface BrandCampaignResult {
  insights: CampaignInsightDTO[];
  productAngles: CampaignProductAngleDTO[];
  brandReviewCount: number;
  reviewsUsed: number;
}

export function cleanReviewText(text: string): string {
  return text.replace(/\s*read more\s*$/i, "").replace(/\s+/g, " ").trim();
}

export function isUsableCampaignReview(text: string): boolean {
  const clean = cleanReviewText(text);
  if (clean.length < 8) return false;
  return !/^(see full review|read more)$/i.test(clean);
}

function clipQuote(text: string): string {
  const clean = cleanReviewText(text);
  return clean.length > 220 ? `${clean.slice(0, 217)}…` : clean;
}

function toQuote(review: CampaignReviewInput): CampaignQuoteDTO {
  return {
    text: clipQuote(review.text),
    retailerName: review.retailerName,
    retailerDomain: review.retailerDomain,
    rating: review.rating,
    official: review.isOfficial,
  };
}

function isStoreIssue(review: CampaignReviewInput): boolean {
  return review.themes.length > 0 && review.themes.every((theme) => STORE_THEMES.has(theme));
}

function averageRating(reviews: CampaignReviewInput[]): number | null {
  const ratings = reviews.map((r) => r.rating).filter((r): r is number => r != null && Number.isFinite(r));
  if (ratings.length === 0) return null;
  return Math.round((ratings.reduce((sum, n) => sum + n, 0) / ratings.length) * 10) / 10;
}

function productAction(positive: number, negative: number, praise: number): string {
  if (praise === 0 && positive === 0 && negative === 0) {
    return "Ratings are in, but the written reviews are too short to quote. Ask buyers for one sentence about the result.";
  }
  if (negative === 0 && positive > 0) {
    return "Turn these reviews into ads, product-page quotes and WhatsApp replies.";
  }
  if (positive === 0 && negative > 0) {
    return "Hold paid promotion until these complaints are fixed. Reply to the reviewers first.";
  }
  return "Lead the campaign with the praise, and answer the complaints on the product page.";
}

function uniqueProducts(reviews: CampaignReviewInput[], limit = 6): { ids: string[]; names: string[] } {
  const seen = new Set<string>();
  const ids: string[] = [];
  const names: string[] = [];
  for (const review of reviews) {
    if (seen.has(review.productId)) continue;
    seen.add(review.productId);
    ids.push(review.productId);
    names.push(review.productName);
    if (ids.length >= limit) break;
  }
  return { ids, names };
}

function snippetsFrom(reviews: CampaignReviewInput[], limit = 4): string[] {
  return [...reviews]
    .filter((r) => cleanReviewText(r.text).length >= QUOTE_MIN)
    .sort((a, b) => Number(b.isOfficial) - Number(a.isOfficial) || b.text.length - a.text.length)
    .slice(0, limit)
    .map((r) => clipQuote(r.text));
}

/**
 * Builds campaign briefs from individual reviews of a brand, including its official store.
 * Store-only complaints (delivery, service) stay on the store, not on the formula.
 */
export function buildBrandCampaign(input: {
  reviews: CampaignReviewInput[];
  products: CampaignProductRef[];
  brand: string | null;
}): BrandCampaignResult {
  const brandKey = input.brand?.trim().toLowerCase() ?? null;
  const inBrand = (brand: string) => !brandKey || brand.trim().toLowerCase() === brandKey;
  const brandReviews = input.reviews.filter((r) => inBrand(r.brand));
  const otherReviews = input.reviews.filter((r) => !inBrand(r.brand));
  const usable = brandReviews.filter((r) => isUsableCampaignReview(r.text));
  const productReviews = usable.filter((r) => !isStoreIssue(r));
  const storeIssues = usable.filter((r) => isStoreIssue(r) && r.sentiment === "negative");

  const byProduct = new Map<string, CampaignReviewInput[]>();
  for (const review of productReviews) {
    byProduct.set(review.productId, [...(byProduct.get(review.productId) ?? []), review]);
  }

  const productAngles: CampaignProductAngleDTO[] = [...byProduct.entries()].map(([productId, reviews]) => {
    const positive = reviews.filter((r) => r.sentiment === "positive");
    const negative = reviews.filter((r) => r.sentiment === "negative");
    const themeLabels = [
      ...new Set(reviews.flatMap((r) => r.themes.map((theme) => REVIEW_THEME_LABELS[theme]))),
    ];
    const praise = positive
      .filter((r) => cleanReviewText(r.text).length >= QUOTE_MIN)
      .sort((a, b) => Number(b.isOfficial) - Number(a.isOfficial) || b.text.length - a.text.length)
      .slice(0, 3)
      .map(toQuote);
    const complaints = negative
      .filter((r) => cleanReviewText(r.text).length >= QUOTE_MIN)
      .sort((a, b) => b.text.length - a.text.length)
      .slice(0, 3)
      .map(toQuote);
    return {
      productId,
      productName: reviews[0]?.productName ?? productId,
      brand: reviews[0]?.brand ?? "",
      reviewCount: reviews.length,
      averageRating: averageRating(reviews),
      positive: positive.length,
      negative: negative.length,
      themeLabels,
      praise,
      complaints,
      action: productAction(positive.length, negative.length, praise.length),
    };
  });
  productAngles.sort(
    (a, b) =>
      Number(b.praise.length > 0) - Number(a.praise.length > 0) ||
      b.reviewCount - a.reviewCount ||
      b.negative - a.negative ||
      a.productName.localeCompare(b.productName),
  );

  const insights: CampaignInsightDTO[] = [];
  const brandsInView = [...new Set(productReviews.map((r) => r.brand))];
  for (const brand of brandsInView) {
    const rows = productReviews.filter((r) => r.brand === brand);
    const prefix = brandKey ? "" : `${brand}: `;
    const themeIds = [...new Set(rows.flatMap((r) => r.themes))];
    for (const themeId of themeIds) {
      const themed = rows.filter((r) => r.themes.includes(themeId));
      const positive = themed.filter((r) => r.sentiment === "positive").length;
      const negative = themed.filter((r) => r.sentiment === "negative").length;
      const label = REVIEW_THEME_LABELS[themeId];
      if (positive >= 2 && positive > negative) {
        insights.push({
          id: insightId("strength", [brand, themeId]),
          type: "strength",
          title: `${prefix}Amplify praise for ${label.toLowerCase()}`,
          evidence: `${positive} of ${themed.length} ${brand} reviews that mention ${label.toLowerCase()} are positive, including the official store when shoppers wrote there.`,
          suggestedAction: `Use these ${label.toLowerCase()} quotes in ads, on the product page and in WhatsApp replies.`,
          priority: 60 + positive * 3,
          themeId,
          themeLabel: label,
          ...reviewRefs(themed),
          productIds: uniqueProducts(themed).ids,
          productNames: uniqueProducts(themed).names,
          sampleSnippets: snippetsFrom(themed.filter((r) => r.sentiment === "positive")),
          reviewCount: themed.length,
        });
      } else if (negative >= 1 && negative >= positive) {
        insights.push({
          id: insightId("our_weakness", [brand, themeId]),
          type: "our_weakness",
          title: `${prefix}Fix ${label.toLowerCase()} before you promote it`,
          evidence: `${negative} of ${themed.length} ${brand} reviews that mention ${label.toLowerCase()} are negative.`,
          suggestedAction: `Do not build a campaign on ${label.toLowerCase()} until the product or the reply handles this complaint.`,
          priority: 72 + negative * 4,
          themeId,
          themeLabel: label,
          ...reviewRefs(themed),
          productIds: uniqueProducts(themed).ids,
          productNames: uniqueProducts(themed).names,
          sampleSnippets: snippetsFrom(themed.filter((r) => r.sentiment === "negative")),
          reviewCount: themed.length,
        });
      }
    }
  }

  if (brandKey) {
    const brandName = brandReviews[0]?.brand ?? input.brand ?? "";
    for (const themeId of Object.keys(REVIEW_THEME_LABELS) as ReviewThemeId[]) {
      const ours = productReviews.filter((r) => r.themes.includes(themeId));
      const oursPositive = ours.filter((r) => r.sentiment === "positive").length;
      const theirs = otherReviews.filter(
        (r) => isUsableCampaignReview(r.text) && !isStoreIssue(r) && r.themes.includes(themeId),
      );
      const theirsNegative = theirs.filter((r) => r.sentiment === "negative");
      if (oursPositive < 1 || theirsNegative.length < 1) continue;
      const label = REVIEW_THEME_LABELS[themeId];
      insights.push({
        id: insightId("competitor_weakness", [brandName, themeId]),
        type: "competitor_weakness",
        title: `Shoppers praise ${brandName} on ${label.toLowerCase()} where other brands are criticized`,
        evidence: `${oursPositive} positive ${brandName} ${oursPositive === 1 ? "review mentions" : "reviews mention"} ${label.toLowerCase()}. ${theirsNegative.length} ${theirsNegative.length === 1 ? "review of another brand complains" : "reviews of other brands complain"} about it.`,
        suggestedAction: `Run a comparison using ${brandName}'s own words on ${label.toLowerCase()}. Do not invent a claim the reviews do not make.`,
        priority: 78 + theirsNegative.length * 3,
        themeId,
        themeLabel: label,
        ...reviewRefs(theirsNegative),
        productIds: uniqueProducts(ours, 4).ids,
        productNames: uniqueProducts(ours, 4).names,
        sampleSnippets: snippetsFrom(ours.filter((r) => r.sentiment === "positive")),
        reviewCount: ours.length + theirsNegative.length,
      });
    }
  }

  const issuesByStore = new Map<string, CampaignReviewInput[]>();
  for (const review of storeIssues) {
    const key = `${review.brand}:${review.retailerId}`;
    issuesByStore.set(key, [...(issuesByStore.get(key) ?? []), review]);
  }
  for (const [, rows] of issuesByStore) {
    const retailerId = rows[0]?.retailerId ?? "";
    const name = rows[0]?.retailerName ?? retailerId;
    const official = rows.every((r) => r.isOfficial);
    insights.push({
      id: insightId("our_weakness", ["store", rows[0]?.brand ?? "", retailerId]),
      type: "our_weakness",
      title: official ? `${name} is getting service complaints` : `Do not send buyers to ${name} until service complaints stop`,
      evidence: `${rows.length === 1 ? "1 review complains" : `${rows.length} reviews complain`} about delivery or service at ${name}, not about the formula.`,
      suggestedAction: official
        ? "Fix the order and reply path before a campaign drives more people to this store."
        : "Keep campaign traffic on stores whose reviews talk about the product, not a missed delivery.",
      priority: 68 + rows.length * 5,
      themeId: rows[0]?.themes[0] ?? "delivery",
      themeLabel: rows[0] ? REVIEW_THEME_LABELS[rows[0].themes[0]!] : null,
      ...storeRefs([{ retailerId, retailerName: name, domain: rows[0]?.retailerDomain ?? "" }]),
      productIds: [...new Set(rows.map((r) => r.productId))],
      productNames: [...new Set(rows.map((r) => r.productName))],
      sampleSnippets: snippetsFrom(rows),
      reviewCount: rows.length,
    });
  }

  const reviewedIds = new Set(usable.map((r) => r.productId));
  const missing = input.products.filter((p) => inBrand(p.brand) && !reviewedIds.has(p.id)).slice(0, 8);
  if (missing.length > 0) {
    insights.push({
      id: insightId("review_gap", [brandKey ?? "all"]),
      type: "review_gap",
      title: `${missing.length} product${missing.length === 1 ? "" : "s"} still have no customer words`,
      evidence: "These products have no usable review yet, so a campaign would have nothing to quote.",
      suggestedAction: "Ask recent buyers for a short review before you feature the product in ads.",
      priority: 40 + missing.length,
      themeId: null,
      themeLabel: null,
      retailerIds: [],
      retailerNames: [],
      productIds: missing.map((p) => p.id),
      productNames: missing.map((p) => p.name),
      sampleSnippets: [],
      reviewCount: 0,
    });
  }

  const usedIds = new Set<string>();
  for (const review of productReviews) usedIds.add(`${review.productId}:${review.retailerId}:${review.text}`);
  for (const review of storeIssues) usedIds.add(`${review.productId}:${review.retailerId}:${review.text}`);

  return {
    insights: insights.sort((a, b) => b.priority - a.priority || a.title.localeCompare(b.title)),
    productAngles,
    brandReviewCount: brandReviews.length,
    reviewsUsed: usedIds.size,
  };
}
