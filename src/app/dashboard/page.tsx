import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BellOff,
  CheckCircle2,
  GitCompareArrows,
  Package,
  PackageSearch,
  Plus,
  Store,
  Tags,
  Target,
} from "lucide-react";
import { AlertItem } from "@/components/alerts/alert-item";
import { AttentionTable } from "@/components/dashboard/attention-table";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { PositionDistribution } from "@/components/dashboard/position-distribution";
import { DatabaseNotice } from "@/components/layout/database-notice";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loadPageData } from "@/lib/db/page-data";
import { listBrands } from "@/lib/services/brands/brand.service";
import { getDashboardStats } from "@/lib/services/dashboard/dashboard.service";
import { getCurrentWorkspaceId } from "@/lib/workspace";
import type { BrandListItemDTO, DashboardStatsDTO } from "@/types/dto";

export const metadata: Metadata = { title: "Dashboard · Price Radar" };

const addProductLink = (
  <Link href="/products/new" className={buttonVariants()}>
    <Plus /> Add Product
  </Link>
);

export default async function DashboardPage() {
  await connection();
  const workspaceId = getCurrentWorkspaceId();
  const result = await loadPageData(async () => {
    const [stats, brands] = await Promise.all([getDashboardStats(workspaceId), listBrands(workspaceId)]);
    return { stats, brands };
  });

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Overview of your price position across monitored stores."
        actions={addProductLink}
      />

      {!result.ok ? (
        <DatabaseNotice message={result.message} />
      ) : result.data.stats.totalProducts === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title="Start by adding a product"
          description="Enter your product page and the same product on competitor stores. Price Radar extracts the prices and shows where you stand."
          action={addProductLink}
        />
      ) : (
        <DashboardContent stats={result.data.stats} brands={result.data.brands} />
      )}
    </>
  );
}

function DashboardContent({ stats, brands }: { stats: DashboardStatsDTO; brands: BrandListItemDTO[] }) {
  const dermaelle = brands.find((b) => b.slug === "dermaelle");
  const slightlyUnder = stats.positionCounts.SLIGHTLY_UNDERPRICED;
  const slightlyOver = stats.positionCounts.SLIGHTLY_OVERPRICED;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard label="Total Products" value={stats.totalProducts} icon={Package} />
        <KpiCard label="Total Competitors" value={stats.totalCompetitors} icon={Store} hint="Competitor retailers" />
        <KpiCard
          label="Products Compared"
          value={stats.productsCompared}
          icon={GitCompareArrows}
          hint={`of ${stats.totalProducts} with enough price data`}
        />
        <KpiCard
          label="Products Underpriced"
          value={stats.underpriced}
          icon={ArrowDownRight}
          tone="warning"
          hint={slightlyUnder > 0 ? `incl. ${slightlyUnder} slightly underpriced` : "More than 5% below median"}
        />
        <KpiCard
          label="Products Overpriced"
          value={stats.overpriced}
          icon={ArrowUpRight}
          tone="negative"
          hint={slightlyOver > 0 ? `incl. ${slightlyOver} slightly overpriced` : "More than 5% above median"}
        />
        <KpiCard
          label="Products Market Aligned"
          value={stats.marketAligned}
          icon={CheckCircle2}
          tone="positive"
          hint="Within ±5% of median"
        />
      </div>

      {dermaelle && dermaelle.productCount > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tags className="size-4" /> Dermaelle
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">Focus brand</span>
            </CardTitle>
            <CardDescription>
              Sellers vs the official Dermaelle price on {dermaelle.officialDomain}.
            </CardDescription>
            <CardAction>
              <Link href="/brands/dermaelle" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                Open brand <ArrowRight />
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Products</dt>
                <dd className="text-xl font-semibold tabular-nums">{dermaelle.productCount}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Stores</dt>
                <dd className="text-xl font-semibold tabular-nums">{dermaelle.storeCount}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Below official</dt>
                <dd className="text-xl font-semibold tabular-nums text-rose-700 dark:text-rose-400">
                  {dermaelle.belowOfficial}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Out of stock</dt>
                <dd className="text-xl font-semibold tabular-nums">{dermaelle.outOfStock}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      ) : null}

      {stats.productsCompared > 0 ? (
        <Card size="sm">
          <CardContent>
            <PositionDistribution counts={stats.positionCounts} />
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Products requiring attention</CardTitle>
            <CardDescription>Priced more than 5% away from the market median, largest gap first.</CardDescription>
            <CardAction>
              <Link href="/products?sort=gap&order=desc" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                All products <ArrowRight />
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent>
            {stats.attention.length === 0 ? (
              <EmptyState
                icon={Target}
                title="Nothing needs attention"
                description={
                  stats.productsCompared > 0
                    ? "All compared products are within ±5% of the market median."
                    : "Run a price comparison on a product to see how it stands against the market."
                }
              />
            ) : (
              <AttentionTable items={stats.attention} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>New alerts</CardTitle>
            <CardDescription>
              {stats.newAlerts === 0 ? "You're all caught up." : `${stats.newAlerts} unread`}
            </CardDescription>
            <CardAction>
              <Link href="/alerts" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                View all <ArrowRight />
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent>
            {stats.recentAlerts.length === 0 ? (
              <EmptyState icon={BellOff} title="No new alerts" />
            ) : (
              <ul className="-my-3 divide-y">
                {stats.recentAlerts.map((alert) => (
                  <AlertItem key={alert.id} alert={alert} compact />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
