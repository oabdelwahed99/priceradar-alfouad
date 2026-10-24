import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { buttonVariants } from "@/components/ui/button";

export function SiteHeader({ signedIn, showAction = true }: { signedIn: boolean; showAction?: boolean }) {
  return (
    <header className="flex items-center justify-between gap-4 px-6 py-5 md:px-10">
      <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
        <BrandMark className="size-8" />
        Price Radar
      </Link>
      {showAction ? (
        signedIn ? (
          <Link href="/dashboard" className={buttonVariants({ size: "sm" })}>
            Open dashboard
          </Link>
        ) : (
          <Link href="/sign-in" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Sign in
          </Link>
        )
      ) : null}
    </header>
  );
}
