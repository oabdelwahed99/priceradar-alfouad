"use client";

import { useEffect, useState } from "react";
import { formatDateTime, formatRelativeTime } from "@/utils/format";

/** Relative "x minutes ago" label that stays current without a page reload. */
export function LastChecked({ at, prefix = "Last checked:" }: { at: string | null; prefix?: string }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="text-sm text-muted-foreground" title={formatDateTime(at)} suppressHydrationWarning>
      {prefix} {at ? formatRelativeTime(at) : "Never"}
    </span>
  );
}
