"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileSearch, Loader2, RefreshCw, Square } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { apiFetch, ApiClientError } from "@/lib/api/client";

type Mode = "content" | "prices";

const MODE = {
  content: {
    label: "Capture content",
    running: "Capturing",
    icon: FileSearch,
    endpoint: (id: string) => `/api/products/${id}/content`,
    title: "Capture page content for all products?",
    description:
      "Reads the title, description, headings and FAQ of every store page for SEO analysis. Prices are not changed.",
  },
  prices: {
    label: "Refresh all prices",
    running: "Refreshing",
    icon: RefreshCw,
    endpoint: (id: string) => `/api/products/${id}/refresh`,
    title: "Refresh prices for all products?",
    description:
      "Scrapes every store page for its current price and page content. Imported sheet prices are replaced by scraped ones, and new price alerts may be raised.",
  },
} as const;

/**
 * Runs the per-product scrape endpoint for each product in turn, so no single request runs long and
 * the table fills in as products finish. Products checked within the refresh cooldown are skipped.
 */
export function BulkScrapeButton({ mode, productIds, variant = "outline" }: { mode: Mode; productIds: string[]; variant?: "outline" | "default" }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const stopRequested = useRef(false);
  const config = MODE[mode];
  const Icon = config.icon;
  const total = productIds.length;

  async function run() {
    setOpen(false);
    stopRequested.current = false;
    let done = 0;
    let failed = 0;
    let skipped = 0;
    for (const id of productIds) {
      if (stopRequested.current) break;
      setProgress(done);
      try {
        await apiFetch(config.endpoint(id), { method: "POST", body: "{}" });
      } catch (error) {
        if (error instanceof ApiClientError && error.status === 409) skipped += 1;
        else failed += 1;
      }
      done += 1;
      startTransition(() => router.refresh());
    }
    setProgress(null);

    const stopped = done < total ? ` Stopped after ${done} of ${total}.` : "";
    const detail = [failed ? `${failed} failed` : null, skipped ? `${skipped} skipped (checked moments ago or already running)` : null]
      .filter(Boolean)
      .join(", ");
    const summary = `${config.label}: ${done - failed - skipped} of ${total} products done.${detail ? ` ${detail}.` : ""}${stopped}`;
    if (failed) toast.warning(summary);
    else toast.success(summary);
  }

  if (progress !== null) {
    return (
      <Button variant="outline" onClick={() => (stopRequested.current = true)} title="Stop after the current product">
        <Loader2 className="animate-spin" />
        {config.running} {progress + 1}/{total}
        <Square className="size-3 fill-current" />
      </Button>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={<Button variant={variant} disabled={total === 0} />}>
        <Icon /> {config.label}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{config.title}</AlertDialogTitle>
          <AlertDialogDescription>
            {config.description} {total} product{total === 1 ? "" : "s"} will be checked one at a time; this can take a few
            minutes. Keep this tab open.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={run}>
            <Icon /> Start
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
