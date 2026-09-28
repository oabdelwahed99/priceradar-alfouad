import type { Cheerio, CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";
import { parseFaqQuestions } from "./structured-data";
import type { ExtractionContext, PageContent } from "./types";
import { normalizeWhitespace } from "./utils";

export const MAX_DESCRIPTION_LENGTH = 20_000;
const MAX_LIST_ITEMS = 30;
const MAX_ITEM_LENGTH = 300;
/** Blocks longer than this are page wrappers that happen to match a description selector. */
const MAX_BLOCK_TEXT = 15_000;
const MIN_BLOCK_TEXT = 40;

const DESCRIPTION_SELECTORS = [
  '[itemprop="description"]',
  "[data-product-description]",
  "#description",
  "#product-description",
  "#tab-description",
  ".product-description",
  ".product__description",
  ".product-single__description",
  ".product-details__description",
  ".woocommerce-product-details__short-description",
  ".woocommerce-Tabs-panel--description",
  '[class*="description" i]',
  '[id*="description" i]',
].join(", ");

const CHROME_SELECTOR = "header, footer, nav, aside, [role='navigation'], [role='banner'], [role='contentinfo']";

/** Recommendation carousels, cart drawers, pop-ups and trust badges: headings there are not product copy. */
const RELATED_SELECTOR = [
  ...[
    "related",
    "similar",
    "recommend",
    "upsell",
    "cross-sell",
    "crosssell",
    "recently-viewed",
    "recently_viewed",
    "you-may-also",
    "bought-together",
    "frequently-bought",
    "cart-drawer",
    "mini-cart",
    "minicart",
    "drawer",
    "modal",
    "popup",
    "trust",
  ].flatMap((k) => [`[class*="${k}" i]`, `[id*="${k}" i]`]),
  "[role='dialog']",
].join(", ");

const UI_HEADING_RE =
  /^(language|currency|country|customer reviews?|reviews?|ratings?|similar products|related products|you may also like|recently viewed|frequently bought together|special offers|product comparison|choose your option|newsletter|subscribe|(your )?cart|shopping cart|menu|search|share|filters?|categories|secure payments?|المنتجات (ذات الصلة|المشابهة)|قد يعجبك (أيضا|أيضاً)|آراء العملاء|التقييمات|السلة|اللغة|توصيل مجاني)$/i;

const clip = (text: string | null, max = MAX_ITEM_LENGTH) => (text ? text.slice(0, max) : null);

/** Text a shopper sees: inline <style>/<script> inside description blocks would otherwise leak CSS and JS. */
function readableText(el: Cheerio<AnyNode>): string | null {
  return normalizeWhitespace(el.clone().find("script, style, noscript, template, svg").remove().end().text());
}

function uniqueTexts($: CheerioAPI, elements: Cheerio<AnyNode>, max = MAX_LIST_ITEMS): string[] {
  const out: string[] = [];
  elements.each((_, el) => {
    if (out.length >= max) return false;
    const text = clip(readableText($(el)));
    if (text && !out.includes(text)) out.push(text);
  });
  return out;
}

/** Stops below <body>: template classes on body/html (e.g. "recommendations-enabled") must not hide the whole page. */
const insideRelated = (el: Cheerio<AnyNode>) => el.is(RELATED_SELECTOR) || el.parentsUntil("body").is(RELATED_SELECTOR);

/** Headings that belong to the product's own copy: not site chrome, recommendation tiles or UI widgets. */
function headingTexts($: CheerioAPI, tag: "h1" | "h2" | "h3"): string[] {
  const headings = $(tag).filter((_, node) => {
    const el = $(node);
    if (el.closest(CHROME_SELECTOR).length > 0) return false;
    if (tag !== "h1" && insideRelated(el)) return false;
    if (tag !== "h1" && (el.closest("a").length > 0 || el.find("a").length > 0)) return false;
    const text = readableText(el);
    return Boolean(text) && !UI_HEADING_RE.test(text!.replace(/\s*\(\d+\)$/, "").replace(/[?:!.]+$/, "").trim());
  });
  return uniqueTexts($, headings, 20);
}

/** The longest matching description block that is not a page-level wrapper. */
function findDescriptionBlock($: CheerioAPI): { el: Cheerio<AnyNode>; text: string } | null {
  let best: { el: Cheerio<AnyNode>; text: string } | null = null;
  $(DESCRIPTION_SELECTORS).each((_, node) => {
    const el = $(node);
    if (el.is("meta, script, style, input, textarea") || el.closest(CHROME_SELECTOR).length > 0 || insideRelated(el)) return;
    const text = readableText(el);
    if (!text || text.length < MIN_BLOCK_TEXT || text.length > MAX_BLOCK_TEXT) return;
    if (!best || text.length > best.text.length) best = { el, text };
  });
  return best;
}

function microdataRating($: CheerioAPI): PageContent["rating"] {
  const read = (prop: string) => {
    const el = $(`[itemprop="${prop}"]`).first();
    const raw = el.attr("content") ?? el.text();
    const n = Number.parseFloat(String(raw ?? "").replace(",", "."));
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  const value = read("ratingValue");
  const count = read("reviewCount") ?? read("ratingCount");
  return value === null && count === null ? null : { value, count: count === null ? null : Math.round(count) };
}

/** Page copy and SEO metadata. Pure over the parsed page, like the price extractors. */
export function extractPageContent({ $, structuredData }: ExtractionContext): PageContent {
  const meta = (key: string) =>
    normalizeWhitespace($(`meta[name="${key}"]`).attr("content") ?? $(`meta[property="${key}"]`).attr("content"));

  const metaDescription = meta("description") ?? meta("og:description");
  const ldDescription = structuredData.map((p) => p.description).find(Boolean) ?? null;
  const block = findDescriptionBlock($);

  let description = block?.text ?? null;
  if (ldDescription && (!description || ldDescription.length > description.length)) description = ldDescription;
  description ??= metaDescription;

  const bulletPoints = block ? uniqueTexts($, block.el.find("li")) : [];

  const scope = $("main").length ? $("main") : $("body");
  const images = scope.find("img");
  const withAlt = images.filter((_, el) => Boolean(normalizeWhitespace($(el).attr("alt")))).length;

  const lang = normalizeWhitespace($("html").attr("lang"));

  return {
    title: clip(normalizeWhitespace($("title").first().text())),
    metaDescription: clip(metaDescription, 1_000),
    description: clip(description, MAX_DESCRIPTION_LENGTH),
    headings: { h1: headingTexts($, "h1"), h2: headingTexts($, "h2"), h3: headingTexts($, "h3") },
    bulletPoints,
    faqQuestions: parseFaqQuestions($).slice(0, MAX_LIST_ITEMS).map((q) => q.slice(0, MAX_ITEM_LENGTH)),
    rating: structuredData.map((p) => p.rating).find(Boolean) ?? microdataRating($),
    images: { total: images.length, withAlt },
    language: lang ? lang.toLowerCase().slice(0, 10) : null,
  };
}
