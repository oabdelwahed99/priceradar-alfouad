import Link from "next/link";
import type { CampaignProductAngleDTO, CampaignQuoteDTO } from "@/types/dto";

function Quote({ quote }: { quote: CampaignQuoteDTO }) {
  return (
    <li className="text-sm leading-relaxed">
      <p dir="auto">“{quote.text}”</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {quote.retailerName}
        {quote.official ? " · Official store" : ""}
        {quote.rating != null ? ` · ${quote.rating}/5` : ""}
      </p>
    </li>
  );
}

export function ProductAngles({ angles, brand }: { angles: CampaignProductAngleDTO[]; brand: string | null }) {
  if (angles.length === 0) return null;
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
          Product briefs · {angles.length}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Each brief is built from {brand ? `${brand} ` : ""}customer reviews, including the official store. Use the praise
          as campaign copy and keep the complaints off the ad.
        </p>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {angles.map((angle) => (
          <article key={angle.productId} className="space-y-3 rounded-xl border bg-card p-4 ring-1 ring-foreground/10">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <Link href={`/products/${angle.productId}`} className="font-medium hover:underline">
                  {angle.productName}
                </Link>
                {brand === null ? <p className="text-xs text-muted-foreground">{angle.brand}</p> : null}
              </div>
              <p className="text-xs text-muted-foreground tabular-nums">
                {angle.reviewCount} review{angle.reviewCount === 1 ? "" : "s"}
                {angle.averageRating != null ? ` · ${angle.averageRating}/5` : ""}
                {` · ${angle.positive} positive · ${angle.negative} negative`}
              </p>
            </div>
            {angle.themeLabels.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {angle.themeLabels.map((label) => (
                  <span key={label} className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                    {label}
                  </span>
                ))}
              </div>
            ) : null}
            <p className="text-sm">
              <span className="font-medium">Use it:</span> {angle.action}
            </p>
            {angle.praise.length > 0 ? (
              <div>
                <h3 className="text-xs font-medium tracking-wide text-emerald-700 uppercase dark:text-emerald-400">
                  Quote these
                </h3>
                <ul className="mt-1.5 space-y-2">
                  {angle.praise.map((quote) => (
                    <Quote key={`${quote.retailerName}:${quote.text}`} quote={quote} />
                  ))}
                </ul>
              </div>
            ) : null}
            {angle.complaints.length > 0 ? (
              <div>
                <h3 className="text-xs font-medium tracking-wide text-rose-700 uppercase dark:text-rose-400">
                  Do not put these in the ad
                </h3>
                <ul className="mt-1.5 space-y-2">
                  {angle.complaints.map((quote) => (
                    <Quote key={`${quote.retailerName}:${quote.text}`} quote={quote} />
                  ))}
                </ul>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
