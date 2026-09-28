"use client";

import { AlertTriangle, CheckCircle2, Clock, ExternalLink, Loader2, RotateCw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { GapValue } from "@/components/pricing/position-badge";
import { cn } from "@/lib/utils";
import type { Availability } from "@/types";
import type { CompetitorComparisonRowDTO } from "@/types/dto";
import { formatDateTime, formatMoney, formatRelativeTime } from "@/utils/format";
import { usePriceRefresh } from "./use-price-refresh";

const AVAILABILITY_LABELS: Record<Availability, { label: string; className: string }> = {
  in_stock: { label: "In stock", className: "text-emerald-700 dark:text-emerald-400" },
  limited: { label: "Limited", className: "text-amber-700 dark:text-amber-400" },
  preorder: { label: "Pre-order", className: "text-sky-700 dark:text-sky-400" },
  out_of_stock: { label: "Out of stock", className: "text-rose-700 dark:text-rose-400" },
  unknown: { label: "Unknown", className: "text-muted-foreground" },
};

function StatusLine({ row }: { row: CompetitorComparisonRowDTO }) {
  if (row.scrapingStatus === "pending") {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="size-3.5" /> Not checked yet
      </span>
    );
  }
  if (row.scrapingStatus === "failed") {
    return (
      <span className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
        <AlertTriangle className="size-3.5 shrink-0" /> {row.error}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
      <CheckCircle2 className="size-3.5" /> Price found: {formatMoney(row.price, row.currency)}
    </span>
  );
}

export function CompetitorTable({
  productId,
  rows,
  allowRetry = true,
}: {
  productId: string;
  rows: CompetitorComparisonRowDTO[];
  allowRetry?: boolean;
}) {
  const { refresh, pending } = usePriceRefresh(productId);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Retailer</TableHead>
          <TableHead className="text-right">Price</TableHead>
          <TableHead className="text-right">Difference</TableHead>
          <TableHead>Availability</TableHead>
          <TableHead>Last Checked</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const availability = row.availability ? AVAILABILITY_LABELS[row.availability] : null;
          const retrying = pending === row.sourceId;
          return (
            <TableRow key={row.sourceId} className={cn(row.isOwnStore && "bg-muted/40")}>
              <TableCell className="max-w-72">
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">
                    {row.isOwnStore ? "My Store" : row.retailerName}
                    {row.isOwnStore ? <span className="ml-1.5 text-xs text-muted-foreground">({row.retailerName})</span> : null}
                  </span>
                  <StatusLine row={row} />
                  {row.exclusion ? <span className="text-xs text-muted-foreground">{row.exclusion}</span> : null}
                  {row.note ? <span className="text-xs text-muted-foreground">{row.note}</span> : null}
                </div>
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums">{formatMoney(row.price, row.currency)}</TableCell>
              <TableCell className="text-right">
                {row.isOwnStore ? <span className="text-muted-foreground">—</span> : <GapValue value={row.differencePercentage} />}
              </TableCell>
              <TableCell>
                {availability ? <span className={cn("text-sm", availability.className)}>{availability.label}</span> : "—"}
              </TableCell>
              <TableCell>
                <Tooltip>
                  <TooltipTrigger render={<span className="text-sm text-muted-foreground" suppressHydrationWarning />}>
                    {formatRelativeTime(row.lastCheckedAt)}
                  </TooltipTrigger>
                  <TooltipContent>{formatDateTime(row.lastCheckedAt)}</TooltipContent>
                </Tooltip>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1.5">
                  {allowRetry && row.scrapingStatus === "failed" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending !== null}
                      onClick={() => refresh([row.sourceId])}
                    >
                      {retrying ? <Loader2 className="animate-spin" /> : <RotateCw />} Retry
                    </Button>
                  ) : null}
                  <a
                    href={row.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    aria-label="Open Store"
                    title={row.url}
                    className={buttonVariants({ size: "sm", variant: "ghost" })}
                  >
                    <ExternalLink /> <span className="hidden xl:inline">Open Store</span>
                  </a>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
