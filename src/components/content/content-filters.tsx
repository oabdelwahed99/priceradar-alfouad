"use client";

import { ListFilters } from "@/components/layout/list-filters";
import { CONTENT_SCORE_THRESHOLDS, type ContentScoreBand } from "@/lib/validation/content.schema";

const BAND_OPTIONS: { value: ContentScoreBand; label: string }[] = [
  { value: "needs_work", label: `Needs work (below ${CONTENT_SCORE_THRESHOLDS.good})` },
  { value: "good", label: `Good (${CONTENT_SCORE_THRESHOLDS.good}+)` },
  { value: "not_captured", label: "Not captured yet" },
];

export function ContentFilters({ q, band }: { q: string; band: ContentScoreBand | null }) {
  return (
    <ListFilters
      q={q}
      select={{ param: "band", value: band, allLabel: "All scores", options: BAND_OPTIONS, ariaLabel: "Filter by content score" }}
    />
  );
}
