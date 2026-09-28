import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { RetailerWithStatsDTO } from "@/types/dto";
import { formatDateTime, formatRelativeTime } from "@/utils/format";
import { DeleteRetailerButton } from "./delete-retailer-button";
import { RetailerFormDialog } from "./retailer-form-dialog";

const STATUS_META: Record<RetailerWithStatsDTO["status"], { label: string; dot: string; hint: string }> = {
  healthy: { label: "Healthy", dot: "bg-emerald-500", hint: "All prices extracted on the last check" },
  degraded: { label: "Degraded", dot: "bg-amber-500", hint: "Some product URLs failed on the last check" },
  failing: { label: "Failing", dot: "bg-rose-500", hint: "Every product URL failed on the last check" },
  idle: { label: "Not checked", dot: "bg-muted-foreground/40", hint: "No price checks yet" },
};

export function RetailersTable({ retailers }: { retailers: RetailerWithStatsDTO[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Retailer</TableHead>
          <TableHead>Domain</TableHead>
          <TableHead className="text-right">Products monitored</TableHead>
          <TableHead>Last scrape</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {retailers.map((r) => {
          const status = STATUS_META[r.status];
          return (
            <TableRow key={r.id}>
              <TableCell className="font-medium">
                {r.name}
                {r.isOwnStore ? (
                  <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">My store</span>
                ) : null}
              </TableCell>
              <TableCell>
                <a
                  href={`https://${r.domain}`}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="text-muted-foreground hover:text-foreground hover:underline"
                >
                  {r.domain}
                </a>
              </TableCell>
              <TableCell className="text-right tabular-nums">{r.productsMonitored}</TableCell>
              <TableCell className="text-muted-foreground" title={formatDateTime(r.lastScrapedAt)}>
                {formatRelativeTime(r.lastScrapedAt)}
              </TableCell>
              <TableCell>
                <span className="inline-flex items-center gap-1.5 text-sm" title={status.hint}>
                  <span className={cn("size-2 rounded-full", status.dot)} />
                  {status.label}
                  {r.failedSources > 0 ? (
                    <span className="text-xs text-muted-foreground">({r.failedSources} failed)</span>
                  ) : null}
                </span>
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <RetailerFormDialog
                    retailer={r}
                    trigger={
                      <Button variant="ghost" size="icon-sm" aria-label={`Edit ${r.name}`}>
                        <Pencil />
                      </Button>
                    }
                  />
                  <DeleteRetailerButton
                    retailerId={r.id}
                    retailerName={r.name}
                    productsMonitored={r.productsMonitored}
                    isOwnStore={r.isOwnStore}
                  />
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
