import { FileSearch, Info } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import type { ProductContentAnalysisDTO } from "@/types/dto";
import { CaptureContentButton } from "./capture-content-button";
import { ContentPages } from "./content-pages";
import { ContentSummary } from "./content-summary";
import { AttributeCoverage, KeywordGap } from "./keyword-gap";

export function ContentTab({
  analysis,
  productId,
  isDemo,
}: {
  analysis: ProductContentAnalysisDTO;
  productId: string;
  isDemo: boolean;
}) {
  const sourceCount = analysis.pages.length;

  if (analysis.status === "NO_CONTENT") {
    return (
      <EmptyState
        icon={FileSearch}
        title="No page content captured yet"
        description={
          isDemo
            ? "Demo products use generated prices only. Add a real product to analyze its product pages."
            : "Capture content reads each store page's title, description, headings and FAQ without changing prices. Refresh Prices also captures content."
        }
        action={isDemo ? undefined : <CaptureContentButton productId={productId} sourceCount={sourceCount} variant="default" />}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2">
          <Info className="mt-0.5 size-4 shrink-0" />
          <p>
            Use competitor content for research only. Copying it can breach copyright, and Google ranks duplicate text lower, so
            write your own copy informed by these gaps.
          </p>
        </div>
        {isDemo ? null : <CaptureContentButton productId={productId} sourceCount={sourceCount} />}
      </div>

      {!analysis.ownPageCaptured ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
          <Info className="mt-0.5 size-4 shrink-0" />
          Your own page hasn&apos;t been captured yet, so the checklist and gaps can&apos;t be calculated. The terms below are what
          competitors use.
        </div>
      ) : null}

      <ContentSummary analysis={analysis} />
      <KeywordGap analysis={analysis} />
      <AttributeCoverage analysis={analysis} />
      <ContentPages pages={analysis.pages} />
    </div>
  );
}
