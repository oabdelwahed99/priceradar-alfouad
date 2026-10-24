"use client";

import { ListFilters, type ListFilterSelect } from "@/components/layout/list-filters";
import { PRICE_POSITION_LABELS } from "@/lib/services/pricing/price-position";
import { PRICE_POSITIONS, type PricePosition } from "@/types";

const POSITION_OPTIONS = PRICE_POSITIONS.map((p) => ({ value: p, label: PRICE_POSITION_LABELS[p] }));

export function ProductsFilters({
  q,
  position,
  category = null,
  categories = [],
}: {
  q: string;
  position: PricePosition | null;
  category?: string | null;
  categories?: string[];
}) {
  const selects: ListFilterSelect[] = [];
  if (categories.length > 0) {
    selects.push({
      param: "category",
      value: category,
      allLabel: "All categories",
      options: categories.map((c) => ({ value: c, label: c })),
      ariaLabel: "Filter by category",
    });
  }
  selects.push({
    param: "position",
    value: position,
    allLabel: "All positions",
    options: POSITION_OPTIONS,
    ariaLabel: "Filter by price position",
  });

  return <ListFilters q={q} selects={selects} />;
}
