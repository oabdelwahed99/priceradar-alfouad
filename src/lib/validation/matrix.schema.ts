import { z } from "zod";
import { PRICE_POSITIONS } from "@/types";

export const priceMatrixQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  position: z.enum(PRICE_POSITIONS).optional(),
  /** "1" includes demo products, which are hidden by default. */
  demo: z.enum(["1"]).optional(),
});

export type PriceMatrixQuery = z.infer<typeof priceMatrixQuerySchema>;
