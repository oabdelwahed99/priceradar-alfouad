import { load, type CheerioAPI } from "cheerio";
import type { StructuredOffer, StructuredProduct } from "./types";
import { normalizeAvailability, normalizeCurrency, normalizeWhitespace, parsePriceAmount, toAbsoluteUrl } from "./utils";

type JsonObject = Record<string, unknown>;

const isObject = (v: unknown): v is JsonObject => typeof v === "object" && v !== null && !Array.isArray(v);
const asArray = <T>(v: T | T[] | undefined | null): T[] => (v == null ? [] : Array.isArray(v) ? v : [v]);

function hasType(node: JsonObject, ...types: string[]): boolean {
  return asArray(node["@type"] as string | string[]).some(
    (t) => typeof t === "string" && types.includes(t.replace(/^https?:\/\/schema\.org\//, "")),
  );
}

/** Lenient JSON parse: tolerates HTML comments/CDATA wrappers and trailing commas. */
function parseJsonLoose(text: string): unknown {
  const cleaned = text
    .replace(/^\s*<!--|-->\s*$/g, "")
    .replace(/^\s*\/\/<!\[CDATA\[|\/\/\]\]>\s*$/g, "")
    .trim();
  if (!cleaned) return null;
  try {
    return JSON.parse(cleaned);
  } catch {
    try {
      return JSON.parse(cleaned.replace(/,\s*([}\]])/g, "$1").replace(/[\u0000-\u001F]+/g, " "));
    } catch {
      return null;
    }
  }
}

/** Walks the JSON-LD graph (arrays, @graph, nested objects) and yields every object node. */
function* walk(node: unknown, depth = 0): Generator<JsonObject> {
  if (depth > 12) return;
  if (Array.isArray(node)) {
    for (const item of node) yield* walk(item, depth + 1);
    return;
  }
  if (!isObject(node)) return;
  yield node;
  for (const [key, value] of Object.entries(node)) {
    if (key === "offers" || key === "hasVariant" || key === "@graph" || key === "mainEntity" || key === "itemListElement" || key === "item") {
      yield* walk(value, depth + 1);
    }
  }
}

function textValue(v: unknown): string | null {
  if (typeof v === "string") return normalizeWhitespace(v);
  if (typeof v === "number") return String(v);
  if (isObject(v)) return textValue(v.name ?? v["@value"]);
  if (Array.isArray(v)) return textValue(v[0]);
  return null;
}

function numberValue(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number.parseFloat(v.replace(",", ".")) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function ratingValue(v: unknown): StructuredProduct["rating"] {
  const node = asArray(v as unknown).find(isObject);
  if (!node) return null;
  const value = numberValue(node.ratingValue);
  const count = numberValue(node.reviewCount ?? node.ratingCount);
  return value === null && count === null ? null : { value, count: count === null ? null : Math.round(count) };
}

/** Descriptions may carry HTML markup or entities; returns plain text. */
function plainText(v: unknown): string | null {
  const text = typeof v === "string" ? v : Array.isArray(v) ? v.find((x) => typeof x === "string") : null;
  if (!text) return null;
  return normalizeWhitespace(load(`<div>${text}</div>`)("div").first().text());
}

function imageValue(v: unknown, base: string): string | null {
  if (typeof v === "string") return toAbsoluteUrl(v, base);
  if (Array.isArray(v)) return imageValue(v[0], base);
  if (isObject(v)) return imageValue(v.url ?? v.contentUrl, base);
  return null;
}

function parseOffer(node: JsonObject): StructuredOffer[] {
  if (hasType(node, "AggregateOffer")) {
    const low = parsePriceAmount(node.lowPrice);
    const high = parsePriceAmount(node.highPrice);
    const nested = asArray(node.offers as unknown).filter(isObject).flatMap(parseOffer);
    const currency = normalizeCurrency(node.priceCurrency);
    const price = parsePriceAmount(node.price) ?? low;
    const aggregate: StructuredOffer = {
      price,
      currency,
      originalPrice: null,
      lowPrice: low,
      highPrice: high,
      availability: normalizeAvailability(node.availability),
      url: typeof node.url === "string" ? node.url : null,
    };
    return [aggregate, ...nested.map((o) => ({ ...o, currency: o.currency ?? currency }))];
  }

  let price = parsePriceAmount(node.price);
  let currency = normalizeCurrency(node.priceCurrency);
  let originalPrice: number | null = null;

  for (const spec of asArray(node.priceSpecification as unknown).filter(isObject)) {
    const specPrice = parsePriceAmount(spec.price);
    const priceType = String(spec.priceType ?? "").replace(/^https?:\/\/schema\.org\//, "");
    if (specPrice === null) continue;
    if (/ListPrice|StrikethroughPrice|MSRP/i.test(priceType)) {
      originalPrice = specPrice;
    } else if (price === null) {
      price = specPrice;
    }
    currency = currency ?? normalizeCurrency(spec.priceCurrency);
  }

  return [
    {
      price,
      currency,
      originalPrice,
      lowPrice: parsePriceAmount(node.lowPrice),
      highPrice: parsePriceAmount(node.highPrice),
      availability: normalizeAvailability(node.availability),
      url: typeof node.url === "string" ? node.url : null,
    },
  ];
}

export function parseStructuredProducts($: CheerioAPI, baseUrl: string): StructuredProduct[] {
  const products: StructuredProduct[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    const data = parseJsonLoose($(el).text());
    if (data == null) return;
    for (const node of walk(data)) {
      if (!hasType(node, "Product", "ProductGroup", "IndividualProduct", "ProductModel")) continue;
      const offers = asArray(node.offers as unknown).filter(isObject).flatMap(parseOffer);
      for (const variant of asArray(node.hasVariant as unknown).filter(isObject)) {
        offers.push(...asArray(variant.offers as unknown).filter(isObject).flatMap(parseOffer));
      }
      products.push({
        name: textValue(node.name),
        brand: textValue(node.brand ?? node.manufacturer),
        image: imageValue(node.image, baseUrl),
        sku: textValue(node.sku ?? node.gtin13 ?? node.gtin),
        description: plainText(node.description),
        rating: ratingValue(node.aggregateRating),
        offers,
      });
    }
  });

  return products;
}

/** Question texts from JSON-LD `FAQPage` blocks. */
export function parseFaqQuestions($: CheerioAPI): string[] {
  const questions: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const data = parseJsonLoose($(el).text());
    if (data == null) return;
    for (const node of walk(data)) {
      if (!hasType(node, "Question")) continue;
      const text = textValue(node.name) ?? plainText(node.text);
      if (text && !questions.includes(text)) questions.push(text);
    }
  });
  return questions;
}
