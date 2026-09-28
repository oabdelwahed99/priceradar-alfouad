"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, FileSearch, Grid3x3, LayoutDashboard, Package, Radar, Store } from "lucide-react";
import { signOut } from "@/lib/auth/actions";
import { ACCOUNT_ID, ACCOUNT_NAME } from "@/lib/auth/constants";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/products", label: "Products", icon: Package },
  { href: "/matrix", label: "Price Matrix", icon: Grid3x3 },
  { href: "/content", label: "Content & SEO", icon: FileSearch },
  { href: "/retailers", label: "Retailers", icon: Store },
  { href: "/alerts", label: "Alerts", icon: Bell },
] as const;

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 border-r bg-sidebar md:flex md:flex-col">
      <div className="flex h-14 items-center gap-2 border-b px-5">
        <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Radar className="size-4" />
        </div>
        <span className="font-semibold tracking-tight">Price Radar</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
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
      <div className="border-t p-4">
        <p className="text-sm font-medium">{ACCOUNT_NAME}</p>
        <p className="mt-0.5 font-mono text-xs text-muted-foreground">{ACCOUNT_ID}</p>
        <form action={signOut} className="mt-3">
          <Button type="submit" variant="outline" size="sm" className="w-full">
            Sign out
          </Button>
        </form>
      </div>
    </aside>
  );
}

export function MobileNav() {
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
      <form action={signOut} className="ml-auto">
        <Button type="submit" variant="ghost" size="sm">
          Sign out
        </Button>
      </form>
    </nav>
  );
}
