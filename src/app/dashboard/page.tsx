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
import { getDashboardStats } from "@/lib/services/dashboard/dashboard.service";
import { getCurrentWorkspaceId } from "@/lib/workspace";
import type { DashboardStatsDTO } from "@/types/dto";

export const metadata: Metadata = { title: "Dashboard · Price Radar" };

const addProductLink = (
  <Link href="/products/new" className={buttonVariants()}>
    <Plus /> Add Product
  </Link>
);

export default async function DashboardPage() {
  await connection();
  const result = await loadPageData(() => getDashboardStats(getCurrentWorkspaceId()));

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Overview of your price position across monitored stores."
        actions={addProductLink}
      />

      {!result.ok ? (
        <DatabaseNotice message={result.message} />
      ) : result.data.totalProducts === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title="Start by adding a product"
          description="Enter your product page and the same product on competitor stores. Price Radar extracts the prices and shows where you stand."
          action={addProductLink}
        />
      ) : (
        <DashboardContent stats={result.data} />
      )}
    </>
  );
}

function DashboardContent({ stats }: { stats: DashboardStatsDTO }) {
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
