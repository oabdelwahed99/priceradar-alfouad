import Link from "next/link";
import { ArrowRight, Bell, FileSearch, Grid3x3, Radar, Scale } from "lucide-react";
import { SiteHeader } from "@/components/marketing/site-header";
import { PositionBadge } from "@/components/pricing/position-badge";
import { buttonVariants } from "@/components/ui/button";
import { getSession } from "@/lib/auth/session";

export const metadata = {
  title: "Price Radar — Al Fo2ad",
  description:
    "Compare Al Fo2ad cosmetics prices with competitor stores and see where each product sits in the market.",
};

const FEATURES = [
  {
    icon: Scale,
    title: "Price position",
    body: "Each product is placed against the competitor median: underpriced, aligned, or overpriced, with a suggested price from the prices that were actually observed.",
  },
  {
    icon: Grid3x3,
    title: "Price matrix",
    body: "Every product is a row and every store is a column. The lowest in-stock price is highlighted, and you can export the same grid.",
  },
  {
    icon: FileSearch,
    title: "Content and SEO",
    body: "Page titles, descriptions, headings, and FAQs are compared with competitor pages so missing keywords and thin copy show up in one table.",
  },
  {
    icon: Bell,
    title: "Alerts",
    body: "A competitor price change, a move past the overpriced or underpriced line, an out-of-stock flip, or a rewritten product page raises an alert.",
  },
] as const;

const STEPS = [
  {
    step: "01",
    title: "Add the product",
    body: "Enter the name, your store URL, and the same product on competitor stores.",
  },
  {
    step: "02",
    title: "Read each page",
    body: "Price Radar opens the pages, extracts price, currency, and availability, and keeps every check.",
  },
  {
    step: "03",
    title: "See the gap",
    body: "The dashboard shows where your price sits, what changed, and which pages need stronger copy.",
  },
] as const;

export default async function HomePage() {
  const session = await getSession();
  const enterHref = session ? "/dashboard" : "/sign-in";
  const enterLabel = session ? "Open dashboard" : "Sign in";

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--muted),transparent_58%)]"
      />
      <div className="relative flex flex-1 flex-col">
        <SiteHeader signedIn={Boolean(session)} />

        <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 pt-10 pb-16 md:px-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:pt-16 lg:pb-20">
          <div className="space-y-6">
            <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">Al Fo2ad pricing desk</p>
            <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-balance md:text-5xl">
              Know where every price sits in the market.
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
              Price Radar compares Al Fo2ad product pages with competitor stores. It records each price, shows the gap
              to the market median, and flags the copy competitors use that your page does not.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link href={enterHref} className={buttonVariants({ size: "lg", className: "h-10 px-4" })}>
                {enterLabel}
                <ArrowRight />
              </Link>
              <a href="#how-it-works" className={buttonVariants({ variant: "outline", size: "lg", className: "h-10 px-4" })}>
                How it works
              </a>
            </div>
          </div>

          <div className="relative">
            <div aria-hidden className="absolute -top-10 -right-6 size-56 text-foreground/10 md:size-72">
              <svg viewBox="0 0 280 280" className="size-full">
                <circle cx="140" cy="140" r="36" fill="none" stroke="currentColor" />
                <circle cx="140" cy="140" r="78" fill="none" stroke="currentColor" />
                <circle cx="140" cy="140" r="122" fill="none" stroke="currentColor" />
                <path d="M140 140 L236 78" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="214" cy="96" r="5" fill="currentColor" className="text-foreground/40" />
              </svg>
            </div>
            <div className="relative rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Sample reading</p>
                  <p className="mt-1 font-medium">Argan oil shampoo</p>
                </div>
                <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <Radar className="size-4" />
                </span>
              </div>
              <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-muted-foreground">Your price</dt>
                  <dd className="mt-1 font-medium tabular-nums">EGP 189.00</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Market median</dt>
                  <dd className="mt-1 font-medium tabular-nums">EGP 175.00</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Position</dt>
                  <dd className="mt-1">
                    <PositionBadge position="SLIGHTLY_OVERPRICED" />
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Gap</dt>
                  <dd className="mt-1 font-medium text-rose-600 tabular-nums">+8.00%</dd>
                </div>
              </dl>
              <p className="mt-5 text-xs text-muted-foreground">
                Suggested price is based on observed competitor prices only. This card is an illustration.
              </p>
            </div>
          </div>
        </section>

        <section className="border-t bg-muted/40">
          <div className="mx-auto grid w-full max-w-6xl gap-px bg-border px-6 py-px md:grid-cols-2 md:px-10 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <article key={title} className="bg-background px-0 py-8 md:px-6">
                <Icon className="size-4 text-foreground" />
                <h2 className="mt-3 font-medium">{title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="mx-auto w-full max-w-6xl px-6 py-16 md:px-10">
          <h2 className="text-2xl font-semibold tracking-tight">How a comparison runs</h2>
          <ol className="mt-8 grid gap-8 md:grid-cols-3">
            {STEPS.map(({ step, title, body }) => (
              <li key={step}>
                <p className="font-mono text-xs text-muted-foreground">{step}</p>
                <h3 className="mt-2 font-medium">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-auto border-t">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-10 md:flex-row md:items-center md:justify-between md:px-10">
            <div>
              <p className="font-medium">Open the Al Fo2ad workspace</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {session ? "Signed in as alfo2ad." : "Sign in with account ID alfo2ad."}
              </p>
            </div>
            <Link href={enterHref} className={buttonVariants({ className: "h-10 px-4" })}>
              {enterLabel}
              <ArrowRight />
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
