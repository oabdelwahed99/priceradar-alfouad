"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CampaignInsightTypeDTO } from "@/types/dto";

const ALL = "all";

const TYPE_OPTIONS: { value: CampaignInsightTypeDTO; label: string }[] = [
  { value: "competitor_weakness", label: "Competitor weakness" },
  { value: "our_weakness", label: "Our weakness" },
  { value: "strength", label: "Strength to amplify" },
  { value: "review_gap", label: "Review gap" },
  { value: "price_value", label: "Price / value" },
];

export function CampaignsFilters({
  brand,
  retailerId,
  type,
  brands,
  retailers,
}: {
  brand: string | null;
  retailerId: string | null;
  type: CampaignInsightTypeDTO | null;
  brands: string[];
  retailers: { id: string; name: string; isOwnStore: boolean }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function update(param: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(param, value);
    else params.delete(param);
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  const brandItems = [{ value: ALL, label: "All brands" }, ...brands.map((b) => ({ value: b, label: b }))];
  const retailerItems = [
    { value: ALL, label: "All stores" },
    ...retailers.map((r) => ({ value: r.id, label: r.isOwnStore ? `${r.name} (you)` : r.name })),
  ];
  const typeItems = [{ value: ALL, label: "All insight types" }, ...TYPE_OPTIONS];

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Select
        items={brandItems}
        value={brand ?? ALL}
        onValueChange={(v) => update("brand", !v || v === ALL ? "all" : String(v))}
      >
        <SelectTrigger className="w-full sm:w-48" aria-label="Filter by brand">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {brandItems.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        items={retailerItems}
        value={retailerId ?? ALL}
        onValueChange={(v) => update("retailerId", v && v !== ALL ? String(v) : null)}
      >
        <SelectTrigger className="w-full sm:w-48" aria-label="Filter by store">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {retailerItems.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        items={typeItems}
        value={type ?? ALL}
        onValueChange={(v) => update("type", v && v !== ALL ? String(v) : null)}
      >
        <SelectTrigger className="w-full sm:w-52" aria-label="Filter by insight type">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {typeItems.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
