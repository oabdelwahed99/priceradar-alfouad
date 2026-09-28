import Link from "next/link";
import { SortHeader, type SortOrder } from "@/components/layout/sort-header";
import { GapValue, PositionBadge } from "@/components/pricing/position-badge";
import { DeleteProductButton } from "@/components/products/delete-product-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ProductSortField } from "@/lib/validation/product.schema";
import type { ProductListItemDTO } from "@/types/dto";
import { formatDateTime, formatMoney, formatRelativeTime } from "@/utils/format";

export type { SortOrder };

/** Text columns start ascending; numeric and date columns start with the largest values. */
export function defaultOrderFor(field: ProductSortField): SortOrder {
  return field === "name" || field === "brand" ? "asc" : "desc";
}

export function ProductsTable({
  items,
  sort,
  order,
  hrefForSort,
}: {
  items: ProductListItemDTO[];
  sort: ProductSortField;
  order: SortOrder;
  hrefForSort: (field: ProductSortField, order: SortOrder) => string;
}) {
  const header = { sort, order, hrefForSort, defaultOrderFor };
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <SortHeader field="name" label="Product" {...header} />
          <SortHeader field="brand" label="Brand" {...header} />
          <SortHeader field="ownPrice" label="Your Price" align="right" {...header} />
          <SortHeader field="marketMedian" label="Market Median" align="right" {...header} />
          <SortHeader field="gap" label="Price Gap" align="right" {...header} />
          <TableHead className="text-muted-foreground">Position</TableHead>
          <SortHeader field="suggestedPrice" label="Suggested Price" align="right" {...header} />
          <SortHeader field="lastCheckedAt" label="Last Checked" {...header} />
          <TableHead className="text-right">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((p) => {
          const a = p.analysis;
          const currency = a?.currency ?? p.currency;
          return (
            <TableRow key={p.id}>
              <TableCell className="max-w-80">
                <Link href={`/products/${p.id}`} className="block truncate font-medium hover:underline">
                  {p.name}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {[p.size, `${Math.max(p.sourceCount - 1, 0)} competitors`].filter(Boolean).join(" · ")}
                  {p.isDemo ? " · Demo" : ""}
                </span>
              </TableCell>
              <TableCell className="text-muted-foreground">{p.brand ?? "—"}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">{formatMoney(a?.ownPrice, currency)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatMoney(a?.marketMedian, currency)}</TableCell>
              <TableCell className="text-right">
                <GapValue value={a?.gapPercentage ?? null} />
              </TableCell>
              <TableCell>
                <PositionBadge position={a?.position ?? null} />
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums">
                {formatMoney(a?.suggestedPrice, currency)}
              </TableCell>
              <TableCell className="text-muted-foreground" title={formatDateTime(p.lastCheckedAt)}>
                {formatRelativeTime(p.lastCheckedAt)}
              </TableCell>
              <TableCell>
                <div className="flex justify-end">
                  <DeleteProductButton productId={p.id} productName={p.name} size="icon-sm" redirectTo={null} />
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
