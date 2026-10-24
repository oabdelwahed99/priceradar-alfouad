import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import { toIso } from "@/lib/services/mappers";
import type { ReviewsOverviewQuery } from "@/lib/validation/reviews.schema";
import {
  Product,
  ProductReview,
  ProductSource,
  Retailer,
  type ProductReviewDoc,
  type RetailerDoc,
} from "@/models";
import type {
  ProductReviewGapDTO,
  ReviewListItemDTO,
  ReviewThemeIdDTO,
  ReviewsOverviewDTO,
  StoreReviewSummaryDTO,
} from "@/types/dto";
import {
  analyzeSentiment,
  detectThemes,
  median,
  summarizeReviews,
  topComplainedThemes,
  topPraisedThemes,
  type AnalyzableReview,
} from "./review-analysis";

type LeanProduct = { _id: Types.ObjectId; name: string; brand: string | null; size: string | null };
type LeanReview = ProductReviewDoc & { _id: Types.ObjectId };

function toListItem(
  review: LeanReview,
  product: LeanProduct | undefined,
  retailer: Pick<RetailerDoc, "_id" | "name" | "domain" | "isOwnStore"> | undefined,
): ReviewListItemDTO {
  const analyzable: AnalyzableReview = { rating: review.rating ?? null, text: review.text };
  return {
    id: String(review._id),
    productId: String(review.productId),
    productName: product?.name ?? "Unknown product",
    brand: product?.brand ?? null,
    retailerId: String(review.retailerId),
    retailerName: retailer?.name ?? "Unknown store",
    retailerDomain: retailer?.domain ?? "",
    isOwnStore: Boolean(retailer?.isOwnStore),
    author: review.author ?? null,
    rating: review.rating ?? null,
    text: review.text,
    language: review.language ?? null,
    sentiment: analyzeSentiment(analyzable),
    themes: detectThemes(review.text) as ReviewThemeIdDTO[],
    publishedAt: toIso(review.publishedAt),
    firstSeenAt: toIso(review.firstSeenAt) ?? new Date(0).toISOString(),
  };
}

function storeSummary(
  retailer: Pick<RetailerDoc, "_id" | "name" | "domain" | "isOwnStore" | "isBrandStore">,
  reviews: AnalyzableReview[],
): StoreReviewSummaryDTO {
  const summary = summarizeReviews(reviews);
  return {
    retailerId: String(retailer._id),
    retailerName: retailer.name,
    domain: retailer.domain,
    isOwnStore: Boolean(retailer.isOwnStore),
    isBrandStore: Boolean(retailer.isBrandStore),
    reviewCount: summary.total,
    averageRating: summary.averageRating,
    sentiment: summary.sentiment,
    positivePercentage: summary.positivePercentage,
    negativePercentage: summary.negativePercentage,
    topPraised: topPraisedThemes(summary.themes).map((t) => ({
      themeId: t.themeId as ReviewThemeIdDTO,
      label: t.label,
      mentions: t.mentions,
      positive: t.positive,
      neutral: t.neutral,
      negative: t.negative,
      netSentiment: t.netSentiment,
    })),
    topComplained: topComplainedThemes(summary.themes).map((t) => ({
      themeId: t.themeId as ReviewThemeIdDTO,
      label: t.label,
      mentions: t.mentions,
      positive: t.positive,
      neutral: t.neutral,
      negative: t.negative,
      netSentiment: t.netSentiment,
    })),
    themes: summary.themes.map((t) => ({
      themeId: t.themeId as ReviewThemeIdDTO,
      label: t.label,
      mentions: t.mentions,
      positive: t.positive,
      neutral: t.neutral,
      negative: t.negative,
      netSentiment: t.netSentiment,
    })),
  };
}

function productGaps(
  products: LeanProduct[],
  reviews: LeanReview[],
  retailerById: Map<string, Pick<RetailerDoc, "_id" | "isOwnStore">>,
): ProductReviewGapDTO[] {
  const byProduct = new Map<string, LeanReview[]>();
  for (const review of reviews) {
    const key = String(review.productId);
    const list = byProduct.get(key) ?? [];
    list.push(review);
    byProduct.set(key, list);
  }

  const gaps: ProductReviewGapDTO[] = [];
  for (const product of products) {
    const productReviews = byProduct.get(String(product._id)) ?? [];
    if (productReviews.length === 0) continue;

    const own: AnalyzableReview[] = [];
    const competitor: AnalyzableReview[] = [];
    for (const review of productReviews) {
      const retailer = retailerById.get(String(review.retailerId));
      const item = { rating: review.rating ?? null, text: review.text };
      if (retailer?.isOwnStore) own.push(item);
      else competitor.push(item);
    }

    const ownSummary = summarizeReviews(own);
    const competitorRatings = competitor
      .map((r) => r.rating)
      .filter((r): r is number => r != null && Number.isFinite(r));
    const competitorMedianRating = median(competitorRatings);
    const ratingGap =
      ownSummary.averageRating != null && competitorMedianRating != null
        ? Math.round((ownSummary.averageRating - competitorMedianRating) * 10) / 10
        : null;

    gaps.push({
      productId: String(product._id),
      productName: product.name,
      brand: product.brand ?? null,
      size: product.size ?? null,
      ownReviewCount: own.length,
      ownAverageRating: ownSummary.averageRating,
      competitorReviewCount: competitor.length,
      competitorMedianRating:
        competitorMedianRating != null ? Math.round(competitorMedianRating * 10) / 10 : null,
      ratingGap,
      reviewCountGap: own.length - competitor.length,
    });
  }

  return gaps
    .sort(
      (a, b) =>
        (a.ratingGap ?? 0) - (b.ratingGap ?? 0) ||
        (a.reviewCountGap ?? 0) - (b.reviewCountGap ?? 0) ||
        a.productName.localeCompare(b.productName),
    )
    .slice(0, 40);
}

/** Workspace-level customer-review overview across stores. */
export async function getReviewOverview(
  workspaceId: string,
  query: ReviewsOverviewQuery,
): Promise<ReviewsOverviewDTO> {
  await connectToDatabase();

  const [allReviews, retailers, products, sources] = await Promise.all([
    ProductReview.find({ workspaceId }).lean<LeanReview[]>(),
    Retailer.find({ workspaceId }).lean<RetailerDoc[]>(),
    Product.find({ workspaceId })
      .select({ name: 1, brand: 1, size: 1 })
      .lean<LeanProduct[]>(),
    ProductSource.find({ workspaceId }).select({ productId: 1 }).lean<{ productId: Types.ObjectId }[]>(),
  ]);

  const retailerById = new Map(retailers.map((r) => [String(r._id), r]));
  const productById = new Map(products.map((p) => [String(p._id), p]));

  const q = query.q?.toLowerCase();
  let filtered = allReviews;

  if (query.retailerId) {
    filtered = filtered.filter((r) => String(r.retailerId) === query.retailerId);
  }
  if (query.sentiment) {
    filtered = filtered.filter(
      (r) => analyzeSentiment({ rating: r.rating ?? null, text: r.text }) === query.sentiment,
    );
  }
  if (query.theme) {
    filtered = filtered.filter((r) => detectThemes(r.text).includes(query.theme!));
  }
  if (q) {
    filtered = filtered.filter((r) => {
      const product = productById.get(String(r.productId));
      const retailer = retailerById.get(String(r.retailerId));
      const haystack = [r.text, r.author, product?.name, product?.brand, retailer?.name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }

  const overall = summarizeReviews(
    allReviews.map((r) => ({ rating: r.rating ?? null, text: r.text })),
  );

  const stores = retailers
    .map((retailer) => {
      const storeReviews = allReviews
        .filter((r) => String(r.retailerId) === String(retailer._id))
        .map((r) => ({ rating: r.rating ?? null, text: r.text }));
      return storeSummary(retailer, storeReviews);
    })
    .filter((s) => s.reviewCount > 0)
    .sort((a, b) => b.reviewCount - a.reviewCount || a.retailerName.localeCompare(b.retailerName));

  const pageSize = query.pageSize;
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(query.page, totalPages);
  const start = (page - 1) * pageSize;

  const sortedFiltered = [...filtered].sort((a, b) => {
    const aTime = new Date(a.publishedAt ?? a.firstSeenAt).getTime();
    const bTime = new Date(b.publishedAt ?? b.firstSeenAt).getTime();
    return bTime - aTime;
  });

  const pageItems = sortedFiltered
    .slice(start, start + pageSize)
    .map((r) => toListItem(r, productById.get(String(r.productId)), retailerById.get(String(r.retailerId))));

  const recentNegative = allReviews
    .filter((r) => analyzeSentiment({ rating: r.rating ?? null, text: r.text }) === "negative")
    .sort((a, b) => {
      const aTime = new Date(a.publishedAt ?? a.firstSeenAt).getTime();
      const bTime = new Date(b.publishedAt ?? b.firstSeenAt).getTime();
      return bTime - aTime;
    })
    .slice(0, 8)
    .map((r) => toListItem(r, productById.get(String(r.productId)), retailerById.get(String(r.retailerId))));

  const productIds = [...new Set(sources.map((s) => String(s.productId)))];

  return {
    summary: {
      totalReviews: overall.total,
      averageRating: overall.averageRating,
      positivePercentage: overall.positivePercentage,
      negativePercentage: overall.negativePercentage,
      storesCovered: stores.length,
      productsCovered: new Set(allReviews.map((r) => String(r.productId))).size,
    },
    stores,
    themes: overall.themes.map((t) => ({
      themeId: t.themeId as ReviewThemeIdDTO,
      label: t.label,
      mentions: t.mentions,
      positive: t.positive,
      neutral: t.neutral,
      negative: t.negative,
      netSentiment: t.netSentiment,
    })),
    productGaps: productGaps(products, allReviews, retailerById),
    positiveKeywords: overall.positiveKeywords,
    negativeKeywords: overall.negativeKeywords,
    recentNegative,
    reviews: {
      items: pageItems,
      total,
      page,
      pageSize,
      totalPages,
    },
    retailers: retailers
      .map((r) => ({ id: String(r._id), name: r.name, isOwnStore: Boolean(r.isOwnStore) }))
      .sort((a, b) => Number(b.isOwnStore) - Number(a.isOwnStore) || a.name.localeCompare(b.name)),
    productIds,
  };
}
