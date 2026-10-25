"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  FileSearch,
  GitCompareArrows,
  Grid3x3,
  LayoutDashboard,
  Lock,
  Megaphone,
  MessageSquareText,
  Package,
  Store,
  Tags,
  Target,
  type LucideIcon,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { signOut } from "@/lib/auth/actions";
import type { AccountSession } from "@/lib/auth/constants";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** "always" is coming soon. "member" stays open for admins. */
  lock?: "always" | "member";
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/brands", label: "Brands", icon: Tags },
  { href: "/brand-comparison", label: "Comparison with other brands", icon: GitCompareArrows, lock: "always" },
  { href: "/products", label: "Products", icon: Package },
  { href: "/matrix", label: "Price Matrix", icon: Grid3x3 },
  { href: "/opportunities", label: "Opportunities", icon: Target },
  { href: "/content", label: "Content & SEO", icon: FileSearch },
  { href: "/reviews", label: "Customer Reviews", icon: MessageSquareText },
  { href: "/campaigns", label: "Marketing Campaigns", icon: Megaphone, lock: "member" },
  { href: "/retailers", label: "Retailers", icon: Store },
  { href: "/alerts", label: "Alerts", icon: Bell },
];

function isLocked(item: NavItem, account: AccountSession | null): boolean {
  if (item.lock === "always") return true;
  if (item.lock === "member") return account?.role !== "admin";
  return false;
}

function FeatureIcon({ icon: Icon, locked }: { icon: LucideIcon; locked: boolean }) {
  return (
    <span className="relative size-4 shrink-0">
      <Icon className="size-4" aria-hidden />
      {locked ? (
        <span className="absolute -right-2 -bottom-1.5 flex size-3.5 items-center justify-center rounded-full bg-background text-foreground ring-1 ring-border">
          <Lock className="size-2.5" aria-hidden />
        </span>
      ) : null}
    </span>
  );
}

function NavEntry({
  item,
  account,
  active,
  compact = false,
}: {
  item: NavItem;
  account: AccountSession | null;
  active: boolean;
  compact?: boolean;
}) {
  const locked = isLocked(item, account);
  const className = cn(
    "flex items-center font-medium",
    compact
      ? "shrink-0 gap-1.5 rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap"
      : "gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
    locked
      ? "cursor-not-allowed text-muted-foreground/70"
      : active
        ? compact
          ? "bg-muted text-foreground"
          : "bg-sidebar-accent text-sidebar-accent-foreground"
        : compact
          ? "text-muted-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
  );
  const content = (
    <>
      <FeatureIcon icon={item.icon} locked={locked} />
      <span>
        {item.label}
        {locked ? <span className="sr-only">{item.lock === "always" ? ", coming soon" : ", locked"}</span> : null}
      </span>
    </>
  );

  if (locked) {
    return (
      <span aria-disabled="true" className={className}>
        {content}
      </span>
    );
  }

  return (
    <Link href={item.href} className={className}>
      {content}
    </Link>
  );
}

export function AppSidebar({ account }: { account: AccountSession | null }) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col self-start overflow-hidden border-r bg-sidebar md:flex">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b px-5">
        <BrandMark />
        <span className="font-semibold tracking-tight">Price Radar</span>
      </div>
      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-3">
        {NAV_ITEMS.map((item) => (
          <NavEntry
            key={item.href}
            item={item}
            account={account}
            active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
          />
        ))}
      </nav>
      <div className="shrink-0 border-t bg-sidebar p-4">
        {account ? (
          <>
            <p className="text-sm font-medium">{account.name}</p>
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">
              {account.accountId}
              {account.role === "admin" ? " · Admin" : ""}
            </p>
          </>
        ) : null}
        <form action={signOut} className="mt-3">
          <Button type="submit" variant="outline" size="sm" className="w-full">
            Sign out
          </Button>
        </form>
      </div>
    </aside>
  );
}

export function MobileNav({ account }: { account: AccountSession | null }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto border-b px-3 py-2 md:hidden">
      {NAV_ITEMS.map((item) => (
        <NavEntry
          key={item.href}
          item={item}
          account={account}
          compact
          active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
        />
      ))}
      <div className="ml-auto flex items-center gap-2">
        {account ? <span className="font-mono text-xs text-muted-foreground">{account.accountId}</span> : null}
        <form action={signOut}>
          <Button type="submit" variant="ghost" size="sm">
            Sign out
          </Button>
        </form>
      </div>
    </nav>
  );
}
