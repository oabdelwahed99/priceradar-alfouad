import { z } from "zod";
import { REVIEW_THEMES } from "@/lib/services/reviews/review-analysis";

export const REVIEW_SENTIMENTS = ["positive", "neutral", "negative"] as const;
export const REVIEW_THEME_IDS = REVIEW_THEMES.map((t) => t.id) as [
  (typeof REVIEW_THEMES)[number]["id"],
  ...(typeof REVIEW_THEMES)[number]["id"][],
];

export const reviewsOverviewQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  retailerId: z.string().trim().min(1).max(40).optional(),
  sentiment: z.enum(REVIEW_SENTIMENTS).optional(),
  theme: z.enum(REVIEW_THEME_IDS).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export type ReviewsOverviewQuery = z.infer<typeof reviewsOverviewQuerySchema>;

export const campaignsQuerySchema = z.object({
  brand: z.string().trim().max(120).optional(),
  retailerId: z.string().trim().min(1).max(40).optional(),
  type: z
    .enum(["competitor_weakness", "our_weakness", "strength", "review_gap", "price_value"])
    .optional(),
});

export type CampaignsQuery = z.infer<typeof campaignsQuerySchema>;

export const campaignIdeasBodySchema = z.object({
  brand: z.string().trim().max(120).optional(),
  retailerId: z.string().trim().min(1).max(40).optional(),
});

export type CampaignIdeasBody = z.infer<typeof campaignIdeasBodySchema>;
