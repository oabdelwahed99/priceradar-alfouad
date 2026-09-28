"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usePriceRefresh } from "./use-price-refresh";

export function RefreshButton({
  productId,
  sourceCount,
  disabledReason,
}: {
  productId: string;
  sourceCount: number;
  disabledReason?: string;
}) {
  const { refresh, pending } = usePriceRefresh(productId);
  const busy = pending !== null;

  if (disabledReason) {
    return (
      <Tooltip>
        <TooltipTrigger render={<span className="inline-flex" tabIndex={0} />}>
          <Button disabled>
            <RefreshCw /> Refresh Prices
          </Button>
        </TooltipTrigger>
        <TooltipContent className="max-w-64">{disabledReason}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Button onClick={() => refresh()} disabled={busy}>
      {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />}
      {busy ? `Checking ${sourceCount} stores…` : "Refresh Prices"}
    </Button>
  );
}
