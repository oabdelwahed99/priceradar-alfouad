import type { Metadata } from "next";
import Link from "next/link";
import { Megaphone, MessageSquareText, Lock, ShieldAlert, Swords, TrendingUp } from "lucide-react";
import { CampaignIdeasDialog } from "@/components/campaigns/campaign-ideas-dialog";
import { CampaignsFilters } from "@/components/campaigns/campaigns-filters";
import { InsightCards } from "@/components/campaigns/insight-cards";
import { ProductAngles } from "@/components/campaigns/product-angles";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { DatabaseNotice } from "@/components/layout/database-notice";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { getSession } from "@/lib/auth/session";
import { loadPageData } from "@/lib/db/page-data";
import { getCampaignsOverview } from "@/lib/services/reviews/campaign.service";
import { campaignsQuerySchema } from "@/lib/validation/reviews.schema";
import { parseSearchParamsLenient } from "@/lib/validation/search-params";
import { getCurrentWorkspaceId } from "@/lib/workspace";

export const metadata: Metadata = { title: "Marketing Campaigns · Price Radar" };

export default async function CampaignsPage(props: PageProps<"/campaigns">) {
  const session = await getSession();
  if (session?.role !== "admin") {
    return (
      <>
        <PageHeader title="Marketing Campaigns" description="This feature is locked for your account." />
        <EmptyState
          icon={Lock}
          title="Marketing Campaigns is locked"
          description="An admin can open campaign briefs. Your account can still read customer reviews."
        />
      </>
    );
  }

  const query = parseSearchParamsLenient(campaignsQuerySchema, await props.searchParams);
  const result = await loadPageData(() => getCampaignsOverview(getCurrentWorkspaceId(), query));

  return (
    <>
      <PageHeader
        title="Marketing Campaigns"
        description={
          result.ok && result.data.selectedBrand
            ? `Campaign briefs for ${result.data.selectedBrand}, built from customer reviews on the official store and every partner.`
            : "Campaign briefs built from customer reviews, including each brand's official store."
        }
        actions={
          <>
            <Link href="/reviews" className={buttonVariants({ variant: "outline" })}>
              <MessageSquareText /> Customer reviews
            </Link>
            {result.ok ? (
              <CampaignIdeasDialog
                brand={result.data.selectedBrand}
                retailerId={query.retailerId ?? null}
                disabled={result.data.insights.length === 0 && result.data.productAngles.length === 0}
              />
            ) : null}
          </>
        }
      />

      {!result.ok ? (
        <DatabaseNotice message={result.message} />
      ) : result.data.summary.brandReviewCount === 0 && result.data.productAngles.length === 0 && result.data.insights.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No campaign insights yet"
          description="Capture customer reviews from store product pages first. Insights appear once we have enough sentiment and theme signal."
          action={
            <Link href="/reviews" className={buttonVariants()}>
              <MessageSquareText /> Go to customer reviews
            </Link>
          }
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Using {result.data.summary.reviewsUsed} of {result.data.summary.brandReviewCount}{" "}
            {result.data.selectedBrand ?? "brand"} review{result.data.summary.brandReviewCount === 1 ? "" : "s"}, including
            the official store.
          </p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <KpiCard label="Reviews used" value={result.data.summary.reviewsUsed} icon={MessageSquareText} />
            <KpiCard
              label="Competitor gaps"
              value={result.data.summary.competitorWeaknesses}
              icon={Swords}
              tone={result.data.summary.competitorWeaknesses > 0 ? "positive" : "default"}
            />
            <KpiCard
              label="Our weaknesses"
              value={result.data.summary.ourWeaknesses}
              icon={ShieldAlert}
              tone={result.data.summary.ourWeaknesses > 0 ? "warning" : "default"}
            />
            <KpiCard label="Strengths" value={result.data.summary.strengths} icon={TrendingUp} tone="positive" />
            <KpiCard label="Review gaps" value={result.data.summary.reviewGaps} icon={MessageSquareText} />
          </div>

          <CampaignsFilters
            brand={result.data.selectedBrand}
            retailerId={query.retailerId ?? null}
            type={query.type ?? null}
            brands={result.data.brands}
            retailers={result.data.retailers}
          />

          <ProductAngles angles={result.data.productAngles} brand={result.data.selectedBrand} />
          <InsightCards insights={result.data.insights} />
        </>
      )}
    </>
  );
}
