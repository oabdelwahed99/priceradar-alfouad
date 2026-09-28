const SECOND_LEVEL_LABELS = new Set(["co", "com", "net", "org", "gov", "ac", "edu"]);

/** Lowercased hostname without a leading "www.". Throws on invalid URLs. */
export function normalizeDomain(url: string): string {
  const { hostname } = new URL(url);
  return hostname.toLowerCase().replace(/^www\./, "");
}

export function tryNormalizeDomain(url: string): string | null {
  try {
    return normalizeDomain(url);
  } catch {
    return null;
  }
}

const GENERIC_SUBDOMAINS = new Set(["www", "m", "shop", "store", "en", "ar", "fr", "de", "uk", "us"]);

/**
 * Human-friendly default name, e.g. "store-a.com" -> "Store A", "shop.brand.co.uk" -> "Brand",
 * "mystore.example.com" -> "Mystore".
 */
export function retailerNameFromDomain(domain: string): string {
  const labels = domain.split(".").filter(Boolean);
  if (labels.length === 0) return domain;

  let suffixLength = 1;
  const last = labels.length - 1;
  if (labels.length >= 3 && labels[last].length === 2 && SECOND_LEVEL_LABELS.has(labels[last - 1])) {
    suffixLength = 2;
  }
  const hostLabels = labels.slice(0, Math.max(1, labels.length - suffixLength));
  const meaningful = hostLabels.filter((l) => !GENERIC_SUBDOMAINS.has(l));
  const core = meaningful[0] ?? hostLabels[hostLabels.length - 1];

  return core
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
