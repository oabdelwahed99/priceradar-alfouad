import Link from "next/link";
import { StoreLabel } from "@/components/matrix/store-logo";
import { cn } from "@/lib/utils";
import type { CampaignInsightDTO, CampaignInsightTypeDTO } from "@/types/dto";

const TYPE_META: Record<
  CampaignInsightTypeDTO,
  { label: string; tone: string }
> = {
  competitor_weakness: {
    label: "Competitor weakness",
    tone: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
  our_weakness: {
    label: "Our weakness",
    tone: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  },
  strength: {
    label: "Strength",
    tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  review_gap: {
    label: "Review gap",
    tone: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  price_value: {
    label: "Price / value",
    tone: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  },
};

const TYPE_ORDER: CampaignInsightTypeDTO[] = [
  "competitor_weakness",
  "our_weakness",
  "strength",
  "review_gap",
  "price_value",
];

function InsightCard({ insight }: { insight: CampaignInsightDTO }) {
  const meta = TYPE_META[insight.type];
  return (
    <article className="space-y-3 rounded-xl border bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", meta.tone)}>{meta.label}</span>
        {insight.themeLabel ? (
          <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{insight.themeLabel}</span>
        ) : null}
      </div>
      <div>
        <h3 className="font-medium leading-snug">{insight.title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{insight.evidence}</p>
      </div>
      <p className="text-sm">
        <span className="font-medium">Suggested action:</span> {insight.suggestedAction}
      </p>
      {insight.reviewCount ? (
        <p className="text-xs text-muted-foreground">
          Based on {insight.reviewCount} review{insight.reviewCount === 1 ? "" : "s"}
        </p>
      ) : null}
      {insight.retailerNames.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {insight.retailerNames.map((name, index) => (
            <StoreLabel key={`${insight.id}:${name}`} name={name} domain={insight.retailerDomains?.[index]} size="sm" className="text-xs" />
          ))}
        </div>
      ) : null}
      {insight.productNames.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 text-xs">
          {insight.productIds.map((id, i) => (
            <Link key={id} href={`/products/${id}`} className="rounded bg-muted px-1.5 py-0.5 hover:underline">
              {insight.productNames[i]}
            </Link>
          ))}
        </div>
      ) : null}
      {insight.sampleSnippets.length > 0 ? (
        <ul className="space-y-1 border-t pt-3">
          {insight.sampleSnippets.map((snippet) => (
            <li key={snippet} dir="auto" className="text-xs text-muted-foreground italic">
              “{snippet}”
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

export function InsightCards({ insights }: { insights: CampaignInsightDTO[] }) {
  if (insights.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No campaign insights yet. Capture reviews across stores, then return here for conquest, strength and review-gap
        ideas.
      </p>
    );
  }

  const grouped = TYPE_ORDER.map((type) => ({
    type,
    label: TYPE_META[type].label,
    items: insights.filter((i) => i.type === type),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-8">
      {grouped.map((group) => (
        <section key={group.type} className="space-y-3">
          <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
            {group.label} · {group.items.length}
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {group.items.map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
