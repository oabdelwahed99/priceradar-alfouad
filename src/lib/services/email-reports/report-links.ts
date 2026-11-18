/**
 * Deep links from report emails into Price Radar.
 *
 * Query values use encodeURIComponent (spaces become %20, never "+"), because the sign-in
 * redirect only accepts a limited character set. A link opened while signed out goes through
 * /sign-in?next=... and lands on the same page after sign-in.
 */

export type LinkParams = Record<string, string | number | null | undefined>;
export type LinkBuilder = (path: string, params?: LinkParams) => string | null;

/** Returns a clean base URL, or null when it is missing or not http(s). */
export function normalizeAppUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
  } catch {
    return null;
  }
}

export function isLocalAppUrl(appUrl: string | null): boolean {
  if (!appUrl) return false;
  try {
    const host = new URL(appUrl).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".local");
  } catch {
    return false;
  }
}

function queryString(params: LinkParams | undefined): string {
  if (!params) return "";
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") continue;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return parts.length > 0 ? `?${parts.join("&")}` : "";
}

/** Builds absolute links, or returns null for every link when no app URL is configured. */
export function createLinkBuilder(appUrl: string | null): LinkBuilder {
  const base = normalizeAppUrl(appUrl);
  return (path, params) => (base ? `${base}${path}${queryString(params)}` : null);
}

/** Every page a report can send the reader to. Keeps paths in one place. */
export const reportPaths = {
  dashboard: () => ({ path: "/dashboard" }),
  product: (productId: string) => ({ path: `/products/${encodeURIComponent(productId)}` }),
  productContent: (productId: string) => ({
    path: `/products/${encodeURIComponent(productId)}`,
    params: { tab: "content" },
  }),
  productsByGap: () => ({ path: "/products", params: { sort: "gap", order: "desc" } }),
  productsByPosition: (position: string) => ({
    path: "/products",
    params: { position, sort: "gap", order: "desc" },
  }),
  alerts: (type?: string) => ({ path: "/alerts", params: { type } }),
  brand: (slug: string) => ({ path: `/brands/${encodeURIComponent(slug)}` }),
  brands: () => ({ path: "/brands" }),
  opportunities: (view?: "stores" | "restock" | "listings", brand = "all") => ({
    path: "/opportunities",
    params: { brand, view },
  }),
  content: (band?: "needs_work" | "not_captured") => ({ path: "/content", params: { band } }),
  campaigns: (type?: string) => ({ path: "/campaigns", params: { type } }),
  matrix: (position?: string) => ({ path: "/matrix", params: { position } }),
} as const;

export type ReportPath = { path: string; params?: LinkParams };

export function resolveLink(link: LinkBuilder, target: ReportPath): string | null {
  return link(target.path, target.params);
}
