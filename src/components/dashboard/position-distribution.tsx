import { PRICE_POSITION_LABELS } from "@/lib/services/pricing/price-position";
import { cn } from "@/lib/utils";
import { PRICE_POSITIONS, type PricePosition } from "@/types";

const BAR_COLORS: Record<PricePosition, string> = {
  UNDERPRICED: "bg-sky-500",
  SLIGHTLY_UNDERPRICED: "bg-cyan-400",
  MARKET_ALIGNED: "bg-emerald-500",
  SLIGHTLY_OVERPRICED: "bg-amber-400",
  OVERPRICED: "bg-rose-500",
};

export function PositionDistribution({ counts }: { counts: Record<PricePosition, number> }) {
  const total = PRICE_POSITIONS.reduce((sum, p) => sum + counts[p], 0);
  if (total === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label="Price position distribution">
        {PRICE_POSITIONS.map((p) =>
          counts[p] > 0 ? (
            <div key={p} className={cn("h-full", BAR_COLORS[p])} style={{ width: `${(counts[p] / total) * 100}%` }} />
          ) : null,
        )}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        {PRICE_POSITIONS.map((p) => (
          <li key={p} className="flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", BAR_COLORS[p])} />
            {PRICE_POSITION_LABELS[p]}
            <span className="font-medium text-foreground tabular-nums">{counts[p]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
