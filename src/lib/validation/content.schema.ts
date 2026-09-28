import { z } from "zod";

/** Score bands: good ≥ 80, fair 50–79, needs work < 50; not captured = your page has no content yet. */
export const CONTENT_SCORE_BANDS = ["needs_work", "fair", "good", "not_captured"] as const;
export type ContentScoreBand = (typeof CONTENT_SCORE_BANDS)[number];

export const CONTENT_SORT_FIELDS = ["name", "score", "issues", "missingKeywords", "descriptionWords", "lastChange"] as const;
export type ContentSortField = (typeof CONTENT_SORT_FIELDS)[number];

export const contentOverviewQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  band: z.enum(CONTENT_SCORE_BANDS).optional(),
  sort: z.enum(CONTENT_SORT_FIELDS).default("score"),
  order: z.enum(["asc", "desc"]).default("asc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type ContentOverviewQuery = z.infer<typeof contentOverviewQuerySchema>;
