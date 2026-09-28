import Link from "next/link";
import { AlertTriangle, Clock } from "lucide-react";
import { GapValue, PositionBadge } from "@/components/pricing/position-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { PriceMatrixCellDTO, PriceMatrixColumnDTO, PriceMatrixRowDTO } from "@/types/dto";
import { formatAmount, formatDateTime } from "@/utils/format";

function cellTitle(cell: PriceMatrixCellDTO, storeName: string): string {
  const lines = [storeName];
  if (cell.state === "stale") lines.push(`Last check failed: ${cell.error}`, `Showing the price from ${formatDateTime(cell.observedAt)}`);
  else if (cell.state === "failed") lines.push(`Price check failed: ${cell.error}`);
  else if (cell.state === "pending") lines.push("Not checked yet. Refresh the product to fetch a price.");
  else if (cell.observedAt) lines.push(`${cell.isManual ? "Entered manually" : "Checked"} ${formatDateTime(cell.observedAt)}`);
  if (cell.isLowest) lines.push("Lowest in-stock price for this product");
  lines.push(cell.url);
  return lines.join("\n");
}

function Difference({ value }: { value: number | null }) {
  if (value === null) return null;
  if (value === 0) return <span className="text-xs text-muted-foreground">Same as you</span>;
  return (
    <span
      className={cn(
        "text-xs tabular-nums",
        value < 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400",
      )}
    >
      {value > 0 ? "+" : ""}
      {value.toFixed(1)}%
    </span>
  );
}

function PriceCell({ cell, store, rowCurrency }: { cell: PriceMatrixCellDTO | undefined; store: PriceMatrixColumnDTO; rowCurrency: string | null }) {
  if (!cell) {
    return (
      <span className="block px-2 py-1 text-muted-foreground/60" title={`Not tracked at ${store.name}`}>
        —
      </span>
    );
  }

  const currencySuffix = cell.currency && rowCurrency && cell.currency !== rowCurrency ? ` ${cell.currency}` : "";
  let body;
  if (cell.state === "pending") {
    body = (
      <span className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
        <Clock className="size-3.5" /> Not checked
      </span>
    );
  } else if (cell.state === "failed") {
    body = (
      <span className="flex items-center justify-end gap-1 text-xs text-amber-700 dark:text-amber-400">
        <AlertTriangle className="size-3.5" /> Failed
      </span>
    );
  } else if (cell.state === "out_of_stock") {
    body = (
      <>
        <span className="block text-xs font-medium text-rose-700 dark:text-rose-400">Out of stock</span>
        {cell.price !== null ? (
          <span className="text-xs text-muted-foreground tabular-nums line-through">{formatAmount(cell.price)}</span>
        ) : null}
      </>
    );
  } else {
    const stale = cell.state === "stale";
    body = (
      <>
        <span className={cn("flex items-center justify-end gap-1 font-medium tabular-nums", stale && "text-muted-foreground")}>
          {stale ? <AlertTriangle className="size-3.5 text-amber-600 dark:text-amber-400" aria-label="Last check failed" /> : null}
          {formatAmount(cell.price)}
          {currencySuffix}
        </span>
        {store.isOwnStore ? (
          cell.isLowest ? <span className="text-xs text-emerald-700 dark:text-emerald-400">Lowest</span> : null
        ) : (
          <Difference value={cell.differencePercentage} />
        )}
      </>
    );
  }

  return (
    <a
      href={cell.url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      title={cellTitle(cell, store.name)}
      className={cn(
        "flex min-h-11 flex-col items-end justify-center rounded-md px-2 py-1 transition-colors hover:bg-muted",
        cell.isLowest && "bg-emerald-500/10 ring-1 ring-emerald-500/30 ring-inset hover:bg-emerald-500/15",
      )}
    >
      {body}
    </a>
  );
}

export function PriceMatrixTable({ columns, rows }: { columns: PriceMatrixColumnDTO[]; rows: PriceMatrixRowDTO[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="sticky left-0 z-10 min-w-52 bg-card">Product</TableHead>
          {columns.map((c) => (
            <TableHead key={c.retailerId} className={cn("text-right", c.isOwnStore && "bg-muted/60")} title={c.domain}>
              <span className="block">{c.name}</span>
              <span className="block text-xs font-normal text-muted-foreground">
                {c.isOwnStore ? "Your price" : `${c.productCount} product${c.productCount === 1 ? "" : "s"}`}
              </span>
            </TableHead>
          ))}
          <TableHead>
            <span className="block">vs Market</span>
            <span className="block text-xs font-normal text-muted-foreground">Gap to median</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.productId} className="hover:bg-transparent">
            <TableCell className="sticky left-0 z-10 max-w-56 bg-card">
              <Link href={`/products/${row.productId}`} className="block truncate font-medium hover:underline" title={row.name}>
                {row.name}
              </Link>
              <span className="text-xs text-muted-foreground">
                {[row.brand, row.size, row.currency].filter(Boolean).join(" · ")}
                {row.isDemo ? " · Demo" : ""}
              </span>
            </TableCell>
            {columns.map((c) => (
              <TableCell key={c.retailerId} className={cn("p-1", c.isOwnStore && "bg-muted/40")}>
                <PriceCell cell={row.cells[c.retailerId]} store={c} rowCurrency={row.currency} />
              </TableCell>
            ))}
            <TableCell>
              <PositionBadge position={row.analysis?.position ?? null} />
              {row.analysis?.marketMedian !== null && row.analysis?.marketMedian !== undefined ? (
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  <GapValue value={row.analysis.gapPercentage} /> vs {formatAmount(row.analysis.marketMedian)}
                </span>
              ) : null}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
