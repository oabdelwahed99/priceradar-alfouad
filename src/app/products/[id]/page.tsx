import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ContentTab } from "@/components/content/content-tab";
import { PageHeader } from "@/components/layout/page-header";
import { PriceSummary } from "@/components/pricing/price-summary";
import { CompetitorTable } from "@/components/products/competitor-table";
import { DeleteProductButton } from "@/components/products/delete-product-button";
import { LastChecked } from "@/components/products/last-checked";
import { PriceHistoryChart } from "@/components/products/price-history-chart";
import { RefreshButton } from "@/components/products/refresh-button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatabaseNotice } from "@/components/layout/database-notice";
import { loadPageData } from "@/lib/db/page-data";
import { NotFoundError } from "@/lib/errors";
import { DEMO_REFRESH_MESSAGE, getProductOverview } from "@/lib/services/comparison/comparison.service";
import { getProductContentAnalysis } from "@/lib/services/content/content.service";
import { getProductDoc } from "@/lib/services/products/product.service";
import { getCurrentWorkspaceId } from "@/lib/workspace";

export async function generateMetadata(props: PageProps<"/products/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const result = await loadPageData(() => getProductDoc(getCurrentWorkspaceId(), id)).catch(() => null);
  return { title: result?.ok ? `${result.data.name} · Price Radar` : "Product · Price Radar" };
}

export default async function ProductDetailPage(props: PageProps<"/products/[id]">) {
  const [{ id }, searchParams] = await Promise.all([props.params, props.searchParams]);
  const tab = searchParams.tab === "content" ? "content" : "pricing";

  let result;
  try {
    result = await loadPageData(async () => {
      const workspaceId = getCurrentWorkspaceId();
      const [overview, content] = await Promise.all([
        getProductOverview(workspaceId, id),
        getProductContentAnalysis(workspaceId, id),
      ]);
      return { ...overview, content };
    });
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
  if (!result.ok) return <DatabaseNotice message={result.message} />;

  const { product, analysis, rows, history, content } = result.data;
  const lastCheckedAt = product.lastCheckedAt ? new Date(product.lastCheckedAt).toISOString() : null;
  const subtitle = [product.brand, product.size].filter(Boolean).join(" · ");

  return (
    <>
      <Link href="/products" className={buttonVariants({ variant: "link", className: "-ml-2.5 h-auto self-start px-0" })}>
        <ArrowLeft /> Products
      </Link>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            {product.name}
            {product.isDemo ? (
              <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">Demo data</span>
            ) : null}
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {subtitle ? <span>{subtitle}</span> : null}
            <LastChecked at={lastCheckedAt} />
          </span>
        }
        actions={
          <>
            <RefreshButton
              productId={id}
              sourceCount={rows.length}
              disabledReason={product.isDemo ? DEMO_REFRESH_MESSAGE : undefined}
            />
            <DeleteProductButton productId={id} productName={product.name} />
          </>
        }
      />

      <Tabs defaultValue={tab} className="gap-6">
        <TabsList>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
          <TabsTrigger value="content">
            Content &amp; SEO
            {content.score !== null ? <span className="text-xs text-muted-foreground tabular-nums">{content.score}</span> : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pricing" keepMounted className="space-y-6">
          <PriceSummary analysis={analysis} />

          <Card>
            <CardHeader>
              <CardTitle>Competitor comparison</CardTitle>
              <CardDescription>Difference shows each competitor&apos;s price relative to yours.</CardDescription>
            </CardHeader>
            <CardContent>
              <CompetitorTable productId={id} rows={rows} allowRetry={!product.isDemo} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Price history</CardTitle>
              <CardDescription>Every successful price check is stored; previous observations are never overwritten.</CardDescription>
            </CardHeader>
            <CardContent>
              <PriceHistoryChart
                key={lastCheckedAt ?? "never"}
                productId={id}
                initialSeries={history}
                currency={analysis.currency}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="content">
          <ContentTab analysis={content} productId={id} isDemo={Boolean(product.isDemo)} />
        </TabsContent>
      </Tabs>
    </>
  );
}
