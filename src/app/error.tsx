"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed px-6 py-16 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="size-5" />
      </div>
      <div className="space-y-1">
        <h2 className="font-semibold">Something went wrong</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          This page could not be loaded. Your data is safe; try again, and if the problem persists check the server logs
          {error.digest ? (
            <>
              {" "}
              for error <code className="rounded bg-muted px-1 py-0.5 text-xs">{error.digest}</code>
            </>
          ) : null}
          .
        </p>
      </div>
      <Button onClick={() => retry()}>
        <RotateCw /> Try again
      </Button>
    </div>
  );
}
