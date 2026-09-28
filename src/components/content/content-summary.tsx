import { CircleCheck, CircleX, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ContentCheckStatus, ProductContentAnalysisDTO } from "@/types/dto";

const CHECK_STYLES: Record<ContentCheckStatus, { icon: LucideIcon; className: string; label: string }> = {
  fail: { icon: CircleX, className: "text-rose-600 dark:text-rose-400", label: "Fix" },
  warn: { icon: TriangleAlert, className: "text-amber-600 dark:text-amber-400", label: "Improve" },
  pass: { icon: CircleCheck, className: "text-emerald-600 dark:text-emerald-400", label: "Good" },
  info: { icon: Info, className: "text-muted-foreground", label: "Note" },
};

const STATUS_ORDER: Record<ContentCheckStatus, number> = { fail: 0, warn: 1, info: 2, pass: 3 };

function scoreTone(score: number) {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}

function Metric({ label, own, market }: { label: string; own: number | null | undefined; market: number | null }) {
  const fmt = (v: number | null | undefined) => (v === null || v === undefined ? "—" : String(Math.round(v)));
  const behind = own !== null && own !== undefined && market !== null && own < market;
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">{label}</p>
      <p className={cn("text-xl font-semibold tabular-nums", behind && "text-amber-600 dark:text-amber-400")}>{fmt(own)}</p>
      <p className="text-xs text-muted-foreground">Competitor median {fmt(market)}</p>
    </div>
  );
}

export function ContentSummary({ analysis }: { analysis: ProductContentAnalysisDTO }) {
  const { benchmark, score } = analysis;
  const checks = [...analysis.checks].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="grid grid-cols-2 gap-6 md:grid-cols-3 xl:grid-cols-6">
          <div className="space-y-1">
            <p className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">Content score</p>
            <p className={cn("text-xl font-semibold tabular-nums", score !== null && scoreTone(score))}>
              {score === null ? "—" : `${score}/100`}
            </p>
            <p className="text-xs text-muted-foreground">Share of checks passed</p>
          </div>
          <Metric label="Description words" own={benchmark.own?.descriptionWords} market={benchmark.competitorMedian.descriptionWords} />
          <Metric label="Subheadings (H2)" own={benchmark.own?.h2Count} market={benchmark.competitorMedian.h2Count} />
          <Metric label="Bullet points" own={benchmark.own?.bulletCount} market={benchmark.competitorMedian.bulletCount} />
          <Metric label="FAQ questions" own={benchmark.own?.faqCount} market={benchmark.competitorMedian.faqCount} />
          <div className="space-y-1">
            <p className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">Pages analyzed</p>
            <p className="text-xl font-semibold tabular-nums">
              {analysis.competitorPagesCaptured}
              <span className="text-base font-normal text-muted-foreground"> / {analysis.competitorCount}</span>
            </p>
            <p className="text-xs text-muted-foreground">Competitor pages with content</p>
          </div>
        </CardContent>
      </Card>

      {checks.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>SEO checklist</CardTitle>
            <CardDescription>Your product page against search basics and what competitors do.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {checks.map((check) => {
                const style = CHECK_STYLES[check.status];
                const Icon = style.icon;
                return (
                  <li key={check.id} className="flex items-start gap-3 py-2.5">
                    <Icon className={cn("mt-0.5 size-4 shrink-0", style.className)} aria-label={style.label} />
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-sm font-medium">{check.label}</p>
                      <p className="text-sm text-muted-foreground">{check.message}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
