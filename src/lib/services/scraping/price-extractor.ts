import type { Cheerio, CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";
import type { Availability } from "@/types";
import type { ExtractionContext, PriceCandidate, PriceStrategy, StructuredOffer } from "./types";
import {
  createPriceWithCurrencyRegex,
  detectCurrency,
  normalizeAvailability,
  normalizeCurrency,
  parsePrice,
  parsePriceAmount,
} from "./utils";

/** Class/id fragments that mark a non-current price (was/compare-at/strikethrough). */
const ORIGINAL_PRICE_HINT = /(old|was|compare|strike|regular|original|before|list|rrp|msrp|crossed)/i;
/**
 * Containers whose prices belong to other products.
 * `carousel` must be its own class token: product galleries use names like `product--vertical-carousel`.
 */
const FOREIGN_CONTAINER =
  /(related|recommend|upsell|cross-?sell|similar|recently|also-?bought|you-?may|(?:^|\s)carousel(?:\s|$)|products?-carousel)/i;
/** Drawers, cards and overlays that repeat a price outside the main product buy box. */
const AUXILIARY_PRICE = /(product-card|card-wrapper|card-product|quick-view|quick-add|compare-drawer|compare-modal|predictive-search|search-modal|menu-drawer)/i;

const CURRENT_PRICE_SELECTORS = [
  ".sale-price",
  ".current-price",
  ".product-price",
  ".price-sale",
  ".special-price",
  ".price--current",
  ".price-current",
  ".price-now",
  ".now-price",
  ".offer-price",
  ".final-price",
  '[class*="sale-price"]',
  '[class*="current-price"]',
  '[class*="product-price"]',
  '[id*="product-price"]',
  '[id*="current-price"]',
  ".price",
  '[class*="price"]',
  '[id*="price"]',
];

const ORIGINAL_PRICE_SELECTORS = [
  ".regular-price",
  ".old-price",
  ".was-price",
  ".compare-at-price",
  ".price--compare",
  ".original-price",
  '[class*="old-price"]',
  '[class*="was-price"]',
  '[class*="compare"]',
  '[class*="regular-price"]',
  '[class*="original-price"]',
  "del",
  "s",
];

const PRICE_ATTRIBUTES = [
  "data-price",
  "data-product-price",
  "data-price-amount",
  "data-sale-price",
  "data-current-price",
  "data-price-value",
  "data-final-price",
];

/** Text content with element boundaries preserved as spaces (cheerio's .text() concatenates siblings). */
function spacedText($: CheerioAPI, $el: Cheerio<AnyNode>): string {
  const $clone = $el.clone();
  $clone.find("script, style, noscript, template").remove();
  $clone.find("*").each((_, child) => {
    $(child).prepend(" ").append(" ");
  });
  return $clone.text().replace(/\s+/g, " ").trim();
}

function attrOrText($el: Cheerio<AnyNode>, attr = "content"): string {
  return ($el.attr(attr) ?? $el.text() ?? "").trim();
}

function classAndId($el: Cheerio<AnyNode>): string {
  return `${$el.attr("class") ?? ""} ${$el.attr("id") ?? ""}`;
}

function elementHint(node: AnyNode | undefined): string {
  const el = node as unknown as { tagName?: string; name?: string; attribs?: Record<string, string> } | undefined;
  if (!el) return "";
  const tag = (el.tagName ?? el.name ?? "").toLowerCase();
  return `${tag} ${el.attribs?.class ?? ""} ${el.attribs?.id ?? ""}`;
}

function isInsideForeignContainer($el: Cheerio<AnyNode>): boolean {
  return $el.parents().toArray().some((p) => FOREIGN_CONTAINER.test(elementHint(p)));
}

function isAuxiliaryPrice($el: Cheerio<AnyNode>): boolean {
  if (AUXILIARY_PRICE.test(`${elementHint($el.get(0))} ${classAndId($el)}`)) return true;
  return $el.parents().toArray().some((p) => AUXILIARY_PRICE.test(elementHint(p)));
}

function isOriginalPriceElement($: CheerioAPI, $el: Cheerio<AnyNode>): boolean {
  if ($el.is("del, s, strike") || $el.closest("del, s, strike").length > 0) return true;
  if (ORIGINAL_PRICE_HINT.test(classAndId($el))) return true;
  return $el.parents().slice(0, 2).toArray().some((p) => ORIGINAL_PRICE_HINT.test(classAndId($(p))));
}

/** Page-level currency fallback: explicit metadata first, then the most frequent symbol/code in visible text. */
export function detectPageCurrency($: CheerioAPI): string | null {
  const explicit =
    normalizeCurrency($('meta[property="product:price:currency"]').attr("content")) ??
    normalizeCurrency($('meta[property="og:price:currency"]').attr("content")) ??
    normalizeCurrency(attrOrText($('[itemprop="priceCurrency"]').first())) ??
    normalizeCurrency($("[data-currency]").first().attr("data-currency")) ??
    normalizeCurrency($("[data-price-currency]").first().attr("data-price-currency"));
  if (explicit) return explicit;

  const text = spacedText($, $("body"));
  const counts = new Map<string, number>();
  for (const m of text.matchAll(createPriceWithCurrencyRegex())) {
    const code = detectCurrency(m[1] ?? m[4] ?? "");
    if (code) counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [code, count] of counts) {
    if (count > bestCount) {
      best = code;
      bestCount = count;
    }
  }
  return best;
}

export function detectAvailabilityFromPage($: CheerioAPI): Availability {
  const micro = normalizeAvailability(
    $('[itemprop="availability"]').first().attr("href") ?? $('[itemprop="availability"]').first().attr("content"),
  );
  if (micro !== "unknown") return micro;
  const og = normalizeAvailability($('meta[property="product:availability"], meta[property="og:availability"]').attr("content"));
  if (og !== "unknown") return og;

  const text = spacedText($, $("main, [role=main], #main, .product, body").first()).toLowerCase();
  if (/\b(out of stock|sold out|currently unavailable|notify me when available)\b/.test(text)) return "out_of_stock";
  if (/\b(add to (cart|bag|basket)|buy now|in stock)\b/.test(text)) return "in_stock";
  return "unknown";
}

function pickBestOffer(offers: StructuredOffer[], pageUrl: string): StructuredOffer | null {
  const priced = offers.filter((o) => o.price !== null);
  if (priced.length === 0) return null;
  const normalize = (u: string) => u.replace(/[?#].*$/, "").replace(/\/$/, "");
  const exact = priced.find((o) => o.url && normalize(new URL(o.url, pageUrl).toString()) === normalize(pageUrl));
  if (exact) return exact;
  const inStock = priced.filter((o) => o.availability === "in_stock" || o.availability === "limited");
  const pool = inStock.length > 0 ? inStock : priced;
  return pool.reduce((min, o) => (o.price! < min.price! ? o : min));
}

export const jsonLdStrategy: PriceStrategy = {
  name: "json-ld",
  extract({ structuredData, url }) {
    for (const product of structuredData) {
      const offer = pickBestOffer(product.offers, url);
      if (!offer || offer.price === null) continue;
      const lows = product.offers.map((o) => o.lowPrice ?? o.price).filter((v): v is number => v !== null);
      const highs = product.offers.map((o) => o.highPrice ?? o.price).filter((v): v is number => v !== null);
      const low = lows.length ? Math.min(...lows) : null;
      const high = highs.length ? Math.max(...highs) : null;
      return {
        price: offer.price,
        currency: offer.currency ?? product.offers.find((o) => o.currency)?.currency ?? null,
        originalPrice: offer.originalPrice && offer.originalPrice > offer.price ? offer.originalPrice : null,
        lowPrice: low !== null && high !== null && low !== high ? low : null,
        highPrice: low !== null && high !== null && low !== high ? high : null,
        availability: offer.availability,
        strategy: "json-ld",
      };
    }
    return null;
  },
};

export const microdataStrategy: PriceStrategy = {
  name: "microdata",
  extract({ $ }) {
    const scope = $('[itemtype*="schema.org/Offer"], [itemtype*="schema.org/Product"]').first();
    const root: Cheerio<AnyNode> = scope.length ? scope : $.root();
    const priceEl = root.find('[itemprop="price"]').first();
    const lowEl = root.find('[itemprop="lowPrice"]').first();
    const price = parsePriceAmount(attrOrText(priceEl)) ?? parsePriceAmount(attrOrText(lowEl));
    if (price === null) return null;
    const currency =
      normalizeCurrency(attrOrText(root.find('[itemprop="priceCurrency"]').first())) ??
      detectCurrency(priceEl.text());
    const availEl = root.find('[itemprop="availability"]').first();
    return {
      price,
      currency,
      originalPrice: null,
      lowPrice: parsePriceAmount(attrOrText(lowEl)),
      highPrice: parsePriceAmount(attrOrText(root.find('[itemprop="highPrice"]').first())),
      availability: normalizeAvailability(availEl.attr("href") ?? availEl.attr("content") ?? availEl.text()),
      strategy: "microdata",
    };
  },
};

export const metaStrategy: PriceStrategy = {
  name: "meta",
  extract({ $ }) {
    const meta = (prop: string) =>
      $(`meta[property="${prop}"]`).attr("content") ?? $(`meta[name="${prop}"]`).attr("content");
    const sale = parsePriceAmount(meta("product:sale_price:amount"));
    const regular = parsePriceAmount(meta("product:price:amount") ?? meta("og:price:amount"));
    const price = sale ?? regular;
    if (price === null) return null;
    const currency = normalizeCurrency(
      meta("product:sale_price:currency") ?? meta("product:price:currency") ?? meta("og:price:currency"),
    );
    const original = parsePriceAmount(meta("product:original_price:amount")) ?? (sale !== null ? regular : null);
    return {
      price,
      currency,
      originalPrice: original !== null && original > price ? original : null,
      lowPrice: null,
      highPrice: null,
      availability: normalizeAvailability(meta("product:availability") ?? meta("og:availability")),
      strategy: "meta",
    };
  },
};

export const attributeStrategy: PriceStrategy = {
  name: "attributes",
  extract({ $ }) {
    for (const attr of PRICE_ATTRIBUTES) {
      const els = $(`[${attr}]`).toArray().slice(0, 20);
      for (const el of els) {
        const $el = $(el);
        if (isInsideForeignContainer($el) || isOriginalPriceElement($, $el)) continue;
        const raw = $el.attr(attr) ?? "";
        let price = parsePriceAmount(raw);
        // Some platforms store minor units (e.g. data-price="3200" for 32.00) alongside a formatted text.
        const textPrice = parsePrice($el.text());
        if (price !== null && textPrice && Number.isInteger(price) && Math.abs(price / 100 - textPrice.amount) < 0.005) {
          price = textPrice.amount;
        }
        if (price === null) continue;
        const currency =
          normalizeCurrency($el.attr("data-currency") ?? $el.attr("data-price-currency")) ??
          textPrice?.currency ??
          null;
        return {
          price,
          currency,
          originalPrice: null,
          lowPrice: null,
          highPrice: null,
          availability: "unknown",
          strategy: "attributes",
        };
      }
    }
    return null;
  },
};

function findOriginalPrice($: CheerioAPI, currentPrice: number): number | null {
  for (const selector of ORIGINAL_PRICE_SELECTORS) {
    for (const el of $(selector).toArray().slice(0, 10)) {
      const $el = $(el);
      if (isInsideForeignContainer($el)) continue;
      const text = $el.text().trim();
      if (!text || text.length > 40) continue;
      const parsed = parsePrice(text);
      if (parsed && parsed.amount > currentPrice && parsed.amount < currentPrice * 5) return parsed.amount;
    }
  }
  return null;
}

export const selectorStrategy: PriceStrategy = {
  name: "selectors",
  extract({ $ }) {
    const seen = new Set<AnyNode>();
    for (const selector of CURRENT_PRICE_SELECTORS) {
      for (const el of $(selector).toArray().slice(0, 30)) {
        if (seen.has(el)) continue;
        seen.add(el);
        const $el = $(el);
        if ($el.is("script, style, meta, link, input")) continue;
        if (isInsideForeignContainer($el) || isOriginalPriceElement($, $el)) continue;
        // Prefer leaf-ish nodes: skip containers wrapping multiple prices (e.g. "$32 $35").
        const $clean = $el.clone();
        $clean.find("del, s, strike").remove();
        $clean.find("*").filter((_, child) => ORIGINAL_PRICE_HINT.test(classAndId($(child)))).remove();
        const text = $clean.text().replace(/\s+/g, " ").trim();
        if (!text || text.length > 60) continue;
        const parsed = parsePrice(text);
        if (!parsed) continue;
        if (!parsed.currency && !/\d[.,]\d{2}\b/.test(text)) continue;
        return {
          price: parsed.amount,
          currency: parsed.currency,
          originalPrice: findOriginalPrice($, parsed.amount),
          lowPrice: null,
          highPrice: null,
          availability: "unknown",
          strategy: "selectors",
        };
      }
    }
    return null;
  },
};

export const visibleTextStrategy: PriceStrategy = {
  name: "visible-text",
  extract({ $ }) {
    const root = $("main, [role=main], #main, #content, .product").first();
    const $scope = (root.length ? root : $("body")).clone();
    $scope.find("script, style, noscript, header, footer, nav, del, s, strike").remove();
    $scope.find("*").filter((_, el) => FOREIGN_CONTAINER.test(classAndId($(el)))).remove();
    const text = spacedText($, $scope);
    for (const m of text.matchAll(createPriceWithCurrencyRegex())) {
      const amountText = m[2] ?? m[3];
      const currencyText = m[1] ?? m[4];
      const amount = parsePriceAmount(amountText);
      if (amount === null) continue;
      return {
        price: amount,
        currency: detectCurrency(currencyText),
        originalPrice: null,
        lowPrice: null,
        highPrice: null,
        availability: "unknown",
        strategy: "visible-text",
      };
    }
    return null;
  },
};

interface DisplayedSale {
  price: number;
  currency: string | null;
  compareAt: number | null;
  /** True when the theme marks this as the sale price, not only an `<ins>` wrapper. */
  explicitSale: boolean;
}

const SALE_ITEM_SELECTOR = '[class*="price-item--sale"], ins';

/** Main buy-box price only. Cards, quick view and compare drawers repeat other prices. */
const MAIN_PRICE_SCOPES = [
  '[id^="price-"][id*="__main"]',
  'section[id*="__main"] .product__block--price',
  ".product__info-wrapper [id^='price-']",
  ".product__block--price",
  ".entry-summary .price",
  ".summary .price",
  ".product-info-price",
  ".productView-price",
];

function sameAmount(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.02;
}

function readWidgetSale($: CheerioAPI, $widget: Cheerio<AnyNode>): DisplayedSale | null {
  for (const el of $widget.find(SALE_ITEM_SELECTOR).toArray().slice(0, 8)) {
    const $el = $(el);
    if ($el.closest("del, s, strike").length > 0) continue;
    if (ORIGINAL_PRICE_HINT.test(classAndId($el)) || isAuxiliaryPrice($el)) continue;
    const text = $el.text().replace(/\s+/g, " ").trim();
    if (!text || text.length > 60) continue;
    const parsed = parsePrice(text);
    if (!parsed) continue;

    let compareAt: number | null = null;
    for (const struck of $widget.find("del, s, strike").toArray().slice(0, 6)) {
      const struckText = $(struck).text().replace(/\s+/g, " ").trim();
      if (!struckText || struckText.length > 40) continue;
      const compare = parsePrice(struckText);
      if (compare && compare.amount > parsed.amount && compare.amount < parsed.amount * 5) {
        compareAt = compare.amount;
        break;
      }
    }
    const explicitSale = /price-item--sale/.test(classAndId($el)) || /on-sale/.test(classAndId($widget));
    return { price: parsed.amount, currency: parsed.currency, compareAt, explicitSale };
  }
  return null;
}

/**
 * Selling price shown in the main product price block. SEO JSON-LD and Open Graph on Shopify
 * often publish the compare-at price while the theme shows a lower sale price.
 */
function readMainDisplayedSale($: CheerioAPI): DisplayedSale | null {
  const seen = new Set<AnyNode>();
  for (const selector of MAIN_PRICE_SCOPES) {
    for (const el of $(selector).toArray().slice(0, 6)) {
      if (seen.has(el)) continue;
      seen.add(el);
      const $scope = $(el);
      if (isInsideForeignContainer($scope) || isAuxiliaryPrice($scope)) continue;

      const widgets = $scope.is('[class*="--on-sale"], [class*="on-sale"]')
        ? [$scope]
        : $scope.find('[class*="--on-sale"]').toArray().slice(0, 4).map((node) => $(node));
      for (const $widget of widgets) {
        const sale = readWidgetSale($, $widget);
        if (sale) return sale;
      }
      const direct = readWidgetSale($, $scope);
      if (direct) return direct;
    }
  }
  return null;
}

function reconcileDisplayedSale(candidate: PriceCandidate, $: CheerioAPI): PriceCandidate {
  const displayed = readMainDisplayedSale($);
  if (!displayed || !(displayed.price > 0)) return candidate;

  const compareMatches = displayed.compareAt !== null && sameAmount(displayed.compareAt, candidate.price);
  const saleMatches = sameAmount(displayed.price, candidate.price);

  if (displayed.price < candidate.price && (compareMatches || (displayed.compareAt === null && displayed.explicitSale))) {
    const original = displayed.compareAt ?? candidate.price;
    return {
      ...candidate,
      price: displayed.price,
      currency: candidate.currency ?? displayed.currency,
      originalPrice: original > displayed.price ? original : candidate.originalPrice,
    };
  }

  if (saleMatches && displayed.compareAt !== null && displayed.compareAt > candidate.price) {
    if (candidate.originalPrice === null || displayed.compareAt > candidate.originalPrice) {
      return { ...candidate, originalPrice: displayed.compareAt };
    }
  }

  return candidate;
}

/** Default extraction order. Retailer adapters can prepend their own strategies. */
export const DEFAULT_PRICE_STRATEGIES: PriceStrategy[] = [
  jsonLdStrategy,
  microdataStrategy,
  metaStrategy,
  attributeStrategy,
  selectorStrategy,
  visibleTextStrategy,
];

/**
 * Runs strategies in order and returns the first price found. Missing currency/availability are
 * filled from page-level signals so a strong price source is not discarded for lacking metadata.
 */
export function extractPrice(
  ctx: ExtractionContext,
  strategies: PriceStrategy[] = DEFAULT_PRICE_STRATEGIES,
): PriceCandidate | null {
  for (const strategy of strategies) {
    let candidate: PriceCandidate | null = null;
    try {
      candidate = strategy.extract(ctx);
    } catch {
      candidate = null;
    }
    if (!candidate || !(candidate.price > 0)) continue;

    const reconciled = reconcileDisplayedSale(candidate, ctx.$);
    return {
      ...reconciled,
      currency: reconciled.currency ?? detectPageCurrency(ctx.$),
      availability: reconciled.availability !== "unknown" ? reconciled.availability : detectAvailabilityFromPage(ctx.$),
    };
  }
  return null;
}
