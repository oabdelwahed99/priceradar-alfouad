import { z } from "zod";

const brevoEnvSchema = z.object({
  BREVO_API_KEY: z.string().min(1),
  EMAIL_FROM_ADDRESS: z.string().email(),
  EMAIL_FROM_NAME: z.string().min(1).max(120).default("Price Radar"),
});

export type BrevoEnv = z.infer<typeof brevoEnvSchema>;

function nonEmptyEnv(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim() !== "",
    ),
  );
}

/** Returns Brevo settings when configured, otherwise null so the app can still boot. */
export function getBrevoEnv(): BrevoEnv | null {
  const parsed = brevoEnvSchema.safeParse(nonEmptyEnv());
  return parsed.success ? parsed.data : null;
}

export function isEmailConfigured(): boolean {
  return getBrevoEnv() !== null;
}
