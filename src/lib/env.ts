import { z } from "zod";

const serverEnvSchema = z.object({
  MONGODB_URI: z
    .string({ error: "MONGODB_URI is not set. Add it to .env.local (see .env.example)." })
    .min(1, "MONGODB_URI is not set. Add it to .env.local (see .env.example)."),
  MONGODB_DB: z.string().min(1).default("price_radar"),
  DEFAULT_WORKSPACE_ID: z.string().min(1).default("default"),
  SCRAPER_CONCURRENCY: z.coerce.number().int().min(1).max(5).default(3),
  SCRAPER_TIMEOUT_MS: z.coerce.number().int().min(5_000).max(120_000).default(30_000),
  SCRAPER_DOMAIN_DELAY_MS: z.coerce.number().int().min(0).max(60_000).default(1_500),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

/** Hosting dashboards often store unset variables as "", which would bypass Zod defaults. */
function nonEmptyEnv(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim() !== "",
    ),
  );
}

export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverEnvSchema.safeParse(nonEmptyEnv());
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join("; "));
  }
  cached = parsed.data;
  return cached;
}

/** Scraper settings are read independently so scraping works without a database configured. */
export function getScraperSettings() {
  const schema = serverEnvSchema.pick({
    SCRAPER_CONCURRENCY: true,
    SCRAPER_TIMEOUT_MS: true,
    SCRAPER_DOMAIN_DELAY_MS: true,
  });
  return schema.parse(nonEmptyEnv());
}
