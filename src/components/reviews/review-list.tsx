import Link from "next/link";
import { StoreLabel } from "@/components/matrix/store-logo";
import { cn } from "@/lib/utils";
import { REVIEW_THEME_LABELS } from "@/lib/services/reviews/review-analysis";
import type { ReviewListItemDTO, ReviewSentimentDTO, ReviewThemeIdDTO } from "@/types/dto";
import { formatRelativeTime } from "@/utils/format";

const SENTIMENT_STYLES: Record<ReviewSentimentDTO, string> = {
  positive: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  neutral: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
  negative: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

function Stars({ rating }: { rating: number | null }) {
  if (rating == null) return <span className="text-muted-foreground">—</span>;
  return <span className="tabular-nums">{rating.toFixed(1)}★</span>;
}

export function ReviewList({ reviews }: { reviews: ReviewListItemDTO[] }) {
  if (reviews.length === 0) {
    return <p className="text-sm text-muted-foreground">No reviews match these filters.</p>;
  }

  return (
    <ul className="divide-y">
      {reviews.map((review) => (
        <li key={review.id} className="space-y-2 py-4 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", SENTIMENT_STYLES[review.sentiment])}>
              {review.sentiment}
            </span>
            <Stars rating={review.rating} />
            <span className="text-muted-foreground">·</span>
            <StoreLabel name={review.retailerName} domain={review.retailerDomain} size="sm" />
            {review.isOwnStore ? <span className="text-xs text-muted-foreground">(you)</span> : null}
            <span className="text-muted-foreground">·</span>
            <Link href={`/products/${review.productId}`} className="hover:underline">
              {review.productName}
            </Link>
            {review.author ? (
              <>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">{review.author}</span>
              </>
            ) : null}
            <span className="ms-auto text-xs text-muted-foreground">
              {formatRelativeTime(review.publishedAt ?? review.firstSeenAt)}
            </span>
          </div>
          <p dir="auto" className="text-sm leading-relaxed whitespace-pre-wrap">
            {review.text}
          </p>
          {review.themes.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {review.themes.map((themeId: ReviewThemeIdDTO) => (
                <span key={themeId} className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  {REVIEW_THEME_LABELS[themeId]}
                </span>
              ))}
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
