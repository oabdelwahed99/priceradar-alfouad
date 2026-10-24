import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Target } from "lucide-react";
import { OpportunitiesBoard } from "@/components/opportunities/opportunities-board";
import { DatabaseNotice } from "@/components/layout/database-notice";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { loadPageData } from "@/lib/db/page-data";
import { getMarketOpportunities } from "@/lib/services/opportunities/market-opportunities";
import { opportunitiesQuerySchema } from "@/lib/validation/opportunities.schema";
import { parseSearchParamsLenient } from "@/lib/validation/search-params";
import { getCurrentWorkspaceId } from "@/lib/workspace";

export const metadata: Metadata = { title: "Opportunities · Price Radar" };

export default async function OpportunitiesPage(props: PageProps<"/opportunities">) {
  await connection();
  const query = parseSearchParamsLenient(opportunitiesQuerySchema, await props.searchParams);
  const view = query.view ?? "stores";
  const result = await loadPageData(() => getMarketOpportunities(getCurrentWorkspaceId(), { brand: query.brand }));

  return (
    <>
      <PageHeader
        title="Opportunities"
        description={
          result.ok && result.data.selectedBrand
            ? `Where the sales team can refill ${result.data.selectedBrand}, or open a product a partner store has never listed.`
            : "Where the sales team can refill an empty shelf, or open a product a partner store has never listed."
        }
        actions={
          result.ok && result.data.brands.length > 0 ? (
            <div className="flex gap-2">
              <Link
                href={
                  result.data.selectedBrand
                    ? `/matrix?brand=${encodeURIComponent(result.data.selectedBrand)}`
                    : "/matrix"
                }
                className={buttonVariants({ variant: "outline" })}
              >
                Price matrix
              </Link>
              {result.data.selectedBrandSlug ? (
                <Link href={`/brands/${result.data.selectedBrandSlug}`} className={buttonVariants({ variant: "outline" })}>
                  Brand prices
                </Link>
              ) : null}
            </div>
          ) : null
        }
      />

      {!result.ok ? (
        <DatabaseNotice message={result.message} />
      ) : result.data.brands.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No branded products yet"
          description="Import the brand price sheet, or add products with a brand. Opportunities are the shelves to refill and the products a store has never listed."
        />
      ) : (
        <OpportunitiesBoard data={result.data} view={view} />
      )}
    </>
  );
}
