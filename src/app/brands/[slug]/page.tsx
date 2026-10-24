import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { StoreLabel, StoreLogo } from "@/components/matrix/store-logo";
import { DatabaseNotice } from "@/components/layout/database-notice";
import { PageHeader } from "@/components/layout/page-header";
import { PriceMatrixTable } from "@/components/matrix/price-matrix-table";
import { GapValue } from "@/components/pricing/position-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { loadPageData } from "@/lib/db/page-data";
import { NotFoundError } from "@/lib/errors";
import { getBrandDetail } from "@/lib/services/brands/brand.service";
import { getCurrentWorkspaceId } from "@/lib/workspace";

export async function generateMetadata(props: PageProps<"/brands/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const result = await loadPageData(() => getBrandDetail(getCurrentWorkspaceId(), slug)).catch(() => null);
  return { title: result?.ok ? `${result.data.name} · Brands · Price Radar` : "Brand · Price Radar" };
}

export default async function BrandDetailPage(props: PageProps<"/brands/[slug]">) {
  await connection();
  const { slug } = await props.params;

  let result;
  try {
    result = await loadPageData(() => getBrandDetail(getCurrentWorkspaceId(), slug));
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
  if (!result.ok) return <DatabaseNotice message={result.message} />;

  const brand = result.data;

  return (
    <>
      <Link href="/brands" className={buttonVariants({ variant: "link", className: "-ml-2.5 h-auto self-start px-0" })}>
        <ArrowLeft /> Brands
      </Link>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <StoreLogo name={brand.name} domain={brand.officialDomain} />
            {brand.name}
            {brand.isFocus ? (
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">Focus</span>
            ) : null}
          </span>
        }
        description={
          <span>
            Official shop <span className="font-mono">{brand.officialDomain}</span>
            {" · "}
            {brand.productCount} product{brand.productCount === 1 ? "" : "s"} vs {brand.storeCompliance.length} stores
          </span>
        }
        actions={
          <Link href={`/products?brand=${encodeURIComponent(brand.name)}`} className={buttonVariants({ variant: "outline" })}>
            All {brand.name} products
          </Link>
        }
      />

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Store compliance</CardTitle>
            <CardDescription>
              How each store&apos;s listings compare with the official {brand.name} price. Out-of-stock listings are
              counted separately and do not affect the average gap.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {brand.storeCompliance.length === 0 ? (
              <p className="text-sm text-muted-foreground">No store listings yet. Import the brand sheet or refresh prices.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Store</TableHead>
                    <TableHead className="text-right">Listings</TableHead>
                    <TableHead className="text-right">Below official</TableHead>
                    <TableHead className="text-right">Above official</TableHead>
                    <TableHead className="text-right">Out of stock</TableHead>
                    <TableHead className="text-right">Avg gap</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {brand.storeCompliance.map((row) => (
                    <TableRow key={row.retailerId}>
                      <TableCell>
                        <StoreLabel name={row.name} domain={row.domain}>
                          <span className="block font-medium">{row.name}</span>
                          <span className="block font-mono text-xs text-muted-foreground">{row.domain}</span>
                        </StoreLabel>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{row.listings}</TableCell>
                      <TableCell className="text-right tabular-nums text-rose-700 dark:text-rose-400">
                        {row.belowOfficial}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                        {row.aboveOfficial}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{row.outOfStock}</TableCell>
                      <TableCell className="text-right">
                        <GapValue value={row.averageGapPercentage} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Price matrix</CardTitle>
            <CardDescription>
              Official price first, then every seller. Gaps are relative to the official shop.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {brand.matrix.rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No products for this brand yet.</p>
            ) : (
              <PriceMatrixTable columns={brand.matrix.columns} rows={brand.matrix.rows} />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
