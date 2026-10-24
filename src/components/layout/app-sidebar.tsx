"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  FileSearch,
  Grid3x3,
  LayoutDashboard,
  Megaphone,
  MessageSquareText,
  Package,
  Radar,
  Store,
  Tags,
  Target,
} from "lucide-react";
import { signOut } from "@/lib/auth/actions";
import type { AccountSession } from "@/lib/auth/constants";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/brands", label: "Brands", icon: Tags },
  { href: "/products", label: "Products", icon: Package },
  { href: "/matrix", label: "Price Matrix", icon: Grid3x3 },
  { href: "/opportunities", label: "Opportunities", icon: Target },
  { href: "/content", label: "Content & SEO", icon: FileSearch },
  { href: "/reviews", label: "Customer Reviews", icon: MessageSquareText },
  { href: "/campaigns", label: "Marketing Campaigns", icon: Megaphone },
  { href: "/retailers", label: "Retailers", icon: Store },
  { href: "/alerts", label: "Alerts", icon: Bell },
] as const;

export function AppSidebar({ account }: { account: AccountSession | null }) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col self-start overflow-hidden border-r bg-sidebar md:flex">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b px-5">
        <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Radar className="size-4" />
        </div>
        <span className="font-semibold tracking-tight">Price Radar</span>
      </div>
      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          );
        })}
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
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap",
              active ? "bg-muted font-medium" : "text-muted-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
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
