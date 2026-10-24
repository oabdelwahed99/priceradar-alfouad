import type {
  AlertStatus,
  AlertType,
  AnalysisSnapshot,
  Availability,
  PricePosition,
  ScrapeErrorCode,
  ScrapingStatus,
} from "./index";

/** Serializable shapes passed to the client and returned by the API. Dates are ISO strings. */

export type AnalysisSnapshotDTO = Omit<AnalysisSnapshot, "computedAt"> & { computedAt: string };

export interface ProductListItemDTO {
  id: string;
  name: string;
  brand: string | null;
  size: string | null;
  currency: string | null;
  lastCheckedAt: string | null;
  analysis: AnalysisSnapshotDTO | null;
  sourceCount: number;
  isDemo: boolean;
}

export interface RetailerDTO {
  id: string;
  name: string;
  domain: string;
  isOwnStore: boolean;
  isBrandStore: boolean;
  createdAt: string;
}

export interface RetailerWithStatsDTO extends RetailerDTO {
  productsMonitored: number;
  lastScrapedAt: string | null;
  status: "healthy" | "degraded" | "failing" | "idle";
  failedSources: number;
}

export interface LatestObservationDTO {
  price: number;
  originalPrice: number | null;
  currency: string | null;
  availability: Availability;
  scrapedAt: string;
}

export interface ProductSourceDTO {
  id: string;
  url: string;
  isOwnStore: boolean;
  retailer: RetailerDTO;
  scrapingStatus: ScrapingStatus;
  lastScrapedAt: string | null;
  lastError: string | null;
  lastErrorCode: ScrapeErrorCode | null;
  latest: LatestObservationDTO | null;
}

export interface ProductDetailDTO {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  size: string | null;
  currency: string | null;
  imageUrl: string | null;
  lastCheckedAt: string | null;
  createdAt: string;
  analysis: AnalysisSnapshotDTO | null;
  sources: ProductSourceDTO[];
  isDemo: boolean;
}

export interface CompetitorComparisonRowDTO {
  sourceId: string;
  retailerName: string;
  url: string;
  isOwnStore: boolean;
  /** Reference store is a brand's official shop (show "Official store" instead of "My Store"). */
  isBrandStore: boolean;
  price: number | null;
  currency: string | null;
  differencePercentage: number | null;
  availability: Availability | null;
  lastCheckedAt: string | null;
  scrapingStatus: ScrapingStatus;
  error: string | null;
  errorCode: ScrapeErrorCode | null;
  /** Why this price is not part of market statistics, if excluded. */
  exclusion: string | null;
  note: string | null;
}

export interface ProductAnalysisDTO {
  status: "OK" | "INSUFFICIENT_DATA";
  reason: "NO_OWN_PRICE" | "NO_COMPETITOR_PRICES" | null;
  currency: string | null;
  ownPrice: number | null;
  marketMinimum: number | null;
  marketMaximum: number | null;
  marketAverage: number | null;
  marketMedian: number | null;
  ownPriceVsAverage: number | null;
  ownPriceVsMedian: number | null;
  ownPriceVsMinimum: number | null;
  ownPriceVsMaximum: number | null;
  gapPercentage: number | null;
  position: PricePosition | null;
  cheaperCompetitors: number;
  moreExpensiveCompetitors: number;
  equalCompetitors: number;
  competitorCount: number;
  includedCompetitorCount: number;
  suggestedPrice: number | null;
  suggestion: {
    basis: "MARKET_MEDIAN" | "CURRENT_PRICE";
    multiplier: number | null;
    changeAmount: number;
    changePercentage: number;
    explanation: string;
    disclaimer: string;
  } | null;
}

export interface ComparisonRunResultDTO {
  productId: string;
  scraped: number;
  succeeded: number;
  failed: number;
  alertsCreated: number;
  results: {
    sourceId: string;
    retailerName: string;
    isOwnStore: boolean;
    success: boolean;
    price: number | null;
    currency: string | null;
    error: string | null;
    errorCode: ScrapeErrorCode | null;
  }[];
}

export interface ContentCaptureResultDTO {
  productId: string;
  scraped: number;
  captured: number;
  failed: number;
  /** Pages whose copy changed since the previous capture. */
  changed: number;
  alertsCreated: number;
  results: {
    sourceId: string;
    retailerName: string;
    isOwnStore: boolean;
    success: boolean;
    error: string | null;
  }[];
}

export interface HistoryPointDTO {
  sourceId: string;
  retailerName: string;
  isOwnStore: boolean;
  price: number;
  scrapedAt: string;
}

export interface HistorySeriesDTO {
  sourceId: string;
  retailerName: string;
  isOwnStore: boolean;
  points: { scrapedAt: string; price: number }[];
}

export interface AlertDTO {
  id: string;
  type: AlertType;
  status: AlertStatus;
  title: string;
  message: string;
  productId: string;
  productName: string | null;
  retailerName: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface DashboardStatsDTO {
  totalProducts: number;
  totalCompetitors: number;
  productsCompared: number;
  /** UNDERPRICED + SLIGHTLY_UNDERPRICED */
  underpriced: number;
  /** OVERPRICED + SLIGHTLY_OVERPRICED */
  overpriced: number;
  marketAligned: number;
  positionCounts: Record<PricePosition, number>;
  newAlerts: number;
  /** Products outside the market-aligned band, largest absolute gap first. */
  attention: ProductListItemDTO[];
  recentAlerts: AlertDTO[];
}

/**
 * current: latest check succeeded. out_of_stock: latest check found it unavailable.
 * stale: latest check failed, price is from an earlier check. failed: never priced, last check failed.
 * pending: never checked.
 */
export type PriceMatrixCellState = "current" | "out_of_stock" | "stale" | "failed" | "pending";

export interface PriceMatrixCellDTO {
  sourceId: string;
  url: string;
  state: PriceMatrixCellState;
  price: number | null;
  currency: string | null;
  /** Competitor price vs your price, in %. Negative: the competitor is cheaper. */
  differencePercentage: number | null;
  /** Lowest in-stock price for the product, your store included. */
  isLowest: boolean;
  /** Price was entered by hand (e.g. spreadsheet import) rather than scraped. */
  isManual: boolean;
  observedAt: string | null;
  error: string | null;
}

export interface PriceMatrixColumnDTO {
  retailerId: string;
  name: string;
  domain: string;
  isOwnStore: boolean;
  isBrandStore: boolean;
  productCount: number;
}

export interface BrandListItemDTO {
  id: string;
  name: string;
  slug: string;
  officialDomain: string;
  isFocus: boolean;
  productCount: number;
  storeCount: number;
  /** Listings priced below the official price. */
  belowOfficial: number;
  /** Listings priced above the official price. */
  aboveOfficial: number;
  outOfStock: number;
}

export interface BrandStoreComplianceDTO {
  retailerId: string;
  name: string;
  domain: string;
  isBrandStore: boolean;
  listings: number;
  belowOfficial: number;
  aboveOfficial: number;
  outOfStock: number;
  /** Mean gap vs official price across in-stock priced listings, in %. */
  averageGapPercentage: number | null;
}

export interface BrandDetailDTO {
  id: string;
  name: string;
  slug: string;
  officialDomain: string;
  isFocus: boolean;
  productCount: number;
  storeCompliance: BrandStoreComplianceDTO[];
}

export interface PriceMatrixRowDTO {
  productId: string;
  name: string;
  brand: string | null;
  size: string | null;
  currency: string | null;
  isDemo: boolean;
  analysis: AnalysisSnapshotDTO | null;
  /** Keyed by retailerId; a missing key means the product is not tracked at that store. */
  cells: Record<string, PriceMatrixCellDTO>;
}

export interface PriceMatrixDTO {
  columns: PriceMatrixColumnDTO[];
  rows: PriceMatrixRowDTO[];
  /** Distinct product categories in the workspace (for the matrix filter). */
  categories: string[];
  demoProductCount: number;
  /** More products matched than the matrix shows. */
  truncated: boolean;
}

export interface ContentMetricsDTO {
  descriptionWords: number;
  titleLength: number;
  metaDescriptionLength: number;
  h1Count: number;
  h2Count: number;
  bulletCount: number;
  faqCount: number;
  /** Share of images with alt text, in %. Null when the page has no images. */
  imageAltCoverage: number | null;
  hasRating: boolean;
}

export interface ContentPageDTO {
  sourceId: string;
  retailerName: string;
  url: string;
  isOwnStore: boolean;
  /** False until a successful check has captured the page's content. */
  captured: boolean;
  title: string | null;
  metaDescription: string | null;
  description: string | null;
  headings: { h1: string[]; h2: string[]; h3: string[] };
  bulletPoints: string[];
  faqQuestions: string[];
  rating: { value: number | null; count: number | null } | null;
  language: string | null;
  metrics: ContentMetricsDTO | null;
  /** Vocabulary overlap between this description and yours, in %. */
  similarityToOwn: number | null;
  /** When the current version of the content was first seen. */
  contentSince: string | null;
  lastSeenAt: string | null;
  /** Distinct versions captured; above 1 means the page copy has changed. */
  versionCount: number;
}

export type ContentCheckStatus = "pass" | "warn" | "fail" | "info";

export interface ContentCheckDTO {
  id: string;
  label: string;
  status: ContentCheckStatus;
  message: string;
}

export interface KeywordTermDTO {
  term: string;
  isPhrase: boolean;
  competitorCount: number;
  competitorOccurrences: number;
  ownOccurrences: number;
}

export interface ContentAttributeDTO {
  id: string;
  label: string;
  /** Null when your page has not been captured. */
  own: boolean | null;
  competitorsWith: string[];
}

export interface ProductContentAnalysisDTO {
  status: "OK" | "NO_CONTENT";
  ownPageCaptured: boolean;
  competitorCount: number;
  competitorPagesCaptured: number;
  /** Share of applicable checks passed, 0–100. Null when your page has not been captured. */
  score: number | null;
  checks: ContentCheckDTO[];
  benchmark: {
    own: ContentMetricsDTO | null;
    competitorMedian: {
      descriptionWords: number | null;
      h2Count: number | null;
      bulletCount: number | null;
      faqCount: number | null;
    };
  };
  keywords: {
    minCompetitors: number;
    competitorPagesAnalyzed: number;
    missing: KeywordTermDTO[];
    shared: KeywordTermDTO[];
    uniqueToYou: { term: string; ownOccurrences: number }[];
  };
  attributes: ContentAttributeDTO[];
  pages: ContentPageDTO[];
}

export interface ContentOverviewRowDTO {
  productId: string;
  name: string;
  brand: string | null;
  size: string | null;
  score: number | null;
  ownPageCaptured: boolean;
  competitorCount: number;
  competitorPagesCaptured: number;
  failedChecks: number;
  warningChecks: number;
  /** Labels of failed checks first, then warnings. */
  issueLabels: string[];
  missingKeywordCount: number;
  topMissingKeywords: string[];
  /** Product facts most competitors mention that your page doesn't. */
  missingFacts: string[];
  descriptionWords: number | null;
  competitorMedianWords: number | null;
  /** Most recent competitor rewrite of this product's page. */
  lastCompetitorChange: { retailerName: string; at: string } | null;
}

export interface ContentOverviewDTO extends PaginatedDTO<ContentOverviewRowDTO> {
  summary: {
    productsAnalyzed: number;
    averageScore: number | null;
    needsWork: number;
    notCaptured: number;
    competitorChanges30d: number;
  };
  /** Every product matching the search and score filter, across all pages (for bulk actions). */
  productIds: string[];
  /** More products matched than could be analyzed. */
  truncated: boolean;
}

/** AI-generated SEO copy informed by the Content & SEO analysis. */
export interface SeoContentDraftDTO {
  title: string;
  metaDescription: string;
  h1: string;
  description: string;
  headings: string[];
  bulletPoints: string[];
  faq: { question: string; answer: string }[];
  /** Competitor-mentioned facts the model could not verify from our page. */
  unverifiedFacts: string[];
}

export interface SeoContentDraftResultDTO {
  prompt: string;
  draft: SeoContentDraftDTO;
}

export interface PaginatedDTO<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** ready: can act now. confirm_supply: official store is also out of stock. supply_gap: nobody we track has it. */
export type OpportunityTone = "ready" | "confirm_supply" | "supply_gap";

export interface SalesOpportunityDTO {
  productId: string;
  productName: string;
  brand: string;
  size: string | null;
  category: string | null;
  retailerId: string;
  retailerName: string;
  retailerDomain: string;
  url: string | null;
  price: number | null;
  currency: string | null;
  observedAt: string | null;
  /** Stores where this product is currently in stock. Excludes an out-of-stock shelf. */
  inStockStores: number;
  /** How many products of this brand the store already lists. */
  storeBrandListings: number;
  brandCatalogSize: number;
  officialOutOfStock: boolean;
  tone: OpportunityTone;
  action: string;
  detail: string;
}

export interface StoreOpportunityBriefDTO {
  retailerId: string;
  name: string;
  domain: string;
  brand: string;
  catalogSize: number;
  listed: number;
  inStock: number;
  outOfStock: number;
  missing: number;
  /** Missing products that are in stock somewhere, so they can be pitched. */
  pitchCount: number;
  coveragePercentage: number;
  restocks: SalesOpportunityDTO[];
  pitches: SalesOpportunityDTO[];
}

export interface CoveredStoreDTO {
  retailerId: string;
  name: string;
  domain: string;
  brand: string;
  catalogSize: number;
}

/** In stock on the official store, and not listed at any partner. */
export interface UnopenedProductDTO {
  productId: string;
  productName: string;
  brand: string;
  size: string | null;
}

/** A store that already sells another tracked brand, and has never listed this one. */
export interface UnopenedDoorDTO {
  retailerId: string;
  name: string;
  domain: string;
  brand: string;
  catalogSize: number;
  otherBrandListings: number;
}

export interface OpportunityBrandOptionDTO {
  name: string;
  productCount: number;
  isFocus: boolean;
}

export interface MarketOpportunitiesDTO {
  brands: OpportunityBrandOptionDTO[];
  /** Null means every brand. */
  selectedBrand: string | null;
  selectedBrandSlug: string | null;
  summary: {
    productCount: number;
    partnerStoreCount: number;
    restockCount: number;
    newListingCount: number;
    storesWithGaps: number;
    unopenedProductCount: number;
    unopenedDoorCount: number;
  };
  stores: StoreOpportunityBriefDTO[];
  coveredStores: CoveredStoreDTO[];
  restocks: SalesOpportunityDTO[];
  newListings: SalesOpportunityDTO[];
  unopenedProducts: UnopenedProductDTO[];
  unopenedDoors: UnopenedDoorDTO[];
  restocksTruncated: boolean;
  newListingsTruncated: boolean;
}

export type ReviewSentimentDTO = "positive" | "neutral" | "negative";

export type ReviewThemeIdDTO =
  | "price"
  | "delivery"
  | "packaging"
  | "authenticity"
  | "scent"
  | "texture"
  | "results"
  | "irritation"
  | "hair_loss"
  | "customer_service";

export interface ReviewThemeStatsDTO {
  themeId: ReviewThemeIdDTO;
  label: string;
  mentions: number;
  positive: number;
  neutral: number;
  negative: number;
  netSentiment: number;
}

export interface ReviewKeywordDTO {
  term: string;
  count: number;
}

export interface StoreReviewSummaryDTO {
  retailerId: string;
  retailerName: string;
  domain: string;
  isOwnStore: boolean;
  isBrandStore: boolean;
  reviewCount: number;
  averageRating: number | null;
  sentiment: { positive: number; neutral: number; negative: number };
  positivePercentage: number | null;
  negativePercentage: number | null;
  topPraised: ReviewThemeStatsDTO[];
  topComplained: ReviewThemeStatsDTO[];
  themes: ReviewThemeStatsDTO[];
}

export interface ProductReviewGapDTO {
  productId: string;
  productName: string;
  brand: string | null;
  size: string | null;
  ownReviewCount: number;
  ownAverageRating: number | null;
  competitorReviewCount: number;
  competitorMedianRating: number | null;
  ratingGap: number | null;
  reviewCountGap: number | null;
}

export interface ReviewListItemDTO {
  id: string;
  productId: string;
  productName: string;
  brand: string | null;
  retailerId: string;
  retailerName: string;
  isOwnStore: boolean;
  author: string | null;
  rating: number | null;
  text: string;
  language: string | null;
  sentiment: ReviewSentimentDTO;
  themes: ReviewThemeIdDTO[];
  publishedAt: string | null;
  firstSeenAt: string;
}

export interface ReviewsOverviewDTO {
  summary: {
    totalReviews: number;
    averageRating: number | null;
    positivePercentage: number | null;
    negativePercentage: number | null;
    storesCovered: number;
    productsCovered: number;
  };
  stores: StoreReviewSummaryDTO[];
  themes: ReviewThemeStatsDTO[];
  productGaps: ProductReviewGapDTO[];
  positiveKeywords: ReviewKeywordDTO[];
  negativeKeywords: ReviewKeywordDTO[];
  recentNegative: ReviewListItemDTO[];
  reviews: PaginatedDTO<ReviewListItemDTO>;
  retailers: { id: string; name: string; isOwnStore: boolean }[];
  /** Product ids that have at least one source (for bulk content capture). */
  productIds: string[];
}

export type CampaignInsightTypeDTO =
  | "competitor_weakness"
  | "our_weakness"
  | "strength"
  | "review_gap"
  | "price_value";

export interface CampaignInsightDTO {
  id: string;
  type: CampaignInsightTypeDTO;
  title: string;
  evidence: string;
  suggestedAction: string;
  priority: number;
  themeId: ReviewThemeIdDTO | null;
  themeLabel: string | null;
  retailerIds: string[];
  retailerNames: string[];
  productIds: string[];
  productNames: string[];
  sampleSnippets: string[];
  /** Reviews that support this card. */
  reviewCount?: number;
}

export interface CampaignQuoteDTO {
  text: string;
  retailerName: string;
  rating: number | null;
  /** Written on the brand's official store. */
  official: boolean;
}

export interface CampaignProductAngleDTO {
  productId: string;
  productName: string;
  brand: string;
  reviewCount: number;
  averageRating: number | null;
  positive: number;
  negative: number;
  themeLabels: string[];
  praise: CampaignQuoteDTO[];
  complaints: CampaignQuoteDTO[];
  action: string;
}

export interface CampaignsOverviewDTO {
  summary: {
    totalInsights: number;
    competitorWeaknesses: number;
    ourWeaknesses: number;
    strengths: number;
    reviewGaps: number;
    priceValue: number;
    /** Reviews of the selected brand, including the official store. */
    brandReviewCount: number;
    /** Reviews placed on a product brief or an insight. */
    reviewsUsed: number;
  };
  insights: CampaignInsightDTO[];
  productAngles: CampaignProductAngleDTO[];
  brands: string[];
  retailers: { id: string; name: string; isOwnStore: boolean }[];
  selectedBrand: string | null;
}

export interface CampaignIdeaDTO {
  name: string;
  targetAudience: string;
  keyMessageAr: string;
  keyMessageEn: string;
  channels: string[];
  supportingEvidence: string[];
}

export interface CampaignIdeasResultDTO {
  prompt: string;
  ideas: CampaignIdeaDTO[];
}

export type { PricePosition };
