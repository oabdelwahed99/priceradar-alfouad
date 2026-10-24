"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

function initials(name: string): string {
  const words = name
    .split(/[\s&+/]+/)
    .map((word) => word.replace(/[^A-Za-z0-9]/g, ""))
    .filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

const SIZES = {
  sm: { box: "size-5 text-[9px]", pad: "p-px", px: 20 },
  md: { box: "size-8 text-[10px]", pad: "p-0.5", px: 32 },
} as const;

/** Site icon for a retailer, from its domain. Falls back to initials when the icon cannot load. */
export function StoreLogo({
  name,
  domain,
  size = "md",
  className,
}: {
  name: string;
  domain?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const spec = SIZES[size];
  const src = domain ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64` : "";

  if (!src || failed) {
    return (
      <span
        aria-hidden
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-md bg-muted font-semibold tracking-tight text-muted-foreground",
          spec.box,
          className,
        )}
      >
        {initials(name)}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt=""
      width={spec.px}
      height={spec.px}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={cn("shrink-0 rounded-md bg-white object-contain ring-1 ring-border", spec.box, spec.pad, className)}
    />
  );
}

/** Logo plus the store name, for tables and lists. */
export function StoreLabel({
  name,
  domain,
  size = "sm",
  className,
  children,
}: {
  name: string;
  domain?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <StoreLogo name={name} domain={domain} size={size} />
      <span className="min-w-0">{children ?? <span className="font-medium">{name}</span>}</span>
    </span>
  );
}
