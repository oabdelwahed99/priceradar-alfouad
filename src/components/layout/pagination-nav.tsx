import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { pageWindow } from "@/utils/pagination";

export function PaginationNav({
  page,
  totalPages,
  total,
  pageSize,
  hrefForPage,
  itemLabel = "items",
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  hrefForPage: (page: number) => string;
  itemLabel?: string;
}) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <nav aria-label="Pagination" className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-sm text-muted-foreground">
        Showing <span className="font-medium text-foreground">{from}</span>–
        <span className="font-medium text-foreground">{to}</span> of{" "}
        <span className="font-medium text-foreground">{total}</span> {itemLabel}
      </p>
      {totalPages > 1 ? (
        <div className="flex items-center gap-1">
          <PageLink href={hrefForPage(page - 1)} disabled={page <= 1} aria-label="Previous page">
            <ChevronLeft />
          </PageLink>
          {pageWindow(page, totalPages).map((p, i) =>
            p === null ? (
              <span key={`gap-${i}`} className="px-1.5 text-sm text-muted-foreground">
                …
              </span>
            ) : (
              <PageLink key={p} href={hrefForPage(p)} active={p === page} aria-label={`Page ${p}`}>
                {p}
              </PageLink>
            ),
          )}
          <PageLink href={hrefForPage(page + 1)} disabled={page >= totalPages} aria-label="Next page">
            <ChevronRight />
          </PageLink>
        </div>
      ) : null}
    </nav>
  );
}

function PageLink({
  href,
  disabled,
  active,
  children,
  ...rest
}: {
  href: string;
  disabled?: boolean;
  active?: boolean;
  children: ReactNode;
  "aria-label": string;
}) {
  const className = cn(
    buttonVariants({ variant: active ? "outline" : "ghost", size: "icon-sm" }),
    active && "pointer-events-none font-semibold",
  );
  if (disabled) {
    return (
      <span className={cn(className, "pointer-events-none opacity-50")} aria-disabled="true" {...rest}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={className} aria-current={active ? "page" : undefined} {...rest}>
      {children}
    </Link>
  );
}
