import type { Metadata } from "next";
import Link from "next/link";
import { FilePenLine, FileSearch, FileWarning, Gauge, Info, Plus } from "lucide-react";
import { BulkScrapeButton } from "@/components/content/bulk-scrape-button";
import { ContentFilters } from "@/components/content/content-filters";
import { ContentOverviewTable } from "@/components/content/content-overview-table";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { DatabaseNotice } from "@/components/layout/database-notice";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { PaginationNav } from "@/components/layout/pagination-nav";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { loadPageData } from "@/lib/db/page-data";
import { CONTENT_OVERVIEW_MAX_PRODUCTS, getContentOverview } from "@/lib/services/content/content-overview.service";
import { contentOverviewQuerySchema, type ContentOverviewQuery } from "@/lib/validation/content.schema";
import { parseSearchParamsLenient, toQueryString } from "@/lib/validation/search-params";
import { getCurrentWorkspaceId } from "@/lib/workspace";

export const metadata: Metadata = { title: "Content & SEO · Price Radar" };

const DEFAULTS = contentOverviewQuerySchema.parse({});

function contentHref(query: ContentOverviewQuery, overrides: Partial<ContentOverviewQuery>): string {
  const next = { ...query, ...overrides };
  const defaultSort = next.sort === DEFAULTS.sort && next.order === DEFAULTS.order;
  return `/content${toQueryString({
    q: next.q,
    band: next.band,
    sort: defaultSort ? null : next.sort,
    order: defaultSort ? null : next.order,
    page: next.page > 1 ? next.page : null,
    pageSize: next.pageSize !== DEFAULTS.pageSize ? next.pageSize : null,
  })}`;
}

export default async function ContentOverviewPage(props: PageProps<"/content">) {
  const query = parseSearchParamsLenient(contentOverviewQuerySchema, await props.searchParams);
  const result = await loadPageData(() => getContentOverview(getCurrentWorkspaceId(), query));
  const filtered = Boolean(query.q || query.band);

  return (
    <>
      <PageHeader
        title="Content & SEO"
        description="How each of your product pages compares with competitors' pages: score, issues and keyword gaps."
        actions={
          result.ok && result.data.productIds.length > 0 ? (
            <>
              <BulkScrapeButton mode="prices" productIds={result.data.productIds} />
              <BulkScrapeButton mode="content" productIds={result.data.productIds} variant="default" />
            </>
          ) : null
        }
      />

      {!result.ok ? (
        <DatabaseNotice message={result.message} />
      ) : result.data.summary.productsAnalyzed === 0 && !filtered ? (
        <EmptyState
          icon={FileSearch}
          title="No products to analyze yet"
          description="Add a product with your store URL and competitor URLs. Page content is captured on every price check."
          action={
            <Link href="/products/new" className={buttonVariants()}>
              <Plus /> Add Product
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Average Score"
              value={result.data.summary.averageScore ?? "—"}
              icon={Gauge}
              hint={`Across ${result.data.summary.productsAnalyzed - result.data.summary.notCaptured} captured pages`}
            />
            <KpiCard
              label="Needs Work"
              value={result.data.summary.needsWork}
              icon={FileWarning}
              tone={result.data.summary.needsWork > 0 ? "negative" : "default"}
              hint="Score below 50"
            />
            <KpiCard
              label="Not Captured"
              value={result.data.summary.notCaptured}
              icon={FileSearch}
              tone={result.data.summary.notCaptured > 0 ? "warning" : "default"}
              hint="Refresh prices to capture your page"
            />
            <KpiCard
              label="Competitor Rewrites"
              value={result.data.summary.competitorChanges30d}
              icon={FilePenLine}
              hint="Products with a competitor page change in 30 days"
            />
          </div>

          {result.data.summary.notCaptured > 0 ? (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
              <Info className="mt-0.5 size-4 shrink-0" />
              <p>
                {result.data.summary.notCaptured} of {result.data.summary.productsAnalyzed} products have no page content yet.
                Click <span className="font-medium">Capture content</span> to read every store page without changing prices,
                or <span className="font-medium">Refresh all prices</span> to update prices and content together.
              </p>
            </div>
          ) : null}

          <ContentFilters q={query.q ?? ""} band={query.band ?? null} />

          {result.data.items.length === 0 ? (
            <EmptyState
              icon={FileSearch}
              title="No matching products"
              description={result.data.total > 0 ? "This page is out of range." : "Try a different search term or score filter."}
              action={
                <Link href="/content" className={buttonVariants({ variant: "outline" })}>
                  Clear filters
                </Link>
              }
            />
          ) : (
            <Card>
              <CardContent>
                <ContentOverviewTable
                  rows={result.data.items}
                  sort={query.sort}
                  order={query.order}
                  hrefForSort={(sort, order) => contentHref(query, { sort, order, page: 1 })}
                />
              </CardContent>
            </Card>
          )}
          <PaginationNav
            page={result.data.page}
            totalPages={result.data.totalPages}
            total={result.data.total}
            pageSize={result.data.pageSize}
            hrefForPage={(page) => contentHref(query, { page })}
            itemLabel="products"
          />
          {result.data.truncated ? (
            <p className="text-sm text-muted-foreground">
              Analyzing the {CONTENT_OVERVIEW_MAX_PRODUCTS} most recently checked products. Search to narrow the list.
            </p>
          ) : null}
        </>
      )}
    </>
  );
}
