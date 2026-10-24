import { connectToDatabase } from "@/lib/db/mongoose";
import type { CampaignsQuery } from "@/lib/validation/reviews.schema";
import { Brand, Product, ProductReview, Retailer, type BrandDoc, type RetailerDoc } from "@/models";
import type { CampaignsOverviewDTO } from "@/types/dto";
import {
  buildBrandCampaign,
  summarizeInsightCounts,
  type CampaignProductRef,
  type CampaignReviewInput,
} from "./campaign-insights";
import { analyzeSentiment, detectThemes } from "./review-analysis";

function canonicalBrand(raw: string | null | undefined, docs: BrandDoc[], productBrands: string[]): string | null {
  if (!raw?.trim()) return null;
  const key = raw.trim().toLowerCase();
  const doc = docs.find((b) => b.name.trim().toLowerCase() === key || b.slug === key);
  if (doc) return doc.name;
  return productBrands.find((b) => b.toLowerCase() === key) ?? raw.trim();
}

export async function getCampaignsOverview(
  workspaceId: string,
  query: CampaignsQuery = {},
): Promise<CampaignsOverviewDTO> {
  await connectToDatabase();

  const [reviewDocs, products, retailers, brandDocs] = await Promise.all([
    ProductReview.find({ workspaceId }).select({ productId: 1, retailerId: 1, text: 1, rating: 1 }).lean<
      { productId: { toString(): string }; retailerId: { toString(): string }; text: string; rating: number | null }[]
    >(),
    Product.find({ workspaceId, isDemo: { $ne: true } })
      .select({ name: 1, brand: 1 })
      .lean<{ _id: { toString(): string }; name: string; brand: string | null }[]>(),
    Retailer.find({ workspaceId }).lean<RetailerDoc[]>(),
    Brand.find({ workspaceId }).lean<BrandDoc[]>(),
  ]);

  const productById = new Map(products.map((p) => [String(p._id), p]));
  const retailerById = new Map(retailers.map((r) => [String(r._id), r]));
  const productBrands = [...new Set(products.map((p) => p.brand).filter((b): b is string => Boolean(b?.trim())))].sort(
    (a, b) => a.localeCompare(b),
  );

  const focus = brandDocs.find((b) => b.isFocus);
  const focusName = focus ? canonicalBrand(focus.name, brandDocs, productBrands) : null;
  let selected: string | null;
  if (query.brand === "all") selected = null;
  else if (query.brand) selected = canonicalBrand(query.brand, brandDocs, productBrands);
  else selected = focusName && productBrands.includes(focusName) ? focusName : null;

  const reviews: CampaignReviewInput[] = [];
  for (const review of reviewDocs) {
    const product = productById.get(String(review.productId));
    const retailer = retailerById.get(String(review.retailerId));
    if (!product?.brand?.trim() || !retailer) continue;
    const brand = canonicalBrand(product.brand, brandDocs, productBrands) ?? product.brand.trim();
    const brandDoc = brandDocs.find((b) => b.name === brand);
    const isOfficial = Boolean(
      retailer.isBrandStore &&
        brandDoc &&
        (retailer.domain === brandDoc.officialDomain || retailer.name.toLowerCase().includes(brand.toLowerCase())),
    );
    reviews.push({
      productId: String(review.productId),
      productName: product.name,
      brand,
      retailerId: String(review.retailerId),
      retailerName: retailer.name,
      isOfficial,
      rating: review.rating ?? null,
      text: review.text,
      sentiment: analyzeSentiment({ rating: review.rating ?? null, text: review.text }),
      themes: detectThemes(review.text),
    });
  }

  const catalog: CampaignProductRef[] = products
    .filter((p) => p.brand?.trim())
    .map((p) => ({
      id: String(p._id),
      name: p.name,
      brand: canonicalBrand(p.brand, brandDocs, productBrands) ?? p.brand!.trim(),
    }));

  const scopedReviews = query.retailerId ? reviews.filter((r) => r.retailerId === query.retailerId) : reviews;
  let built = buildBrandCampaign({ reviews: scopedReviews, products: catalog, brand: selected });
  if (query.type) {
    built = { ...built, insights: built.insights.filter((i) => i.type === query.type) };
  }

  const retailerIds = new Set(
    reviews.filter((r) => !selected || r.brand === selected).map((r) => r.retailerId),
  );

  return {
    summary: {
      ...summarizeInsightCounts(built.insights),
      brandReviewCount: built.brandReviewCount,
      reviewsUsed: built.reviewsUsed,
    },
    insights: built.insights,
    productAngles: built.productAngles,
    brands: productBrands,
    retailers: retailers
      .filter((r) => retailerIds.has(String(r._id)))
      .map((r) => ({
        id: String(r._id),
        name: r.name,
        isOwnStore: Boolean(r.isOwnStore || r.isBrandStore),
      }))
      .sort((a, b) => Number(b.isOwnStore) - Number(a.isOwnStore) || a.name.localeCompare(b.name)),
    selectedBrand: selected,
  };
}
