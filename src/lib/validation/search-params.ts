import type { ZodType } from "zod";

export type RawSearchParams = Record<string, string | string[] | undefined>;

export function firstValues(raw: RawSearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    const v = Array.isArray(value) ? value[0] : value;
    if (v !== undefined && v !== "") out[key] = v;
  }
  return out;
}

/**
 * Parses page search params, dropping invalid keys instead of failing, so a hand-edited
 * URL like `?page=abc&q=serum` still honours `q`. The schema must accept `{}`.
 */
export function parseSearchParamsLenient<T>(schema: ZodType<T>, raw: RawSearchParams): T {
  const values: Record<string, string> = firstValues(raw);
  for (let attempt = 0; attempt < 5; attempt++) {
    const result = schema.safeParse(values);
    if (result.success) return result.data;
    for (const issue of result.error.issues) delete values[String(issue.path[0])];
  }
  return schema.parse({});
}

/** Builds `?a=1&b=2`, omitting empty values. Returns "" when nothing remains. */
export function toQueryString(params: Record<string, string | number | null | undefined>): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== "") sp.set(key, String(value));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}
