import { PRICE_POSITION_LABELS } from "@/lib/services/pricing/price-position";
import { cn } from "@/lib/utils";
import type { PricePosition } from "@/types";

const POSITION_STYLES: Record<PricePosition, string> = {
  UNDERPRICED: "bg-sky-500/10 text-sky-700 ring-sky-500/20 dark:text-sky-300",
  SLIGHTLY_UNDERPRICED: "bg-cyan-500/10 text-cyan-700 ring-cyan-500/20 dark:text-cyan-300",
  MARKET_ALIGNED: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300",
  SLIGHTLY_OVERPRICED: "bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:text-amber-300",
  OVERPRICED: "bg-rose-500/10 text-rose-700 ring-rose-500/20 dark:text-rose-300",
};

export function PositionBadge({ position, className }: { position: PricePosition | null; className?: string }) {
  if (!position) {
    return (
      <span className={cn("inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground", className)}>
        Not compared
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
        POSITION_STYLES[position],
        className,
      )}
    >
      {PRICE_POSITION_LABELS[position]}
    </span>
  );
}

export function GapValue({ value, className }: { value: number | null; className?: string }) {
  if (value === null) return <span className={cn("text-muted-foreground", className)}>—</span>;
  const tone = value > 0 ? "text-rose-600 dark:text-rose-400" : value < 0 ? "text-sky-600 dark:text-sky-400" : "";
  return (
    <span className={cn("tabular-nums", tone, className)}>
      {value > 0 ? "+" : ""}
      {value.toFixed(2)}%
    </span>
  );
}
