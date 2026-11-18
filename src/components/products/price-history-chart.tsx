"use client";

import { useMemo, useState, type Key } from "react";
import { Loader2 } from "lucide-react";
import {
  Brush,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { StoreLogo } from "@/components/matrix/store-logo";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { HISTORY_RANGES, type HistoryRange } from "@/types";
import type { HistorySeriesDTO } from "@/types/dto";
import { formatMoney, formatPercent } from "@/utils/format";

const RANGE_LABELS: Record<HistoryRange, string> = {
  "7d": "7 days",
  "30d": "30 days",
  "90d": "90 days",
  "6m": "6 months",
  "1y": "1 year",
};

type ViewMode = "price" | "vsOwn";

const OWN_COLOR = "#0f172a";
const PALETTE = ["#2563eb", "#16a34a", "#db2777", "#ea580c", "#7c3aed", "#0891b2", "#ca8a04", "#dc2626", "#4f46e5", "#059669"];

interface ChartRow {
  t: number;
  [sourceId: string]: number;
}

const RANGE_DAYS: Record<HistoryRange, number> = { "7d": 7, "30d": 30, "90d": 90, "6m": 182, "1y": 365 };
const DAY_MS = 24 * 60 * 60 * 1000;

/** Start of local calendar day for `ms`. */
function startOfLocalDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Fixed chart window for the selected range.
 * 7d uses a calendar-aligned window (today + 6 previous midnights) so the axis stays day-stable.
 */
function rangeWindow(range: HistoryRange, now: number): { start: number; end: number; ticks: number[] } {
  if (range === "7d") {
    const end = now;
    const start = startOfLocalDay(now) - 6 * DAY_MS;
    const ticks = Array.from({ length: 7 }, (_, i) => start + i * DAY_MS);
    return { start, end, ticks };
  }

  const end = now;
  const start = now - RANGE_DAYS[range] * DAY_MS;
  const ticks = Array.from({ length: 6 }, (_, k) => start + ((end - start) * k) / 5);
  return { start, end, ticks };
}

/**
 * Builds chart rows for `[domainStart, now]`.
 * Pre-window points seed the left edge (price holds); each source's latest price is carried to `now`.
 */
function toRows(series: HistorySeriesDTO[], now: number, domainStart: number): ChartRow[] {
  const byTime = new Map<number, ChartRow>();
  const head: ChartRow = { t: domainStart };
  const tail: ChartRow = { t: now };
  let hasHead = false;

  for (const s of series) {
    let seed: number | undefined;
    let lastInWindow: number | undefined;

    for (const p of s.points) {
      const t = new Date(p.scrapedAt).getTime();
      if (t < domainStart) {
        seed = p.price;
        continue;
      }
      if (t > now) continue;
      const row = byTime.get(t) ?? { t };
      row[s.sourceId] = p.price;
      byTime.set(t, row);
      lastInWindow = p.price;
    }

    if (seed != null) {
      head[s.sourceId] = seed;
      hasHead = true;
    }
    const hold = lastInWindow ?? seed;
    if (hold != null) tail[s.sourceId] = hold;
  }

  const rows = [...byTime.values()].sort((a, b) => a.t - b.t);
  if (hasHead && (rows.length === 0 || rows[0].t > domainStart)) rows.unshift(head);
  if (rows.length > 0 && rows[rows.length - 1].t < now) rows.push(tail);
  return rows;
}

/** Transforms absolute prices into % difference vs the own-store series at each timestamp. */
function toVsOwnRows(rows: ChartRow[], ownSourceId: string): ChartRow[] {
  return rows.map((row) => {
    const own = row[ownSourceId];
    if (own == null || own === 0) return { t: row.t };
    const out: ChartRow = { t: row.t };
    for (const [key, value] of Object.entries(row)) {
      if (key === "t" || key === ownSourceId) continue;
      if (typeof value === "number") out[key] = ((value - own) / own) * 100;
    }
    out[ownSourceId] = 0;
    return out;
  });
}

function storeLabel(s: HistorySeriesDTO): string {
  return s.isOwnStore ? "My Store" : s.retailerName;
}

type HistoryTooltipProps = TooltipContentProps<number, string> & {
  series: HistorySeriesDTO[];
  colors: Map<string, string>;
  hidden: Set<string>;
  mode: ViewMode;
  currency: string | null;
  ownSourceId: string | null;
};

function HistoryTooltip({
  active,
  label,
  payload,
  series,
  colors,
  hidden,
  mode,
  currency,
  ownSourceId,
}: HistoryTooltipProps) {
  if (!active || !payload?.length) return null;

  const items = payload
    .filter((p) => p.dataKey != null && !hidden.has(String(p.dataKey)) && typeof p.value === "number")
    .map((p) => {
      const sourceId = String(p.dataKey);
      const s = series.find((x) => x.sourceId === sourceId);
      return {
        sourceId,
        label: s ? storeLabel(s) : sourceId,
        value: Number(p.value),
        color: colors.get(sourceId) ?? "#64748b",
        isOwn: s?.isOwnStore ?? false,
      };
    })
    .sort((a, b) => a.value - b.value);

  if (items.length === 0) return null;

  const ownItem = ownSourceId ? items.find((i) => i.sourceId === ownSourceId) : undefined;
  const ownValue = ownItem?.value;
  const cheapestId = mode === "price" ? items[0]?.sourceId : null;

  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-md">
      <p className="mb-1.5 font-medium text-foreground">
        {new Date(Number(label)).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
      </p>
      <ul className="space-y-1">
        {items.map((item) => {
          const vsOwn =
            mode === "price" && ownValue != null && ownValue !== 0 && !item.isOwn
              ? ((item.value - ownValue) / ownValue) * 100
              : null;
          return (
            <li
              key={item.sourceId}
              className={cn("flex items-center gap-2", item.sourceId === cheapestId && "font-semibold")}
            >
              <span className="size-2 shrink-0 rounded-full" style={{ background: item.color }} />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              <span className="tabular-nums">
                {mode === "vsOwn" ? formatPercent(item.value) : formatMoney(item.value, currency)}
              </span>
              {vsOwn != null ? (
                <span className="w-14 text-right tabular-nums text-muted-foreground">{formatPercent(vsOwn)}</span>
              ) : null}
              {item.sourceId === cheapestId ? (
                <span className="rounded bg-emerald-500/15 px-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                  low
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function PriceHistoryChart({
  productId,
  initialSeries,
  initialRange = "30d",
  currency,
}: {
  productId: string;
  initialSeries: HistorySeriesDTO[];
  initialRange?: HistoryRange;
  currency: string | null;
}) {
  const [range, setRange] = useState<HistoryRange>(initialRange);
  const [series, setSeries] = useState(initialSeries);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [focused, setFocused] = useState<string | null>(null);
  const [mode, setMode] = useState<ViewMode>("price");
  const [brushing, setBrushing] = useState(false);

  const [now, setNow] = useState(() => Date.now());
  const { start: domainStart, end: domainEnd, ticks: domainTicks } = useMemo(
    () => rangeWindow(range, now),
    [range, now],
  );
  const priceRows = useMemo(() => toRows(series, domainEnd, domainStart), [series, domainEnd, domainStart]);
  const withData = useMemo(
    () => series.filter((s) => s.points.some((p) => new Date(p.scrapedAt).getTime() <= domainEnd)),
    [series, domainEnd],
  );
  const ownSeries = withData.find((s) => s.isOwnStore) ?? null;
  const ownSourceId = ownSeries?.sourceId ?? null;

  const colors = useMemo(() => {
    const map = new Map<string, string>();
    withData.forEach((s, i) => {
      map.set(s.sourceId, s.isOwnStore ? OWN_COLOR : PALETTE[i % PALETTE.length]);
    });
    return map;
  }, [withData]);

  const rows = useMemo(() => {
    if (mode === "vsOwn" && ownSourceId) return toVsOwnRows(priceRows, ownSourceId);
    return priceRows;
  }, [mode, ownSourceId, priceRows]);

  const activeSeries = withData.filter((s) => !hidden.has(s.sourceId));
  // Count only in-window observations for the dot threshold (exclude carry-in seeds).
  const observationCount = activeSeries.reduce(
    (sum, s) => sum + s.points.filter((p) => new Date(p.scrapedAt).getTime() >= domainStart).length,
    0,
  );
  const shortDate = range === "7d" || range === "30d";
  const allHidden = withData.length > 0 && activeSeries.length === 0;
  const showBrush = rows.length >= 3;

  const latestPrice = (s: HistorySeriesDTO) => s.points.at(-1)?.price ?? null;

  function formatXTick(t: number) {
    return new Date(t).toLocaleDateString(
      "en-US",
      shortDate ? { month: "short", day: "numeric" } : { month: "short", year: "2-digit" },
    );
  }

  function toggleStore(sourceId: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(sourceId)) next.delete(sourceId);
      else next.add(sourceId);
      return next;
    });
  }

  function onlyStore(sourceId: string) {
    setHidden(new Set(withData.filter((s) => s.sourceId !== sourceId).map((s) => s.sourceId)));
  }

  function showAll() {
    setHidden(new Set());
  }

  function hideAll() {
    setHidden(new Set(withData.map((s) => s.sourceId)));
  }

  function competitorsOnly() {
    if (!ownSourceId) return;
    setHidden(new Set([ownSourceId]));
  }

  async function changeRange(next: HistoryRange) {
    setRange(next);
    setLoading(true);
    setError(null);
    setBrushing(false);
    try {
      setSeries(await apiFetch<HistorySeriesDTO[]>(`/api/products/${productId}/history?range=${next}`));
      setNow(Date.now());
    } catch {
      setError("Could not load price history.");
    } finally {
      setLoading(false);
    }
  }

  function changeMode(next: ViewMode) {
    if (next === "vsOwn" && !ownSourceId) return;
    setMode(next);
  }

  const yTickFormatter = (v: number) => (mode === "vsOwn" ? formatPercent(v, 0) : formatMoney(v, currency));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={range} onValueChange={(v) => changeRange(v as HistoryRange)}>
            <TabsList>
              {HISTORY_RANGES.map((r) => (
                <TabsTrigger key={r} value={r}>
                  {RANGE_LABELS[r]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Tabs value={mode} onValueChange={(v) => changeMode(v as ViewMode)}>
            <TabsList>
              <TabsTrigger value="price">Price</TabsTrigger>
              <TabsTrigger value="vsOwn" disabled={!ownSourceId}>
                vs My Store
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        {loading ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {withData.length > 0 ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Button type="button" variant="ghost" size="xs" onClick={showAll} disabled={hidden.size === 0}>
              Show all
            </Button>
            <Button type="button" variant="ghost" size="xs" onClick={hideAll} disabled={allHidden}>
              Hide all
            </Button>
            {ownSourceId ? (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={competitorsOnly}
                disabled={hidden.size === 1 && hidden.has(ownSourceId)}
              >
                Competitors only
              </Button>
            ) : null}
          </div>
          <ul className="flex flex-wrap gap-1.5">
            {withData.map((s) => {
              const isHidden = hidden.has(s.sourceId);
              const color = colors.get(s.sourceId) ?? "#64748b";
              const price = latestPrice(s);
              return (
                <li key={s.sourceId}>
                  <div
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs transition-opacity",
                      isHidden ? "border-dashed opacity-45" : "bg-muted/40",
                      focused === s.sourceId && !isHidden && "ring-2 ring-ring/40",
                    )}
                    onMouseEnter={() => setFocused(s.sourceId)}
                    onMouseLeave={() => setFocused(null)}
                  >
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5"
                      onClick={() => toggleStore(s.sourceId)}
                      aria-pressed={!isHidden}
                      title={isHidden ? `Show ${storeLabel(s)}` : `Hide ${storeLabel(s)}`}
                    >
                      <span className="size-2 shrink-0 rounded-full" style={{ background: color }} />
                      <StoreLogo name={s.retailerName} domain={s.domain} size="sm" />
                      <span className="font-medium">{storeLabel(s)}</span>
                      {price != null ? (
                        <span className="tabular-nums text-muted-foreground">{formatMoney(price, currency)}</span>
                      ) : null}
                    </button>
                    <button
                      type="button"
                      className="rounded px-1 text-[10px] font-medium text-muted-foreground hover:bg-background hover:text-foreground"
                      onClick={() => onlyStore(s.sourceId)}
                      title={`Show only ${storeLabel(s)}`}
                    >
                      Only
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="flex h-72 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
          No price observations in this period yet.
        </div>
      ) : allHidden ? (
        <div className="flex h-72 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
          Select at least one store.
        </div>
      ) : (
        <div className="h-96 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={brushing && showBrush ? ["dataMin", "dataMax"] : [domainStart, domainEnd]}
                ticks={brushing && showBrush ? undefined : domainTicks}
                allowDataOverflow
                tickFormatter={formatXTick}
                tick={{ fontSize: 12 }}
                stroke="currentColor"
                className="text-muted-foreground"
                minTickGap={range === "7d" ? 8 : 5}
              />
              <YAxis
                width={mode === "vsOwn" ? 56 : 72}
                tick={{ fontSize: 12 }}
                domain={[(dataMin: number) => dataMin - Math.abs(dataMin) * 0.02, (dataMax: number) => dataMax + Math.abs(dataMax) * 0.02]}
                tickFormatter={yTickFormatter}
                stroke="currentColor"
                className="text-muted-foreground"
              />
              <Tooltip
                content={(props) => (
                  <HistoryTooltip
                    {...(props as TooltipContentProps<number, string>)}
                    series={series}
                    colors={colors}
                    hidden={hidden}
                    mode={mode}
                    currency={currency}
                    ownSourceId={ownSourceId}
                  />
                )}
              />
              {mode === "vsOwn" ? <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 4" /> : null}
              {withData.map((s) => {
                const color = colors.get(s.sourceId) ?? "#64748b";
                const isFocused = focused === s.sourceId;
                const dimmed = focused != null && !isFocused;
                const baseWidth = s.isOwnStore ? 2.5 : 1.5;
                return (
                  <Line
                    key={s.sourceId}
                    dataKey={s.sourceId}
                    name={s.sourceId}
                    type="stepAfter"
                    stroke={color}
                    strokeWidth={isFocused ? baseWidth + 1.5 : baseWidth}
                    strokeOpacity={dimmed ? 0.2 : 1}
                    hide={hidden.has(s.sourceId)}
                    onMouseEnter={() => setFocused(s.sourceId)}
                    onMouseLeave={() => setFocused(null)}
                    dot={
                      observationCount < 40
                        ? ({ cx, cy, payload, key }: { cx?: number; cy?: number; payload?: ChartRow; key?: Key | null }) =>
                            payload?.t === domainEnd || payload?.t === domainStart || cx == null || cy == null ? (
                              <g key={key ?? undefined} />
                            ) : (
                              <circle
                                key={key ?? undefined}
                                cx={cx}
                                cy={cy}
                                r={isFocused ? 3.5 : 2.5}
                                fill="var(--background)"
                                stroke={color}
                                strokeWidth={1.5}
                                strokeOpacity={dimmed ? 0.2 : 1}
                              />
                            )
                        : false
                    }
                    connectNulls
                    isAnimationActive={false}
                  />
                );
              })}
              {showBrush ? (
                <Brush
                  key={`brush-${range}-${domainStart}`}
                  dataKey="t"
                  height={24}
                  travellerWidth={8}
                  tickFormatter={formatXTick}
                  onChange={(brushRange) => {
                    const start = brushRange?.startIndex;
                    const end = brushRange?.endIndex;
                    setBrushing(start != null && end != null && !(start === 0 && end === rows.length - 1));
                  }}
                />
              ) : null}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
