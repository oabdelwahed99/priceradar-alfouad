import { z } from "zod";

export const opportunitiesQuerySchema = z.object({
  /** Omitted on the first visit: the focus brand is selected. "all" shows every brand. */
  brand: z.string().trim().max(120).optional(),
  view: z.enum(["stores", "restock", "listings"]).optional(),
});

export type OpportunitiesQuery = z.infer<typeof opportunitiesQuerySchema>;
export type OpportunitiesView = NonNullable<OpportunitiesQuery["view"]>;
