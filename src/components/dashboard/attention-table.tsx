import Link from "next/link";
import { GapValue, PositionBadge } from "@/components/pricing/position-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ProductListItemDTO } from "@/types/dto";
import { formatMoney } from "@/utils/format";

export function AttentionTable({ items }: { items: ProductListItemDTO[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Product</TableHead>
          <TableHead className="text-right">Your Price</TableHead>
          <TableHead className="text-right">Market Median</TableHead>
          <TableHead className="text-right">Gap</TableHead>
          <TableHead>Position</TableHead>
          <TableHead className="text-right">Suggested Price</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((p) => {
          const a = p.analysis;
          const currency = a?.currency ?? p.currency;
          return (
            <TableRow key={p.id}>
              <TableCell className="max-w-72">
                <Link href={`/products/${p.id}`} className="block truncate font-medium hover:underline">
                  {p.name}
                </Link>
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatMoney(a?.ownPrice, currency)}</TableCell>
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
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
