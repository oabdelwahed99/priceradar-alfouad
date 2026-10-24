"use client";

import { ListFilters } from "@/components/layout/list-filters";
import { REVIEW_THEMES } from "@/lib/services/reviews/review-analysis";
import type { ReviewSentimentDTO, ReviewThemeIdDTO } from "@/types/dto";

const SENTIMENT_OPTIONS: { value: ReviewSentimentDTO; label: string }[] = [
  { value: "positive", label: "Positive" },
  { value: "neutral", label: "Neutral" },
  { value: "negative", label: "Negative" },
];

const THEME_OPTIONS = REVIEW_THEMES.map((t) => ({
  value: t.id as ReviewThemeIdDTO,
  label: t.label,
}));

export function ReviewsFilters({
  q,
  retailerId,
  sentiment,
  theme,
  retailers,
}: {
  q: string;
  retailerId: string | null;
  sentiment: ReviewSentimentDTO | null;
  theme: ReviewThemeIdDTO | null;
  retailers: { id: string; name: string; isOwnStore: boolean }[];
}) {
  return (
    <ListFilters
      q={q}
      searchPlaceholder="Search reviews, products, stores…"
      selects={[
        {
          param: "retailerId",
          value: retailerId,
          allLabel: "All stores",
          options: retailers.map((r) => ({
            value: r.id,
            label: r.isOwnStore ? `${r.name} (you)` : r.name,
          })),
          ariaLabel: "Filter by store",
        },
        {
          param: "sentiment",
          value: sentiment,
          allLabel: "All sentiments",
          options: SENTIMENT_OPTIONS,
          ariaLabel: "Filter by sentiment",
        },
        {
          param: "theme",
          value: theme,
          allLabel: "All themes",
          options: THEME_OPTIONS,
          ariaLabel: "Filter by theme",
        },
      ]}
    />
  );
}
