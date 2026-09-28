import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type SortOrder = "asc" | "desc";

/** Column header that links to the same page sorted by `field`; clicking the active column flips the order. */
export function SortHeader<F extends string>({
  field,
  label,
  sort,
  order,
  hrefForSort,
  defaultOrderFor,
  align = "left",
}: {
  field: F;
  label: string;
  sort: F;
  order: SortOrder;
  hrefForSort: (field: F, order: SortOrder) => string;
  defaultOrderFor: (field: F) => SortOrder;
  align?: "left" | "right";
}) {
  const active = sort === field;
  const nextOrder: SortOrder = active ? (order === "asc" ? "desc" : "asc") : defaultOrderFor(field);
  const Icon = !active ? ArrowUpDown : order === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead
      className={cn(align === "right" && "text-right")}
      aria-sort={active ? (order === "asc" ? "ascending" : "descending") : "none"}
    >
      <Link
        href={hrefForSort(field, nextOrder)}
        scroll={false}
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
        <Icon className={cn("size-3.5", !active && "opacity-50")} />
      </Link>
    </TableHead>
  );
}
