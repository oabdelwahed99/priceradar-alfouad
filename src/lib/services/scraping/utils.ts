import type { Availability, ScrapeErrorCode } from "@/types";
import { ScrapeError } from "./types";

export const SCRAPE_ERROR_MESSAGES: Record<ScrapeErrorCode, string> = {
  INVALID_URL: "The URL is invalid or not a public http(s) address.",
  ROBOTS_DISALLOWED: "This page is disallowed by the website's robots.txt, so it was not scraped.",
  TIMEOUT: "The page took too long to load.",
  UNAVAILABLE: "The website is unavailable or the page does not exist.",
  BLOCKED: "The website blocked automated access (bot check or access denied).",
  EMPTY_PAGE: "The page loaded but had no content.",
  RENDER_FAILURE: "The page failed to render in the browser.",
  PRICE_NOT_FOUND: "Price could not be extracted.",
  CURRENCY_NOT_FOUND: "Currency could not be determined.",
  UNKNOWN: "An unexpected error occurred while scraping.",
};

const ISO_CODES = [
  "USD", "EUR", "GBP", "AED", "SAR", "EGP", "KWD", "QAR", "BHD", "OMR", "JOD", "CAD", "AUD",
  "NZD", "INR", "JPY", "CNY", "TRY", "CHF", "SEK", "NOK", "DKK", "PLN", "MAD", "ZAR", "SGD",
  "HKD", "MXN", "BRL", "KRW",
] as const;
const ISO_SET = new Set<string>(ISO_CODES);

/** Ordered: multi-character/prefixed symbols must precede their single-character suffixes. */
const SYMBOL_CURRENCIES: [string, string][] = [
  ["US$", "USD"],
  ["CA$", "CAD"],
  ["C$", "CAD"],
  ["AU$", "AUD"],
  ["A$", "AUD"],
  ["NZ$", "NZD"],
  ["HK$", "HKD"],
  ["S$", "SGD"],
  ["R$", "BRL"],
  ["E£", "EGP"],
  ["د.إ", "AED"],
  ["ر.س", "SAR"],
  ["ج.م", "EGP"],
  ["د.ك", "KWD"],
  ["ر.ق", "QAR"],
  ["Dhs", "AED"],
  ["DHS", "AED"],
  ["Dh", "AED"],
  ["SR", "SAR"],
  ["LE", "EGP"],
  ["€", "EUR"],
  ["£", "GBP"],
  ["¥", "JPY"],
  ["₹", "INR"],
  ["₺", "TRY"],
  ["₩", "KRW"],
  ["zł", "PLN"],
  ["$", "USD"],
];

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const CURRENCY_TOKEN = [
  ...ISO_CODES.map((c) => `\\b${c}\\b`),
  ...SYMBOL_CURRENCIES.map(([sym]) => (/^[A-Za-z]+$/.test(sym) ? `\\b${sym}\\b` : escapeRegex(sym))),
].join("|");

/** Grouped thousands ("1,234.56", "1.234,56", "1 234,56", "1'234.50") or plain ("1234.56"). */
const AMOUNT = String.raw`\d{1,3}(?:[.,' ]\d{3})+(?:[.,]\d{1,3})?|\d+(?:[.,]\d{1,3})?`;
const AMOUNT_RE = new RegExp(AMOUNT);

/** Matches a currency-tagged amount on either side, e.g. "AED 45.50", "45,50 €", "$32". */
export function createPriceWithCurrencyRegex(): RegExp {
  return new RegExp(
    `(?:(${CURRENCY_TOKEN})\\s*(${AMOUNT}))|(?:(${AMOUNT})\\s*(${CURRENCY_TOKEN}))`,
    "g",
  );
}

export function normalizeCurrency(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  if (ISO_SET.has(upper)) return upper;
  for (const [sym, code] of SYMBOL_CURRENCIES) {
    if (trimmed === sym) return code;
  }
  return null;
}

/** Finds the first currency (ISO code or symbol) mentioned in a text fragment. */
export function detectCurrency(text: string | null | undefined): string | null {
  if (!text) return null;
  const iso = text.match(new RegExp(`\\b(${ISO_CODES.join("|")})\\b`));
  if (iso) return iso[1];
  for (const [sym, code] of SYMBOL_CURRENCIES) {
    const re = /^[A-Za-z]+$/.test(sym) ? new RegExp(`\\b${sym}\\b`) : new RegExp(escapeRegex(sym));
    if (re.test(text)) return code;
  }
  return null;
}

/**
 * Parses a price amount from a number or a localized string, e.g. "$1,234.56", "1.234,56 €",
 * "AED 45.5", "CHF 1'299.00". Returns null for non-positive or unparseable values.
 */
export function parsePriceAmount(input: unknown): number | null {
  if (typeof input === "number") {
    return Number.isFinite(input) && input > 0 ? input : null;
  }
  if (typeof input !== "string") return null;

  const match = input.replace(/[\u00A0\u202F\u2009]/g, " ").match(AMOUNT_RE);
  if (!match) return null;
  const raw = match[0].replace(/[ ']/g, "");

  const lastDot = raw.lastIndexOf(".");
  const lastComma = raw.lastIndexOf(",");
  let normalized: string;

  if (lastDot !== -1 && lastComma !== -1) {
    const decimalSep = lastDot > lastComma ? "." : ",";
    const thousandsSep = decimalSep === "." ? "," : ".";
    normalized = raw.split(thousandsSep).join("").replace(decimalSep, ".");
  } else if (lastComma !== -1) {
    const parts = raw.split(",");
    const tail = parts[parts.length - 1];
    normalized = parts.length === 2 && tail.length !== 3 ? raw.replace(",", ".") : parts.join("");
  } else if (lastDot !== -1) {
    const parts = raw.split(".");
    normalized = parts.length > 2 ? parts.join("") : raw;
  } else {
    normalized = raw;
  }

  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export interface ParsedPrice {
  amount: number;
  currency: string | null;
}

export function parsePrice(text: string | null | undefined): ParsedPrice | null {
  if (!text) return null;
  const amount = parsePriceAmount(text);
  if (amount === null) return null;
  return { amount, currency: detectCurrency(text) };
}

export function normalizeAvailability(value: unknown): Availability {
  if (typeof value !== "string") return "unknown";
  const v = value.toLowerCase().replace(/^https?:\/\/schema\.org\//, "").replace(/[\s_-]/g, "");
  if (["instock", "instoreonly", "onlineonly", "available"].includes(v)) return "in_stock";
  if (["limitedavailability", "lowstock"].includes(v)) return "limited";
  if (["preorder", "presale", "backorder"].includes(v)) return "preorder";
  if (["outofstock", "soldout", "discontinued", "unavailable"].includes(v)) return "out_of_stock";
  return "unknown";
}

export function normalizeWhitespace(text: string | null | undefined): string | null {
  if (!text) return null;
  const t = text.replace(/\s+/g, " ").trim();
  return t || null;
}

export function toAbsoluteUrl(value: string | null | undefined, base: string): string | null {
  if (!value) return null;
  try {
    return new URL(value, base).toString();
  } catch {
    return null;
  }
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const PRIVATE_HOST_RE =
  /^(localhost|.*\.local|.*\.internal|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|0\.0\.0\.0|\[?::1\]?|169\.254\.\d+\.\d+)$/i;

/** Only public http(s) URLs are scraped. */
export function assertScrapableUrl(url: string, { allowPrivateHosts = false } = {}): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ScrapeError("INVALID_URL", SCRAPE_ERROR_MESSAGES.INVALID_URL);
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new ScrapeError("INVALID_URL", SCRAPE_ERROR_MESSAGES.INVALID_URL);
  }
  if (!allowPrivateHosts && PRIVATE_HOST_RE.test(parsed.hostname)) {
    throw new ScrapeError("INVALID_URL", "Private or local network addresses cannot be scraped.");
  }
  return parsed;
}

/** Maps browser/network errors to a stable error code and a user-facing message. */
export function classifyScrapeError(error: unknown): { code: ScrapeErrorCode; message: string } {
  if (error instanceof ScrapeError) return { code: error.code, message: error.message };
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : String(error);

  if (name === "TimeoutError" || /Timeout \d+ms exceeded|timed out/i.test(message)) {
    return { code: "TIMEOUT", message: SCRAPE_ERROR_MESSAGES.TIMEOUT };
  }
  if (/Executable doesn't exist|browserType\.launch/i.test(message)) {
    return {
      code: "RENDER_FAILURE",
      message: "Browser is not installed on the server. Run `pnpm playwright:install`.",
    };
  }
  if (/ERR_NAME_NOT_RESOLVED|ENOTFOUND|EAI_AGAIN/i.test(message)) {
    return { code: "UNAVAILABLE", message: "The website's domain could not be resolved." };
  }
  if (/ERR_CONNECTION_(REFUSED|RESET|CLOSED|TIMED_OUT)|ERR_ADDRESS_UNREACHABLE|ERR_INTERNET_DISCONNECTED|ECONNREFUSED|ECONNRESET/i.test(message)) {
    return { code: "UNAVAILABLE", message: SCRAPE_ERROR_MESSAGES.UNAVAILABLE };
  }
  if (/ERR_HTTP2_PROTOCOL_ERROR|ERR_BLOCKED_BY_RESPONSE/i.test(message)) {
    return { code: "BLOCKED", message: "The website dropped the connection, which usually means it blocks automated access." };
  }
  if (/ERR_CERT|SSL|certificate/i.test(message)) {
    return { code: "UNAVAILABLE", message: "The website's SSL certificate is invalid." };
  }
  if (/ERR_TOO_MANY_REDIRECTS/i.test(message)) {
    return { code: "UNAVAILABLE", message: "The page redirects too many times." };
  }
  if (/crash|Target (page, context or browser )?closed|has been closed|Navigation failed/i.test(message)) {
    return { code: "RENDER_FAILURE", message: SCRAPE_ERROR_MESSAGES.RENDER_FAILURE };
  }
  return { code: "UNKNOWN", message: SCRAPE_ERROR_MESSAGES.UNKNOWN };
}
