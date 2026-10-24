"use client";

import { usePathname } from "next/navigation";
import { AppSidebar, MobileNav } from "@/components/layout/app-sidebar";
import type { AccountSession } from "@/lib/auth/constants";

export function AppShell({ children, account }: { children: React.ReactNode; account: AccountSession | null }) {
  const pathname = usePathname();
  const bare = pathname === "/" || pathname.startsWith("/sign-in");

  if (bare) {
    return <div className="flex min-h-svh min-w-0 flex-1 flex-col">{children}</div>;
  }

  return (
    <div className="flex min-h-svh min-w-0 flex-1 bg-muted/30">
      <AppSidebar account={account} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav account={account} />
        <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
