import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { StoreReviewSummaryDTO } from "@/types/dto";

function SentimentBar({
  positive,
  neutral,
  negative,
  total,
}: {
  positive: number;
  neutral: number;
  negative: number;
  total: number;
}) {
  if (total === 0) return <span className="text-muted-foreground">—</span>;
  const p = (positive / total) * 100;
  const n = (neutral / total) * 100;
  const neg = (negative / total) * 100;
  return (
    <div className="flex h-2 w-28 overflow-hidden rounded-full bg-muted" title={`${positive}+ / ${neutral}~ / ${negative}−`}>
      <div className="bg-emerald-500" style={{ width: `${p}%` }} />
      <div className="bg-slate-400" style={{ width: `${n}%` }} />
      <div className="bg-rose-500" style={{ width: `${neg}%` }} />
    </div>
  );
}

function ThemeChips({
  items,
  tone,
}: {
  items: { label: string }[];
  tone: "positive" | "negative";
}) {
  if (items.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item) => (
        <span
          key={item.label}
          className={cn(
            "rounded px-1.5 py-0.5 text-xs",
            tone === "positive"
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "bg-rose-500/10 text-rose-700 dark:text-rose-300",
          )}
        >
          {item.label}
        </span>
      ))}
    </div>
  );
}

export function StoreSentimentTable({ stores }: { stores: StoreReviewSummaryDTO[] }) {
  if (stores.length === 0) {
    return <p className="text-sm text-muted-foreground">No store reviews captured yet.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Store</TableHead>
          <TableHead className="text-right">Reviews</TableHead>
          <TableHead className="text-right">Avg rating</TableHead>
          <TableHead>Sentiment</TableHead>
          <TableHead className="text-right">Positive</TableHead>
          <TableHead>Praised</TableHead>
          <TableHead>Complained</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {stores.map((store) => (
          <TableRow key={store.retailerId} className={cn(store.isOwnStore && "bg-muted/40")}>
            <TableCell>
              <div className="font-medium">
                {store.retailerName}
                {store.isOwnStore ? (
                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">You</span>
                ) : null}
              </div>
              <div className="text-xs text-muted-foreground">{store.domain}</div>
            </TableCell>
            <TableCell className="text-right tabular-nums">{store.reviewCount}</TableCell>
            <TableCell className="text-right tabular-nums">
              {store.averageRating != null ? store.averageRating.toFixed(1) : "—"}
            </TableCell>
            <TableCell>
              <SentimentBar
                positive={store.sentiment.positive}
                neutral={store.sentiment.neutral}
                negative={store.sentiment.negative}
                total={store.reviewCount}
              />
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {store.positivePercentage != null ? `${store.positivePercentage}%` : "—"}
            </TableCell>
            <TableCell>
              <ThemeChips items={store.topPraised} tone="positive" />
            </TableCell>
            <TableCell>
              <ThemeChips items={store.topComplained} tone="negative" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
