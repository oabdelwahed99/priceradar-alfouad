import type { Metadata } from "next";
import Link from "next/link";
import { Download, Grid3x3, Plus } from "lucide-react";
import { DatabaseNotice } from "@/components/layout/database-notice";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { PriceMatrixTable } from "@/components/matrix/price-matrix-table";
import { ProductsFilters } from "@/components/products/products-filters";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { loadPageData } from "@/lib/db/page-data";
import { getPriceMatrix, PRICE_MATRIX_MAX_PRODUCTS } from "@/lib/services/matrix/price-matrix.service";
import { priceMatrixQuerySchema, type PriceMatrixQuery } from "@/lib/validation/matrix.schema";
import { parseSearchParamsLenient, toQueryString } from "@/lib/validation/search-params";
import { getCurrentWorkspaceId } from "@/lib/workspace";

export const metadata: Metadata = { title: "Price Matrix · Price Radar" };

function matrixQueryString(query: PriceMatrixQuery, overrides: Partial<PriceMatrixQuery> = {}): string {
  const next = { ...query, ...overrides };
  return toQueryString({ q: next.q, position: next.position, demo: next.demo });
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="size-3 rounded-sm bg-emerald-500/15 ring-1 ring-emerald-500/40 ring-inset" /> Lowest in-stock price
      </span>
      <span>
        <span className="text-rose-600 dark:text-rose-400">−12.0%</span> competitor is cheaper than you
      </span>
      <span>
        <span className="text-emerald-600 dark:text-emerald-400">+12.0%</span> competitor is more expensive
      </span>
      <span>Hover a price for details; click it to open the store page.</span>
    </div>
  );
}

export default async function PriceMatrixPage(props: PageProps<"/matrix">) {
  const query = parseSearchParamsLenient(priceMatrixQuerySchema, await props.searchParams);
  const result = await loadPageData(() => getPriceMatrix(getCurrentWorkspaceId(), query));
  const filtered = Boolean(query.q || query.position);

  const demoToggle =
    result.ok && result.data.demoProductCount > 0 ? (
      <Link
        href={`/matrix${matrixQueryString(query, { demo: query.demo ? undefined : "1" })}`}
        className={buttonVariants({ variant: "ghost", size: "sm" })}
        scroll={false}
      >
        {query.demo ? "Hide demo products" : `Show ${result.data.demoProductCount} demo products`}
      </Link>
    ) : null;

  return (
    <>
      <PageHeader
        title="Price Matrix"
        description="The latest price of every product at every store, side by side."
        actions={
          <>
            {result.ok && result.data.rows.length > 0 ? (
              <a
                href={`/api/matrix/export${matrixQueryString(query)}`}
                download
                className={buttonVariants({ variant: "outline" })}
              >
                <Download /> Export CSV
              </a>
            ) : null}
            <Link href="/products/new" className={buttonVariants()}>
              <Plus /> Add Product
            </Link>
          </>
        }
      />

      {!result.ok ? (
        <DatabaseNotice message={result.message} />
      ) : result.data.rows.length === 0 && !filtered ? (
        <EmptyState
          icon={Grid3x3}
          title="No products to compare yet"
          description="Add a product with your store URL and competitor URLs, or import a price sheet with pnpm import:sheet."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link href="/products/new" className={buttonVariants()}>
                <Plus /> Add Product
              </Link>
              {demoToggle}
            </div>
          }
        />
      ) : (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <ProductsFilters q={query.q ?? ""} position={query.position ?? null} />
            </div>
            {demoToggle}
          </div>
          {result.data.rows.length === 0 ? (
            <EmptyState
              icon={Grid3x3}
              title="No matching products"
              description="Try a different search term or position filter."
              action={
                <Link href={`/matrix${matrixQueryString({ demo: query.demo })}`} className={buttonVariants({ variant: "outline" })}>
                  Clear filters
                </Link>
              }
            />
          ) : (
            <>
              <Card>
                <CardContent>
                  <PriceMatrixTable columns={result.data.columns} rows={result.data.rows} />
                </CardContent>
              </Card>
              <Legend />
              {result.data.truncated ? (
                <p className="text-sm text-muted-foreground">
                  Showing the first {PRICE_MATRIX_MAX_PRODUCTS} products. Search or filter to narrow the list.
                </p>
              ) : null}
            </>
          )}
        </>
      )}
    </>
  );
}
