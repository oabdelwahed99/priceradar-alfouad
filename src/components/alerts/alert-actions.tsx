"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCheck, Loader2, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import type { AlertStatus } from "@/types";

function useAlertMutation() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [refreshing, startTransition] = useTransition();

  async function run(request: () => Promise<unknown>, failure: string) {
    setBusy(true);
    try {
      await request();
      startTransition(() => router.refresh());
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : failure);
    } finally {
      setBusy(false);
    }
  }

  return { run, pending: busy || refreshing };
}

export function AlertActions({ alertId, status }: { alertId: string; status: AlertStatus }) {
  const { run, pending } = useAlertMutation();
  const setStatus = (next: AlertStatus) =>
    run(
      () => apiFetch(`/api/alerts/${alertId}`, { method: "PATCH", body: JSON.stringify({ status: next }) }),
      "Could not update the alert.",
    );

  if (pending) return <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Updating" />;

  return (
    <div className="flex items-center gap-1">
      {status === "new" ? (
        <Button size="sm" variant="ghost" onClick={() => setStatus("read")}>
          <Check /> Mark read
        </Button>
      ) : null}
      {status === "dismissed" ? (
        <Button size="sm" variant="ghost" onClick={() => setStatus("read")}>
          <RotateCcw /> Restore
        </Button>
      ) : (
        <Button size="sm" variant="ghost" onClick={() => setStatus("dismissed")}>
          <X /> Dismiss
        </Button>
      )}
    </div>
  );
}

export function MarkAllReadButton({ disabled }: { disabled?: boolean }) {
  const { run, pending } = useAlertMutation();
  return (
    <Button
      variant="outline"
      disabled={disabled || pending}
      onClick={() =>
        run(async () => {
          const { updated } = await apiFetch<{ updated: number }>("/api/alerts/mark-all-read", { method: "POST" });
          toast.success(updated === 1 ? "1 alert marked as read" : `${updated} alerts marked as read`);
        }, "Could not mark alerts as read.")
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <CheckCheck />} Mark all read
    </Button>
  );
}
