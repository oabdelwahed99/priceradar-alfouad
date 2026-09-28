import Link from "next/link";
import { cn } from "@/lib/utils";
import type { AlertDTO } from "@/types/dto";
import { formatDateTime, formatRelativeTime } from "@/utils/format";
import { AlertActions } from "./alert-actions";
import { ALERT_TYPE_META } from "./alert-meta";

export function AlertItem({ alert, compact = false }: { alert: AlertDTO; compact?: boolean }) {
  const meta = ALERT_TYPE_META[alert.type];
  const Icon = meta.icon;
  const isNew = alert.status === "new";

  return (
    <li
      className={cn(
        "flex gap-3 py-3",
        alert.status === "dismissed" && "opacity-60",
        !compact && "flex-col sm:flex-row sm:items-start",
      )}
    >
      <div className="flex min-w-0 flex-1 gap-3">
        <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-md", meta.className)}>
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 space-y-0.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{meta.label}</span>
            {isNew ? <span className="size-1.5 rounded-full bg-primary" aria-label="New" /> : null}
            <span className="text-xs text-muted-foreground" title={formatDateTime(alert.createdAt)}>
              {formatRelativeTime(alert.createdAt)}
            </span>
          </div>
          <p className={cn("text-sm", isNew && "font-medium")}>
            {alert.productName ? (
              <Link
                href={`/products/${alert.productId}${alert.type === "CONTENT_CHANGE" ? "?tab=content" : ""}`}
                className="hover:underline"
              >
                {alert.productName}
              </Link>
            ) : (
              "Deleted product"
            )}
            {alert.retailerName ? <span className="text-muted-foreground"> · {alert.retailerName}</span> : null}
          </p>
          <p className="text-sm text-muted-foreground">{alert.message}</p>
        </div>
      </div>
      {compact ? null : (
        <div className="shrink-0 pl-11 sm:pl-0">
          <AlertActions alertId={alert.id} status={alert.status} />
        </div>
      )}
    </li>
  );
}
