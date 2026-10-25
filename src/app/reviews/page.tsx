import type { Metadata } from "next";
import Link from "next/link";
import { Lock, MessageSquareText, Percent, Plus, Star, Store, ThumbsDown } from "lucide-react";
import { BulkScrapeButton } from "@/components/content/bulk-scrape-button";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { DatabaseNotice } from "@/components/layout/database-notice";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { PaginationNav } from "@/components/layout/pagination-nav";
import { ReviewList } from "@/components/reviews/review-list";
import { ReviewsFilters } from "@/components/reviews/reviews-filters";
import { StoreSentimentTable } from "@/components/reviews/store-sentiment-table";
import { ThemeBreakdown } from "@/components/reviews/theme-breakdown";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSession } from "@/lib/auth/session";
import { loadPageData } from "@/lib/db/page-data";
import { getReviewOverview } from "@/lib/services/reviews/review.service";
import { reviewsOverviewQuerySchema, type ReviewsOverviewQuery } from "@/lib/validation/reviews.schema";
import { parseSearchParamsLenient, toQueryString } from "@/lib/validation/search-params";
import { getCurrentWorkspaceId } from "@/lib/workspace";

export const metadata: Metadata = { title: "Customer Reviews · Price Radar" };

const DEFAULTS = reviewsOverviewQuerySchema.parse({});

function reviewsHref(query: ReviewsOverviewQuery, overrides: Partial<ReviewsOverviewQuery>): string {
  const next = { ...query, ...overrides };
  return `/reviews${toQueryString({
    q: next.q,
    retailerId: next.retailerId,
    sentiment: next.sentiment,
    theme: next.theme,
    page: next.page > 1 ? next.page : null,
    pageSize: next.pageSize !== DEFAULTS.pageSize ? next.pageSize : null,
  })}`;
}

export default async function ReviewsPage(props: PageProps<"/reviews">) {
  const query = parseSearchParamsLenient(reviewsOverviewQuerySchema, await props.searchParams);
  const [result, session] = await Promise.all([
    loadPageData(() => getReviewOverview(getCurrentWorkspaceId(), query)),
    getSession(),
  ]);
  const isAdmin = session?.role === "admin";
  const filtered = Boolean(query.q || query.retailerId || query.sentiment || query.theme);

  return (
    <>
      <PageHeader
        title="Customer Reviews"
        description="Sentiment, themes and rating gaps across every store you track. Reviews are captured with page content."
        actions={
          <>
            {isAdmin ? (
              <Link href="/campaigns" className={buttonVariants({ variant: "outline" })}>
                Marketing campaigns
              </Link>
            ) : (
              <span
                aria-disabled="true"
                className={buttonVariants({ variant: "outline", className: "cursor-not-allowed opacity-60" })}
              >
                <Lock aria-hidden /> Marketing campaigns
              </span>
            )}
            {isAdmin && result.ok && result.data.productIds.length > 0 ? (
              <BulkScrapeButton mode="content" productIds={result.data.productIds} variant="default" />
            ) : null}
          </>
        }
      />

      {!result.ok ? (
        <DatabaseNotice message={result.message} />
      ) : result.data.summary.totalReviews === 0 && !filtered ? (
        <EmptyState
          icon={MessageSquareText}
          title="No customer reviews captured yet"
          description="Capture product page content to pull reviews from store pages (JSON-LD, microdata and common review widgets). Coverage varies by store."
          action={
            isAdmin && result.data.productIds.length > 0 ? (
              <BulkScrapeButton mode="content" productIds={result.data.productIds} variant="default" />
            ) : (
              <Link href="/products/new" className={buttonVariants()}>
                <Plus /> Add Product
              </Link>
            )
          }
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Reviews captured"
              value={result.data.summary.totalReviews}
              icon={MessageSquareText}
              hint={`${result.data.summary.productsCovered} products · ${result.data.summary.storesCovered} stores`}
            />
            <KpiCard
              label="Average rating"
              value={result.data.summary.averageRating != null ? result.data.summary.averageRating.toFixed(1) : "—"}
              icon={Star}
              hint="Across reviews that include a star rating"
            />
            <KpiCard
              label="Positive"
              value={result.data.summary.positivePercentage != null ? `${result.data.summary.positivePercentage}%` : "—"}
              icon={Percent}
              tone="positive"
            />
            <KpiCard
              label="Negative"
              value={result.data.summary.negativePercentage != null ? `${result.data.summary.negativePercentage}%` : "—"}
              icon={ThumbsDown}
              tone={result.data.summary.negativePercentage && result.data.summary.negativePercentage > 20 ? "negative" : "default"}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Store className="size-4" /> Stores compared
              </CardTitle>
              <CardDescription>How each shoppers&apos; reviews land by sentiment and theme.</CardDescription>
            </CardHeader>
            <CardContent>
              <StoreSentimentTable stores={result.data.stores} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Themes across stores</CardTitle>
              <CardDescription>What shoppers talk about most, and how sentiment differs by store.</CardDescription>
            </CardHeader>
            <CardContent>
              <ThemeBreakdown themes={result.data.themes} stores={result.data.stores} />
            </CardContent>
          </Card>

          {(result.data.positiveKeywords.length > 0 || result.data.negativeKeywords.length > 0) && (
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Positive keywords</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-1.5">
                  {result.data.positiveKeywords.map((k) => (
                    <span key={k.term} className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-300">
                      {k.term} · {k.count}
                    </span>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Negative keywords</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-1.5">
                  {result.data.negativeKeywords.map((k) => (
                    <span key={k.term} className="rounded-full bg-rose-500/10 px-2 py-0.5 text-xs text-rose-700 dark:text-rose-300">
                      {k.term} · {k.count}
                    </span>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}

          {result.data.recentNegative.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent negative reviews</CardTitle>
                <CardDescription>Newest complaints across all stores.</CardDescription>
              </CardHeader>
              <CardContent>
                <ReviewList reviews={result.data.recentNegative} />
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">All reviews</CardTitle>
              <CardDescription>Filter by store, sentiment or theme.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ReviewsFilters
                q={query.q ?? ""}
                retailerId={query.retailerId ?? null}
                sentiment={query.sentiment ?? null}
                theme={query.theme ?? null}
                retailers={result.data.retailers}
              />
              {result.data.reviews.items.length === 0 ? (
                <EmptyState
                  icon={MessageSquareText}
                  title="No matching reviews"
                  description={result.data.reviews.total > 0 ? "This page is out of range." : "Try a different filter."}
                  action={
                    <Link href="/reviews" className={buttonVariants({ variant: "outline" })}>
                      Clear filters
                    </Link>
                  }
                />
              ) : (
                <ReviewList reviews={result.data.reviews.items} />
              )}
              <PaginationNav
                page={result.data.reviews.page}
                totalPages={result.data.reviews.totalPages}
                total={result.data.reviews.total}
                pageSize={result.data.reviews.pageSize}
                hrefForPage={(page) => reviewsHref(query, { page })}
                itemLabel="reviews"
              />
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}
