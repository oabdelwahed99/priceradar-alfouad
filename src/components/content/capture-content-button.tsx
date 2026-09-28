"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileSearch, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import type { ContentCaptureResultDTO } from "@/types/dto";

export function describeCapture(result: ContentCaptureResultDTO): string {
  const changed = result.changed > 0 ? ` ${result.changed} competitor page${result.changed === 1 ? "" : "s"} changed.` : "";
  return result.failed === 0
    ? `Content captured from all ${result.scraped} pages.${changed}`
    : `Content captured from ${result.captured} of ${result.scraped} pages.${changed}`;
}

/** Reads the product's pages for the Content & SEO analysis without touching prices. */
export function CaptureContentButton({
  productId,
  sourceCount,
  variant = "outline",
}: {
  productId: string;
  sourceCount: number;
  variant?: "outline" | "default";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  async function capture() {
    setBusy(true);
    try {
      const result = await apiFetch<ContentCaptureResultDTO>(`/api/products/${productId}/content`, { method: "POST" });
      if (result.failed === 0) toast.success(describeCapture(result));
      else {
        const firstError = result.results.find((r) => !r.success);
        toast.warning(`${describeCapture(result)}${firstError ? ` ${firstError.retailerName}: ${firstError.error}` : ""}`);
      }
      startTransition(() => router.refresh());
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : "Content capture failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant={variant} onClick={capture} disabled={busy}>
      {busy ? <Loader2 className="animate-spin" /> : <FileSearch />}
      {busy ? `Reading ${sourceCount} pages…` : "Capture content"}
    </Button>
  );
}
