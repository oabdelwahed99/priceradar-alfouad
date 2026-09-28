import { z } from "zod";

export const MAX_COMPETITORS = 20;
export const MIN_COMPETITORS = 1;

export const httpUrlSchema = z
  .string({ error: "URL is required" })
  .trim()
  .min(1, "URL is required")
  .max(2048, "URL is too long")
  .pipe(
    z.url({
      protocol: /^https?$/,
      hostname: z.regexes.domain,
      error: "Enter a valid http(s) URL, e.g. https://store.com/product/item",
    }),
  );

export const currencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "Currency must be a 3-letter ISO code, e.g. USD");

export const priceSchema = z
  .number({ error: "Price must be a number" })
  .finite("Price must be a finite number")
  .positive("Price must be greater than zero");

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be at most ${max} characters`)
    .optional()
    .transform((v) => (v ? v : undefined));
