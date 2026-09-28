import { z } from "zod";
import { PRICE_POSITIONS } from "@/types";
import { httpUrlSchema, MAX_COMPETITORS, MIN_COMPETITORS, optionalText } from "./common";

function normalizeForCompare(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    return u.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

const productNameSchema = z
  .string({ error: "Product name is required" })
  .trim()
  .min(2, "Product name must be at least 2 characters")
  .max(200, "Product name must be at most 200 characters");

/** API payload for POST /api/products. */
export const createProductSchema = z
  .object({
    name: productNameSchema,
    brand: optionalText(120),
    category: optionalText(120),
    size: optionalText(60),
    ownStoreUrl: httpUrlSchema,
    competitorUrls: z
      .array(httpUrlSchema)
      .min(MIN_COMPETITORS, `Add at least ${MIN_COMPETITORS} competitor URL`)
      .max(MAX_COMPETITORS, `You can add up to ${MAX_COMPETITORS} competitor URLs`),
  })
  .superRefine((value, ctx) => {
    const own = normalizeForCompare(value.ownStoreUrl);
    const seen = new Map<string, number>();
    value.competitorUrls.forEach((url, index) => {
      const key = normalizeForCompare(url);
      if (key === own) {
        ctx.addIssue({
          code: "custom",
          path: ["competitorUrls", index],
          message: "Competitor URL cannot be the same as your store URL",
        });
      }
      if (seen.has(key)) {
        ctx.addIssue({
          code: "custom",
          path: ["competitorUrls", index],
          message: `Duplicate of competitor ${seen.get(key)! + 1}`,
        });
      } else {
        seen.set(key, index);
      }
    });
  });

export type CreateProductInput = z.infer<typeof createProductSchema>;

/** Client form shape: useFieldArray needs objects, so competitor URLs are wrapped. */
export const productFormSchema = z
  .object({
    name: productNameSchema,
    brand: z.string().trim().max(120).optional(),
    size: z.string().trim().max(60).optional(),
    ownStoreUrl: httpUrlSchema,
    competitors: z
      .array(z.object({ url: httpUrlSchema }))
      .min(MIN_COMPETITORS, `Add at least ${MIN_COMPETITORS} competitor URL`)
      .max(MAX_COMPETITORS, `You can add up to ${MAX_COMPETITORS} competitor URLs`),
  })
  .superRefine((value, ctx) => {
    const own = normalizeForCompare(value.ownStoreUrl);
    const seen = new Set<string>();
    value.competitors.forEach(({ url }, index) => {
      const key = normalizeForCompare(url);
      if (key === own) {
        ctx.addIssue({
          code: "custom",
          path: ["competitors", index, "url"],
          message: "Competitor URL cannot be the same as your store URL",
        });
      } else if (seen.has(key)) {
        ctx.addIssue({
          code: "custom",
          path: ["competitors", index, "url"],
          message: "This URL is already listed",
        });
      }
      seen.add(key);
    });
  });

export type ProductFormValues = z.infer<typeof productFormSchema>;

export const PRODUCT_SORT_FIELDS = [
  "name",
  "brand",
  "ownPrice",
  "marketMedian",
  "gap",
  "suggestedPrice",
  "lastCheckedAt",
] as const;
export type ProductSortField = (typeof PRODUCT_SORT_FIELDS)[number];

export const listProductsQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  position: z.enum(PRICE_POSITIONS).optional(),
  sort: z.enum(PRODUCT_SORT_FIELDS).default("lastCheckedAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
