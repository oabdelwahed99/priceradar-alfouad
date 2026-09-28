"use client";

import { ListFilters } from "@/components/layout/list-filters";
import { PRICE_POSITION_LABELS } from "@/lib/services/pricing/price-position";
import { PRICE_POSITIONS, type PricePosition } from "@/types";

const POSITION_OPTIONS = PRICE_POSITIONS.map((p) => ({ value: p, label: PRICE_POSITION_LABELS[p] }));

export function ProductsFilters({ q, position }: { q: string; position: PricePosition | null }) {
  return (
    <ListFilters
      q={q}
      select={{
        param: "position",
        value: position,
        allLabel: "All positions",
        options: POSITION_OPTIONS,
        ariaLabel: "Filter by price position",
      }}
    />
  );
}
