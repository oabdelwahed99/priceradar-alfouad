import type { Metadata } from "next";
import Link from "next/link";
import { PackageSearch, Plus } from "lucide-react";
import { DatabaseNotice } from "@/components/layout/database-notice";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { PaginationNav } from "@/components/layout/pagination-nav";
import { ProductsFilters } from "@/components/products/products-filters";
import { ProductsTable } from "@/components/products/products-table";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { loadPageData } from "@/lib/db/page-data";
import { listProducts } from "@/lib/services/products/product.service";
import { listProductsQuerySchema, type ListProductsQuery } from "@/lib/validation/product.schema";
import { parseSearchParamsLenient, toQueryString } from "@/lib/validation/search-params";
import { getCurrentWorkspaceId } from "@/lib/workspace";

export const metadata: Metadata = { title: "Products · Price Radar" };

const DEFAULT_SORT = listProductsQuerySchema.parse({});

function productsHref(query: ListProductsQuery, overrides: Partial<ListProductsQuery>): string {
  const next = { ...query, ...overrides };
  return `/products${toQueryString({
    q: next.q,
    position: next.position,
    sort: next.sort === DEFAULT_SORT.sort && next.order === DEFAULT_SORT.order ? null : next.sort,
    order: next.sort === DEFAULT_SORT.sort && next.order === DEFAULT_SORT.order ? null : next.order,
    page: next.page > 1 ? next.page : null,
    pageSize: next.pageSize !== DEFAULT_SORT.pageSize ? next.pageSize : null,
  })}`;
}

export default async function ProductsPage(props: PageProps<"/products">) {
  const query = parseSearchParamsLenient(listProductsQuerySchema, await props.searchParams);
  const result = await loadPageData(() => listProducts(getCurrentWorkspaceId(), query));
  const filtered = Boolean(query.q || query.position);

  return (
    <>
      <PageHeader
        title="Products"
        description="Monitored products and their price position against competitors."
        actions={
          <Link href="/products/new" className={buttonVariants()}>
            <Plus /> Add Product
          </Link>
        }
      />

      {!result.ok ? (
        <DatabaseNotice message={result.message} />
      ) : result.data.total === 0 && !filtered ? (
        <EmptyState
          icon={PackageSearch}
          title="No products yet"
          description="Add a product with your store URL and competitor URLs to start comparing prices. You can also load demo data with pnpm seed."
          action={
            <Link href="/products/new" className={buttonVariants()}>
              <Plus /> Add Product
            </Link>
          }
        />
      ) : (
        <>
          <ProductsFilters q={query.q ?? ""} position={query.position ?? null} />
          {result.data.items.length === 0 ? (
            <EmptyState
              icon={PackageSearch}
              title="No matching products"
              description={
                result.data.total > 0
                  ? "This page is out of range."
                  : "Try a different search term or position filter."
              }
              action={
                <Link href="/products" className={buttonVariants({ variant: "outline" })}>
                  Clear filters
                </Link>
              }
            />
          ) : (
            <Card>
              <CardContent>
                <ProductsTable
                  items={result.data.items}
                  sort={query.sort}
                  order={query.order}
                  hrefForSort={(sort, order) => productsHref(query, { sort, order, page: 1 })}
                />
              </CardContent>
            </Card>
          )}
          <PaginationNav
            page={result.data.page}
            totalPages={result.data.totalPages}
            total={result.data.total}
            pageSize={result.data.pageSize}
            hrefForPage={(page) => productsHref(query, { page })}
            itemLabel="products"
          />
        </>
      )}
    </>
  );
}