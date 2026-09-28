import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { AlertStatusFilter } from "@/lib/validation/alert.schema";
import { ALERT_TYPES, type AlertType } from "@/types";
import { ALERT_TYPE_META } from "./alert-meta";

const STATUS_TABS: { value: AlertStatusFilter; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "new", label: "New" },
  { value: "read", label: "Read" },
  { value: "dismissed", label: "Dismissed" },
  { value: "all", label: "All" },
];

function Chip({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-7 items-center rounded-full border px-3 text-xs font-medium transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

export function AlertsFilters({
  status,
  type,
  hrefFor,
}: {
  status: AlertStatusFilter;
  type: AlertType | undefined;
  hrefFor: (next: { status: AlertStatusFilter; type: AlertType | undefined }) => string;
}) {
  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap gap-1.5" aria-label="Filter by status">
        {STATUS_TABS.map((tab) => (
          <Chip key={tab.value} href={hrefFor({ status: tab.value, type })} active={status === tab.value}>
            {tab.label}
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5" aria-label="Filter by type">
        <Chip href={hrefFor({ status, type: undefined })} active={!type}>
          All types
        </Chip>
        {ALERT_TYPES.map((t) => (
          <Chip key={t} href={hrefFor({ status, type: t })} active={type === t}>
            {ALERT_TYPE_META[t].label}
          </Chip>
        ))}
      </div>
    </div>
  );
}
