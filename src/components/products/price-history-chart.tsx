"use client";

import { useMemo, useState, type Key } from "react";
import { Loader2 } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch } from "@/lib/api/client";
import { HISTORY_RANGES, type HistoryRange } from "@/types";
import type { HistorySeriesDTO } from "@/types/dto";
import { formatMoney } from "@/utils/format";

const RANGE_LABELS: Record<HistoryRange, string> = {
  "7d": "7 days",
  "30d": "30 days",
  "90d": "90 days",
  "6m": "6 months",
  "1y": "1 year",
};

const OWN_COLOR = "#0f172a";
const PALETTE = ["#2563eb", "#16a34a", "#db2777", "#ea580c", "#7c3aed", "#0891b2", "#ca8a04", "#dc2626", "#4f46e5", "#059669"];

interface ChartRow {
  t: number;
  [sourceId: string]: number;
}

const RANGE_DAYS: Record<HistoryRange, number> = { "7d": 7, "30d": 30, "90d": 90, "6m": 182, "1y": 365 };
const DAY_MS = 24 * 60 * 60 * 1000;

/** Builds chart rows and carries each source's latest price forward to `now` (a price holds until the next check). */
function toRows(series: HistorySeriesDTO[], now: number): ChartRow[] {
  const byTime = new Map<number, ChartRow>();
  const tail: ChartRow = { t: now };
  for (const s of series) {
    for (const p of s.points) {
      const t = new Date(p.scrapedAt).getTime();
      const row = byTime.get(t) ?? { t };
      row[s.sourceId] = p.price;
      byTime.set(t, row);
    }
    const last = s.points.at(-1);
    if (last) tail[s.sourceId] = last.price;
  }
  const rows = [...byTime.values()].sort((a, b) => a.t - b.t);
  if (rows.length > 0 && rows[rows.length - 1].t < now) rows.push(tail);
  return rows;
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

  const [now, setNow] = useState(() => Date.now());
  const rows = useMemo(() => toRows(series, now), [series, now]);
  const domainStart = now - RANGE_DAYS[range] * DAY_MS;
  const observationCount = series.reduce((sum, s) => sum + s.points.length, 0);
  const visible = series.filter((s) => s.points.length > 0);
  const colorFor = (s: HistorySeriesDTO, i: number) => (s.isOwnStore ? OWN_COLOR : PALETTE[i % PALETTE.length]);
  const shortDate = range === "7d" || range === "30d";

  async function changeRange(next: HistoryRange) {
    setRange(next);
    setLoading(true);
    setError(null);
    try {
      setSeries(await apiFetch<HistorySeriesDTO[]>(`/api/products/${productId}/history?range=${next}`));
      setNow(Date.now());
    } catch {
      setError("Could not load price history.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Tabs value={range} onValueChange={(v) => changeRange(v as HistoryRange)}>
          <TabsList>
            {HISTORY_RANGES.map((r) => (
              <TabsTrigger key={r} value={r}>
                {RANGE_LABELS[r]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {loading ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {rows.length === 0 ? (
        <div className="flex h-72 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
          No price observations in this period yet.
        </div>
      ) : (
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={[domainStart, now]}
                ticks={Array.from({ length: 6 }, (_, k) => domainStart + ((now - domainStart) * k) / 5)}
                allowDataOverflow
                tickFormatter={(t: number) =>
                  new Date(t).toLocaleDateString("en-US", shortDate ? { month: "short", day: "numeric" } : { month: "short", year: "2-digit" })
                }
                tick={{ fontSize: 12 }}
                stroke="currentColor"
                className="text-muted-foreground"
              />
              <YAxis
                width={72}
                tick={{ fontSize: 12 }}
                domain={["auto", "auto"]}
                tickFormatter={(v: number) => formatMoney(v, currency)}
                stroke="currentColor"
                className="text-muted-foreground"
              />
              <Tooltip
                labelFormatter={(t) => new Date(Number(t)).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                formatter={(value, name) => {
                  const s = series.find((x) => x.sourceId === name);
                  return [formatMoney(Number(value), currency), s ? (s.isOwnStore ? "My Store" : s.retailerName) : String(name)];
                }}
                contentStyle={{ borderRadius: 8, fontSize: 12 }}
              />
              <Legend
                formatter={(value) => {
                  const s = series.find((x) => x.sourceId === value);
                  return s ? (s.isOwnStore ? "My Store" : s.retailerName) : value;
                }}
                wrapperStyle={{ fontSize: 12 }}
              />
              {visible.map((s, i) => (
                <Line
                  key={s.sourceId}
                  dataKey={s.sourceId}
                  name={s.sourceId}
                  type="stepAfter"
                  stroke={colorFor(s, i)}
                  strokeWidth={s.isOwnStore ? 2.5 : 1.5}
                  dot={
                    observationCount < 40
                      ? ({ cx, cy, payload, key }: { cx?: number; cy?: number; payload?: ChartRow; key?: Key | null }) =>
                          payload?.t === now || cx == null || cy == null ? (
                            <g key={key ?? undefined} />
                          ) : (
                            <circle
                              key={key ?? undefined}
                              cx={cx}
                              cy={cy}
                              r={2.5}
                              fill="var(--background)"
                              stroke={colorFor(s, i)}
                              strokeWidth={1.5}
                            />
                          )
                      : false
                  }
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
