import Link from "next/link";
import { SortHeader, type SortOrder } from "@/components/layout/sort-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CONTENT_SCORE_THRESHOLDS } from "@/lib/services/content/content-overview.service";
import { cn } from "@/lib/utils";
import type { ContentSortField } from "@/lib/validation/content.schema";
import type { ContentOverviewRowDTO } from "@/types/dto";
import { formatDateTime, formatRelativeTime } from "@/utils/format";

/** Score starts worst-first and description shortest-first; counts and dates start with the largest. */
export function defaultContentOrderFor(field: ContentSortField): SortOrder {
  return field === "name" || field === "score" || field === "descriptionWords" ? "asc" : "desc";
}

function ScoreBadge({ row }: { row: ContentOverviewRowDTO }) {
  if (!row.ownPageCaptured || row.score === null) {
    return <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Not captured</span>;
  }
  const tone =
    row.score >= CONTENT_SCORE_THRESHOLDS.good
      ? "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300"
      : row.score >= CONTENT_SCORE_THRESHOLDS.fair
        ? "bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:text-amber-300"
        : "bg-rose-500/10 text-rose-700 ring-rose-500/20 dark:text-rose-300";
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ring-1 ring-inset", tone)}>
      {row.score}
    </span>
  );
}

function Chips({ items, max = 3, className }: { items: string[]; max?: number; className?: string }) {
  if (items.length === 0) return <span className="text-muted-foreground">—</span>;
  const shown = items.slice(0, max);
  return (
    <div className="flex flex-wrap gap-1" title={items.join(", ")}>
      {shown.map((item) => (
        <span key={item} dir="auto" className={cn("rounded bg-muted px-1.5 py-0.5 text-xs whitespace-nowrap", className)}>
          {item}
        </span>
      ))}
      {items.length > max ? <span className="text-xs text-muted-foreground">+{items.length - max}</span> : null}
    </div>
  );
}

export function ContentOverviewTable({
  rows,
  sort,
  order,
  hrefForSort,
}: {
  rows: ContentOverviewRowDTO[];
  sort: ContentSortField;
  order: SortOrder;
  hrefForSort: (field: ContentSortField, order: SortOrder) => string;
}) {
  const header = { sort, order, hrefForSort, defaultOrderFor: defaultContentOrderFor };
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <SortHeader field="name" label="Product" {...header} />
          <SortHeader field="score" label="Score" {...header} />
          <SortHeader field="issues" label="Issues" {...header} />
          <SortHeader field="missingKeywords" label="Missing Keywords" {...header} />
          <TableHead className="text-muted-foreground">Missing Facts</TableHead>
          <SortHeader field="descriptionWords" label="Description" align="right" {...header} />
          <SortHeader field="lastChange" label="Competitor Change" {...header} />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.productId}>
            <TableCell className="max-w-72">
              <Link href={`/products/${r.productId}?tab=content`} className="block truncate font-medium hover:underline">
                {r.name}
              </Link>
              <span className="text-xs text-muted-foreground">
                {[r.brand, r.size, `${r.competitorPagesCaptured}/${r.competitorCount} competitor pages`].filter(Boolean).join(" · ")}
              </span>
            </TableCell>
            <TableCell>
              <ScoreBadge row={r} />
            </TableCell>
            <TableCell className="max-w-56">
              {r.ownPageCaptured ? (
                r.failedChecks + r.warningChecks === 0 ? (
                  <span className="text-sm text-emerald-700 dark:text-emerald-400">None</span>
                ) : (
                  <div className="space-y-0.5" title={r.issueLabels.join(", ")}>
                    <p className="text-sm tabular-nums">
                      {r.failedChecks > 0 ? <span className="text-rose-600 dark:text-rose-400">{r.failedChecks} fix</span> : null}
                      {r.failedChecks > 0 && r.warningChecks > 0 ? <span className="text-muted-foreground"> · </span> : null}
                      {r.warningChecks > 0 ? <span className="text-amber-600 dark:text-amber-400">{r.warningChecks} improve</span> : null}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{r.issueLabels.slice(0, 2).join(", ")}</p>
                  </div>
                )
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell className="max-w-64">
              {r.ownPageCaptured ? (
                <div className="flex items-start gap-2">
                  <span className="pt-0.5 text-sm font-medium tabular-nums">{r.missingKeywordCount}</span>
                  <Chips items={r.topMissingKeywords} />
                </div>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell className="max-w-56">
              <Chips items={r.missingFacts} max={2} className="bg-amber-500/10 text-amber-800 dark:text-amber-300" />
            </TableCell>
            <TableCell className="text-right">
              <p
                className={cn(
                  "text-sm tabular-nums",
                  r.descriptionWords !== null &&
                    r.competitorMedianWords !== null &&
                    r.descriptionWords < r.competitorMedianWords * 0.5 &&
                    "text-amber-600 dark:text-amber-400",
                )}
              >
                {r.descriptionWords === null ? "—" : `${r.descriptionWords} words`}
              </p>
              <p className="text-xs text-muted-foreground">
                median {r.competitorMedianWords === null ? "—" : Math.round(r.competitorMedianWords)}
              </p>
            </TableCell>
            <TableCell>
              {r.lastCompetitorChange ? (
                <div className="space-y-0.5">
                  <p className="text-sm" title={formatDateTime(r.lastCompetitorChange.at)} suppressHydrationWarning>
                    {formatRelativeTime(r.lastCompetitorChange.at)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{r.lastCompetitorChange.retailerName}</p>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">No changes</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
