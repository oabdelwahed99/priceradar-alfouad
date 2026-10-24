import Link from "next/link";
import { Store, Tags } from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toQueryString } from "@/lib/validation/search-params";
import type { OpportunitiesView } from "@/lib/validation/opportunities.schema";
import { cn } from "@/lib/utils";
import type { MarketOpportunitiesDTO, OpportunityTone, SalesOpportunityDTO } from "@/types/dto";
import { formatMoney, formatRelativeTime } from "@/utils/format";

function boardHref(
  data: MarketOpportunitiesDTO,
  view: OpportunitiesView,
  overrides: { brand?: string | null; view?: OpportunitiesView } = {},
): string {
  const brand = overrides.brand !== undefined ? overrides.brand : data.selectedBrand;
  const nextView = overrides.view ?? view;
  return `/opportunities${toQueryString({
    brand: brand ?? "all",
    view: nextView === "stores" ? undefined : nextView,
  })}`;
}

function OpportunityLabel({ tone, action }: { tone: OpportunityTone; action: string }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded px-1.5 py-0.5 text-xs font-medium",
        tone === "ready" && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
        tone === "confirm_supply" && "bg-amber-500/10 text-amber-800 dark:text-amber-300",
        tone === "supply_gap" && "bg-muted text-muted-foreground",
      )}
    >
      {action}
    </span>
  );
}

function extraSize(name: string, size: string | null): string | null {
  if (!size || name.toLowerCase().includes(size.toLowerCase())) return null;
  return size;
}

function ProductLink({ row }: { row: Pick<SalesOpportunityDTO, "productId" | "productName" | "size" | "category"> }) {
  const meta = [extraSize(row.productName, row.size), row.category].filter(Boolean).join(" · ");
  return (
    <div className="min-w-0">
      <Link href={`/products/${row.productId}`} className="font-medium hover:underline">
        {row.productName}
      </Link>
      {meta ? <div className="text-xs text-muted-foreground">{meta}</div> : null}
    </div>
  );
}

function OpportunityTable({
  rows,
  showBrand,
  showPrice,
}: {
  rows: SalesOpportunityDTO[];
  showBrand: boolean;
  showPrice: boolean;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Product</TableHead>
          {showBrand ? <TableHead>Brand</TableHead> : null}
          <TableHead>Store</TableHead>
          {showPrice ? <TableHead className="text-right">Last price</TableHead> : null}
          <TableHead>What to do</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={`${row.productId}:${row.retailerId}`}>
            <TableCell className="whitespace-normal">
              <ProductLink row={row} />
            </TableCell>
            {showBrand ? <TableCell>{row.brand}</TableCell> : null}
            <TableCell className="whitespace-normal">
              <div className="font-medium">{row.retailerName}</div>
              <div className="font-mono text-xs text-muted-foreground">{row.retailerDomain}</div>
            </TableCell>
            {showPrice ? (
              <TableCell className="text-right whitespace-normal">
                <div className="font-medium tabular-nums">{formatMoney(row.price, row.currency)}</div>
                {row.observedAt ? (
                  <div className="text-xs text-muted-foreground">Seen {formatRelativeTime(row.observedAt)}</div>
                ) : null}
                {row.url ? (
                  <a href={row.url} target="_blank" rel="noreferrer" className="text-xs underline">
                    Store page
                  </a>
                ) : null}
              </TableCell>
            ) : null}
            <TableCell className="whitespace-normal">
              <div className="flex max-w-md flex-col items-start gap-1.5">
                <OpportunityLabel tone={row.tone} action={row.action} />
                <p className="text-xs text-muted-foreground">{row.detail}</p>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function StoreBriefs({ data, view }: { data: MarketOpportunitiesDTO; view: OpportunitiesView }) {
  const showBrand = data.selectedBrand === null;
  return (
    <div className="space-y-4">
      {data.stores.map((store) => (
        <Card key={`${store.brand}:${store.retailerId}`}>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              {store.name}
              {showBrand ? (
                <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">{store.brand}</span>
              ) : null}
            </CardTitle>
            <CardDescription>
              <span className="font-mono text-xs">{store.domain}</span>
              {" · "}
              {store.listed} of {store.catalogSize} listed
              {" · "}
              {store.coveragePercentage}% coverage
              {store.outOfStock > 0 ? ` · ${store.outOfStock} out of stock` : ""}
              {store.pitchCount > 0 ? ` · ${store.pitchCount} to open` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              <section className="min-w-0">
                <h3 className="text-sm font-medium">Refill</h3>
                {store.restocks.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">Nothing to refill here.</p>
                ) : (
                  <ul className="mt-1 divide-y">
                    {store.restocks.map((row) => (
                      <li key={row.productId} className="flex items-start justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <ProductLink row={row} />
                          <p className="mt-0.5 text-xs text-muted-foreground">{row.detail}</p>
                          {row.price !== null ? (
                            <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                              Last price {formatMoney(row.price, row.currency)}
                              {row.url ? (
                                <>
                                  {" · "}
                                  <a href={row.url} target="_blank" rel="noreferrer" className="underline">
                                    Store page
                                  </a>
                                </>
                              ) : null}
                            </p>
                          ) : null}
                        </div>
                        <OpportunityLabel tone={row.tone} action={row.action} />
                      </li>
                    ))}
                  </ul>
                )}
                {store.outOfStock > store.restocks.length ? (
                  <p className="pt-2 text-xs text-muted-foreground">
                    Showing {store.restocks.length} of {store.outOfStock}.{" "}
                    <Link href={boardHref(data, view, { view: "restock" })} className="underline">
                      Open the refill list
                    </Link>
                  </p>
                ) : null}
              </section>
              <section className="min-w-0">
                <h3 className="text-sm font-medium">Open for the first time</h3>
                {store.pitches.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">No product left that this store can take on.</p>
                ) : (
                  <ul className="mt-1 divide-y">
                    {store.pitches.map((row) => (
                      <li key={row.productId} className="flex items-start justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <ProductLink row={row} />
                          <p className="mt-0.5 text-xs text-muted-foreground">{row.detail}</p>
                        </div>
                        <OpportunityLabel tone={row.tone} action={row.action} />
                      </li>
                    ))}
                  </ul>
                )}
                {store.pitchCount > store.pitches.length ? (
                  <p className="pt-2 text-xs text-muted-foreground">
                    Showing {store.pitches.length} of {store.pitchCount}.{" "}
                    <Link href={boardHref(data, view, { view: "listings" })} className="underline">
                      Open the first-listing list
                    </Link>
                  </p>
                ) : null}
              </section>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function OpportunitiesBoard({ data, view }: { data: MarketOpportunitiesDTO; view: OpportunitiesView }) {
  const showBrand = data.selectedBrand === null;
  const brandKnown = data.selectedBrand === null || data.brands.some((brand) => brand.name === data.selectedBrand);
  const views: { id: OpportunitiesView; label: string; count: number }[] = [
    { id: "stores", label: "By store", count: data.summary.storesWithGaps },
    { id: "restock", label: "Refill shelves", count: data.summary.restockCount },
    { id: "listings", label: "First listings", count: data.summary.newListingCount },
  ];

  return (
    <div className="space-y-6">
      {data.brands.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          <Link
            href={boardHref(data, view, { brand: null })}
            scroll={false}
            className={cn(buttonVariants({ variant: data.selectedBrand === null ? "default" : "outline", size: "sm" }))}
          >
            All brands
          </Link>
          {data.brands.map((brand) => (
            <Link
              key={brand.name}
              href={boardHref(data, view, { brand: brand.name })}
              scroll={false}
              className={cn(
                buttonVariants({ variant: data.selectedBrand === brand.name ? "default" : "outline", size: "sm" }),
              )}
            >
              {brand.name}
              {brand.isFocus ? <span className="text-xs opacity-80">Focus</span> : null}
              <span className="tabular-nums opacity-70">{brand.productCount}</span>
            </Link>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Shelves to refill"
          value={data.summary.restockCount}
          icon={Store}
          tone={data.summary.restockCount > 0 ? "warning" : "default"}
          hint="Already listed, currently out of stock"
        />
        <KpiCard
          label="First-time listings"
          value={data.summary.newListingCount}
          icon={Tags}
          hint="Missing from a store that already carries the brand"
        />
        <KpiCard
          label="Stores to visit"
          value={data.summary.storesWithGaps}
          icon={Store}
          hint={
            data.summary.partnerStoreCount === 1
              ? "1 partner store in this view"
              : `${data.summary.partnerStoreCount} partner stores in this view`
          }
        />
        <KpiCard
          label="Not in any partner store"
          value={data.summary.unopenedProductCount}
          icon={Tags}
          hint="In stock, and no partner lists them yet"
        />
      </div>

      <nav className="flex w-fit flex-wrap gap-1 rounded-lg bg-muted p-1">
        {views.map((item) => (
          <Link
            key={item.id}
            href={boardHref(data, view, { view: item.id })}
            scroll={false}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium",
              view === item.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
            <span className="ml-1.5 tabular-nums text-muted-foreground">{item.count}</span>
          </Link>
        ))}
      </nav>

      {!brandKnown ? (
        <p className="text-sm text-muted-foreground">No products for {data.selectedBrand}.</p>
      ) : data.summary.productCount === 0 ? (
        <p className="text-sm text-muted-foreground">
          Import a brand price sheet, or add products with a brand, and this page will show where to refill and where to open a first listing.
        </p>
      ) : view === "restock" ? (
        data.restocks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No partner shelf is out of stock.</p>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Refill these shelves</CardTitle>
              <CardDescription>
                The product is already listed. Ask the store to put it back. Rows where it is also in stock elsewhere are first.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <OpportunityTable rows={data.restocks} showBrand={showBrand} showPrice />
              {data.restocksTruncated ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Showing the first {data.restocks.length} refills. Filter to one brand to narrow the list.
                </p>
              ) : null}
            </CardContent>
          </Card>
        )
      ) : view === "listings" ? (
        <div className="space-y-4">
          {data.unopenedProducts.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Not listed at any partner yet</CardTitle>
                <CardDescription>
                  These are in stock and no partner store carries them. They are the products to open for the first time.
                  {data.summary.unopenedProductCount > data.unopenedProducts.length
                    ? ` Showing ${data.unopenedProducts.length} of ${data.summary.unopenedProductCount}.`
                    : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-wrap gap-2">
                  {data.unopenedProducts.map((product) => (
                    <li key={product.productId}>
                      <Link
                        href={`/products/${product.productId}`}
                        className="inline-flex items-center rounded-md border px-2.5 py-1 text-sm hover:bg-muted"
                      >
                        {product.productName}
                        {extraSize(product.productName, product.size) ? (
                          <span className="ml-1 text-muted-foreground">{product.size}</span>
                        ) : null}
                        {showBrand ? <span className="ml-1 text-xs text-muted-foreground">{product.brand}</span> : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
          {data.newListings.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Every partner that already carries the brand lists the products that are in stock somewhere.
            </p>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Open a first listing</CardTitle>
                <CardDescription>
                  The store already sells the brand, and this product has never been listed there. Products that are in stock at more stores come first.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <OpportunityTable rows={data.newListings} showBrand={showBrand} showPrice={false} />
                {data.newListingsTruncated ? (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Showing the first {data.newListings.length} listings. Filter to one brand to narrow the list.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {data.unopenedDoors.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  {data.selectedBrand
                    ? `Stores that have never carried ${data.selectedBrand}`
                    : "Stores that have never carried one of your brands"}
                </CardTitle>
                <CardDescription>
                  They already sell another brand you track, so there is a relationship. This is a new account for the brand, not a missing SKU.
                  {data.summary.unopenedDoorCount > data.unopenedDoors.length
                    ? ` Showing ${data.unopenedDoors.length} of ${data.summary.unopenedDoorCount}.`
                    : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Store</TableHead>
                      {showBrand ? <TableHead>Brand to open</TableHead> : null}
                      <TableHead className="text-right">Catalog</TableHead>
                      <TableHead className="text-right">Other brands already listed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.unopenedDoors.map((door) => (
                      <TableRow key={`${door.brand}:${door.retailerId}`}>
                        <TableCell className="whitespace-normal">
                          <div className="font-medium">{door.name}</div>
                          <div className="font-mono text-xs text-muted-foreground">{door.domain}</div>
                        </TableCell>
                        {showBrand ? <TableCell>{door.brand}</TableCell> : null}
                        <TableCell className="text-right tabular-nums">{door.catalogSize}</TableCell>
                        <TableCell className="text-right tabular-nums">{door.otherBrandListings}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : null}

          {data.summary.partnerStoreCount === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                No partner store lists {data.selectedBrand ?? "these brands"} yet. Products that are in stock are ready to place once you open a door.
              </p>
              {data.unopenedProducts.length > 0 ? (
                <ul className="flex flex-wrap gap-2">
                  {data.unopenedProducts.map((product) => (
                    <li key={product.productId}>
                      <Link
                        href={`/products/${product.productId}`}
                        className="inline-flex items-center rounded-md border px-2.5 py-1 text-sm hover:bg-muted"
                      >
                        {product.productName}
                        {extraSize(product.productName, product.size) ? (
                          <span className="ml-1 text-muted-foreground">{product.size}</span>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : data.stores.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Partner stores already list the products that are available to sell, and none of those listings are out of stock.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Stores with an empty shelf come first, then stores missing products that are already selling elsewhere.
              </p>
              <StoreBriefs data={data} view={view} />
            </>
          )}

          {data.coveredStores.length > 0 ? (
            <p className="text-sm text-muted-foreground">
              {`Already covered: ${data.coveredStores
                .slice(0, 8)
                .map((store) => (showBrand ? `${store.name} (${store.brand})` : store.name))
                .join(", ")}${data.coveredStores.length > 8 ? `, and ${data.coveredStores.length - 8} more` : ""}. They list the available catalog and have nothing out of stock.`}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
