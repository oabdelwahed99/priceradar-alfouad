"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import type { ComparisonRunResultDTO } from "@/types/dto";
import { formatMoney } from "@/utils/format";

/** Shared refresh/retry action: calls the refresh API, reports results and re-renders server data. */
export function usePriceRefresh(productId: string) {
  const router = useRouter();
  const [pending, setPending] = useState<string | "all" | null>(null);
  const [, startTransition] = useTransition();

  async function refresh(sourceIds?: string[]) {
    const key = sourceIds?.length === 1 ? sourceIds[0] : "all";
    setPending(key);
    try {
      const result = await apiFetch<ComparisonRunResultDTO>(`/api/products/${productId}/refresh`, {
        method: "POST",
        body: JSON.stringify(sourceIds ? { sourceIds } : {}),
      });
      if (result.scraped === 1) {
        const r = result.results[0];
        if (r.success) toast.success(`${r.retailerName}: price found ${formatMoney(r.price, r.currency)}`);
        else toast.warning(`${r.retailerName}: ${r.error}`);
      } else if (result.failed === 0) {
        toast.success(`All ${result.scraped} prices updated.`);
      } else {
        toast.warning(`${result.succeeded} of ${result.scraped} prices updated. ${result.failed} could not be extracted.`);
      }
      if (result.alertsCreated > 0) {
        toast.info(`${result.alertsCreated} new alert${result.alertsCreated === 1 ? "" : "s"}.`);
      }
      startTransition(() => router.refresh());
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : "Refresh failed.");
    } finally {
      setPending(null);
    }
  }

  return { refresh, pending };
}
