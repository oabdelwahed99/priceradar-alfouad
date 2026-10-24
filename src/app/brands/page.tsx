import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, Tags } from "lucide-react";
import { DatabaseNotice } from "@/components/layout/database-notice";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loadPageData } from "@/lib/db/page-data";
import { listBrands } from "@/lib/services/brands/brand.service";
import { getCurrentWorkspaceId } from "@/lib/workspace";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Brands · Price Radar" };

export default async function BrandsPage() {
  await connection();
  const result = await loadPageData(() => listBrands(getCurrentWorkspaceId()));

  return (
    <>
      <PageHeader
        title="Brands"
        description="Track how each brand's official price compares with pharmacies and marketplaces. Dermaelle is the focus brand."
      />

      {!result.ok ? (
        <DatabaseNotice message={result.message} />
      ) : result.data.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="No brands yet"
          description="Import the brand price sheet with pnpm import:sheet brand to load Dermaelle and Bobai."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {result.data.map((brand) => (
            <Card key={brand.id} className={cn(brand.isFocus && "ring-2 ring-primary/40")}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {brand.name}
                      {brand.isFocus ? (
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">Focus</span>
                      ) : null}
                    </CardTitle>
                    <CardDescription className="font-mono text-xs">{brand.officialDomain}</CardDescription>
                  </div>
                  <Link href={`/brands/${brand.slug}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                    Open <ArrowRight />
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-xs text-muted-foreground">Products</dt>
                    <dd className="text-lg font-semibold tabular-nums">{brand.productCount}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Stores</dt>
                    <dd className="text-lg font-semibold tabular-nums">{brand.storeCount}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Below official</dt>
                    <dd className="text-lg font-semibold tabular-nums text-rose-700 dark:text-rose-400">
                      {brand.belowOfficial}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Out of stock</dt>
                    <dd className="text-lg font-semibold tabular-nums">{brand.outOfStock}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
