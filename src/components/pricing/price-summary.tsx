import { Info, Lightbulb } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { SUGGESTED_PRICE_DISCLAIMER } from "@/lib/services/pricing/pricing-recommendation.service";
import type { ProductAnalysisDTO } from "@/types/dto";
import { formatMoney } from "@/utils/format";
import { GapValue, PositionBadge } from "./position-badge";

function Stat({ label, children, hint }: { label: string; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">{label}</p>
      <div className="text-xl font-semibold tabular-nums">{children}</div>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

const INSUFFICIENT_MESSAGES = {
  NO_OWN_PRICE: "Your store's price could not be extracted, so your position cannot be calculated.",
  NO_COMPETITOR_PRICES: "No competitor prices are available yet, so market statistics cannot be calculated.",
} as const;

export function PriceSummary({ analysis }: { analysis: ProductAnalysisDTO }) {
  const c = analysis.currency;
  const range =
    analysis.marketMinimum !== null && analysis.marketMaximum !== null
      ? `${formatMoney(analysis.marketMinimum, c)} – ${formatMoney(analysis.marketMaximum, c)}`
      : "—";

  return (
    <div className="space-y-3">
      {analysis.status === "INSUFFICIENT_DATA" && analysis.reason ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
          <Info className="mt-0.5 size-4 shrink-0" />
          {INSUFFICIENT_MESSAGES[analysis.reason]}
        </div>
      ) : null}

      <Card>
        <CardContent className="grid grid-cols-2 gap-6 md:grid-cols-4 xl:grid-cols-7">
          <Stat label="Your price">{formatMoney(analysis.ownPrice, c)}</Stat>
          <Stat label="Market median">{formatMoney(analysis.marketMedian, c)}</Stat>
          <Stat label="Market average">{formatMoney(analysis.marketAverage, c)}</Stat>
          <Stat label="Market range">
            <span className="text-base">{range}</span>
          </Stat>
          <Stat label="Price gap" hint="vs market median">
            <GapValue value={analysis.gapPercentage} />
          </Stat>
          <Stat label="Position">
            <PositionBadge position={analysis.position} className="text-sm" />
          </Stat>
          <Stat label="Suggested price">
            <span className="text-primary">{formatMoney(analysis.suggestedPrice, c)}</span>
          </Stat>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2 rounded-lg border bg-card px-4 py-3 text-sm lg:flex-row lg:items-start lg:justify-between lg:gap-6">
        <div className="flex items-start gap-2">
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="space-y-0.5">
            {analysis.suggestion ? <p>{analysis.suggestion.explanation}</p> : null}
            <p className="text-muted-foreground">
              {SUGGESTED_PRICE_DISCLAIMER} It does not consider your cost, margin, inventory, demand or promotions.
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground lg:max-w-xs lg:text-right">
          Based on {analysis.includedCompetitorCount} of {analysis.competitorCount} competitor
          {analysis.competitorCount === 1 ? "" : "s"}
          {analysis.status === "OK"
            ? ` · ${analysis.cheaperCompetitors} cheaper · ${analysis.moreExpensiveCompetitors} more expensive`
            : ""}
        </p>
      </div>
    </div>
  );
}
