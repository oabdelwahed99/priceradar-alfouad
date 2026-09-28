"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALL = "all";
const SEARCH_DEBOUNCE_MS = 300;

export interface ListFilterSelect {
  /** Search param the select writes, e.g. "position". */
  param: string;
  value: string | null;
  allLabel: string;
  options: { value: string; label: string }[];
  ariaLabel: string;
}

/** Debounced search box plus one select, both kept in the URL; changing either resets pagination. */
export function ListFilters({ q, select, searchPlaceholder = "Search name or brand…" }: { q: string; select: ListFilterSelect; searchPlaceholder?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(q);
  const items = [{ value: ALL, label: select.allLabel }, ...select.options];

  function update(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("page");
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  useEffect(() => {
    const trimmed = search.trim();
    if (trimmed === q) return;
    const timer = setTimeout(() => update({ q: trimmed || null }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // `update` reads the latest URL each call; re-running on its identity would reset the debounce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, q]);

  const hasFilters = Boolean(q || select.value || search);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="relative sm:max-w-xs sm:flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label="Search products"
          className="pl-8"
        />
      </div>
      <Select
        items={items}
        value={select.value ?? ALL}
        onValueChange={(value) => update({ [select.param]: value && value !== ALL ? String(value) : null })}
      >
        <SelectTrigger className="w-full sm:w-52" aria-label={select.ariaLabel}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hasFilters ? (
        <Button
          variant="ghost"
          onClick={() => {
            setSearch("");
            update({ q: null, [select.param]: null });
          }}
        >
          <X /> Clear
        </Button>
      ) : null}
      {pending ? <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Loading" /> : null}
    </div>
  );
}
