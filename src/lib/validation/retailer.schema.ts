import { z } from "zod";

const domainSchema = z
  .string({ error: "Domain is required" })
  .trim()
  .toLowerCase()
  .transform((v) => v.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, ""))
  .pipe(z.string().regex(z.regexes.domain, "Enter a valid domain, e.g. store.com"));

const retailerNameSchema = z
  .string({ error: "Retailer name is required" })
  .trim()
  .min(1, "Retailer name is required")
  .max(120, "Retailer name must be at most 120 characters");

export const createRetailerSchema = z.object({
  name: retailerNameSchema,
  domain: domainSchema,
  isOwnStore: z.boolean().default(false),
});

/**
 * Only the display name is editable. The domain identifies the retailer, and whether a URL is
 * the own store is chosen per product when it is added.
 */
export const updateRetailerSchema = z.object({
  name: retailerNameSchema,
});

export type CreateRetailerInput = z.infer<typeof createRetailerSchema>;
export type UpdateRetailerInput = z.infer<typeof updateRetailerSchema>;
