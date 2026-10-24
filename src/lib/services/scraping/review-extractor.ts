import { createHash } from "node:crypto";
import type { Cheerio, CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";
import type { ExtractedReview, ExtractionContext } from "./types";
import { normalizeWhitespace } from "./utils";

export const MAX_REVIEWS_PER_PAGE = 50;
export const MAX_REVIEW_TEXT_LENGTH = 1_000;

type JsonObject = Record<string, unknown>;

const isObject = (v: unknown): v is JsonObject => typeof v === "object" && v !== null && !Array.isArray(v);
const asArray = <T>(v: T | T[] | undefined | null): T[] => (v == null ? [] : Array.isArray(v) ? v : [v]);

function hasType(node: JsonObject, ...types: string[]): boolean {
  return asArray(node["@type"] as string | string[]).some(
    (t) => typeof t === "string" && types.includes(t.replace(/^https?:\/\/schema\.org\//, "")),
  );
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

function clipText(text: string | null): string | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_REVIEW_TEXT_LENGTH);
}

function parseDate(raw: string | null): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

export function reviewHash(author: string | null, publishedAt: string | null, text: string): string {
  return createHash("sha256")
    .update([author ?? "", publishedAt ?? "", text].join("\0"))
    .digest("hex")
    .slice(0, 32);
}

function makeReview(partial: {
  author: string | null;
  rating: number | null;
  text: string | null;
  publishedAt: string | null;
}): ExtractedReview | null {
  const text = clipText(partial.text);
  if (!text || text.length < 8) return null;
  const author = clipText(partial.author)?.slice(0, 120) ?? null;
  const publishedAt = parseDate(partial.publishedAt);
  let rating = partial.rating;
  if (rating !== null) {
    if (rating > 5 && rating <= 100) rating = rating / 20;
    if (rating < 0 || rating > 5) rating = null;
    else rating = Math.round(rating * 10) / 10;
  }
  return {
    hash: reviewHash(author, publishedAt, text),
    author,
    rating,
    text,
    publishedAt,
  };
}

function* walkJson(node: unknown, depth = 0): Generator<JsonObject> {
  if (depth > 12) return;
  if (Array.isArray(node)) {
    for (const item of node) yield* walkJson(item, depth + 1);
    return;
  }
  if (!isObject(node)) return;
  yield node;
  for (const [key, value] of Object.entries(node)) {
    if (
      key === "@graph" ||
      key === "mainEntity" ||
      key === "itemListElement" ||
      key === "item" ||
      key === "review" ||
      key === "reviews" ||
      key === "hasVariant"
    ) {
      yield* walkJson(value, depth + 1);
    }
  }
}

function reviewFromJsonLd(node: JsonObject): ExtractedReview | null {
  if (!hasType(node, "Review", "UserReview", "CriticReview")) return null;
  const ratingNode = asArray(node.reviewRating as unknown)
    .concat(asArray(node.rating as unknown))
    .find(isObject);
  const rating = ratingNode ? numberValue(ratingNode.ratingValue) : null;
  const authorNode = node.author;
  const author = isObject(authorNode)
    ? textValue(authorNode.name)
    : textValue(authorNode);
  const text =
    textValue(node.reviewBody) ??
    textValue(node.description) ??
    textValue(node.text) ??
    textValue(node.name);
  return makeReview({
    author,
    rating,
    text,
    publishedAt: textValue(node.datePublished) ?? textValue(node.dateCreated),
  });
}

/** JSON-LD Review nodes anywhere on the page (Product.review, standalone Review, etc.). */
function extractJsonLdReviews($: CheerioAPI): ExtractedReview[] {
  const out: ExtractedReview[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).text();
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      try {
        data = JSON.parse(raw.replace(/,\s*([}\]])/g, "$1"));
      } catch {
        return;
      }
    }
    for (const node of walkJson(data)) {
      const review = reviewFromJsonLd(node);
      if (review) out.push(review);
    }
  });
  return out;
}

function readableText(el: Cheerio<AnyNode>): string | null {
  return normalizeWhitespace(el.clone().find("script, style, noscript, template, svg").remove().end().text());
}

function ratingFromStars(el: Cheerio<AnyNode>): number | null {
  const aria = el.attr("aria-label") ?? el.find("[aria-label]").first().attr("aria-label") ?? "";
  const ariaMatch = aria.match(/(\d+(?:[.,]\d+)?)\s*(?:out of|\/|من)\s*5/i) ?? aria.match(/(\d+(?:[.,]\d+)?)\s*stars?/i);
  if (ariaMatch) {
    const n = Number.parseFloat(ariaMatch[1].replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  const content =
    el.find('[itemprop="ratingValue"]').attr("content") ??
    el.find('[itemprop="ratingValue"]').text() ??
    el.attr("data-score") ??
    el.attr("data-rating") ??
    el.find("[data-score], [data-rating]").first().attr("data-score") ??
    el.find("[data-score], [data-rating]").first().attr("data-rating");
  if (content) {
    const n = Number.parseFloat(String(content).replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  const filled = el.find(
    '.star.filled, .on, .active, [class*="star-full"], [class*="star_full"], .jdgm-star.jdgm--on, .yotpo-icon-star',
  ).length;
  if (filled > 0 && filled <= 5) return filled;
  return null;
}

function reviewFromElement($: CheerioAPI, el: Cheerio<AnyNode>): ExtractedReview | null {
  const bodyEl = el
    .find(
      '[itemprop="reviewBody"], .review-body, .review-content, .review-text, .jdgm-rev__body, .yotpo-review-content, .okeReviews-review-body, .loox-review-content, .comment-text, .woocommerce-review__body, [class*="review-body" i], [class*="review_body" i], [class*="review-content" i]',
    )
    .first();
  const text =
    clipText(bodyEl.length ? readableText(bodyEl) : null) ??
    clipText(
      readableText(
        el
          .clone()
          .find(
            '[itemprop="author"], .review-author, .jdgm-rev__author, .yotpo-user-name, .comment-author, time, .stars, .rating, [class*="star" i]',
          )
          .remove()
          .end(),
      ),
    );
  const authorEl = el
    .find(
      '[itemprop="author"], .review-author, .author, .jdgm-rev__author, .yotpo-user-name, .okeReviews-reviewerName, .comment-author, [class*="reviewer" i], [class*="author" i]',
    )
    .first();
  const author = clipText(authorEl.length ? readableText(authorEl) : null)?.slice(0, 120) ?? null;
  const dateEl = el.find('time, [itemprop="datePublished"], [datetime]').first();
  const publishedAt =
    dateEl.attr("datetime") ?? dateEl.attr("content") ?? clipText(dateEl.length ? readableText(dateEl) : null);
  const ratingEl = el
    .find(
      '[itemprop="reviewRating"], .stars, .rating, .jdgm-rev__rating, .yotpo-review-stars, [class*="star" i], [aria-label*="star" i]',
    )
    .first();
  const rating = ratingEl.length ? ratingFromStars(ratingEl) : ratingFromStars(el);
  return makeReview({ author, rating, text, publishedAt });
}

/** Microdata `[itemprop="review"]` blocks. */
function extractMicrodataReviews($: CheerioAPI): ExtractedReview[] {
  const out: ExtractedReview[] = [];
  $('[itemprop="review"]').each((_, node) => {
    const review = reviewFromElement($, $(node));
    if (review) out.push(review);
  });
  return out;
}

const WIDGET_SELECTORS = [
  ".jdgm-rev",
  ".yotpo-review",
  ".okeReviews-review",
  ".loox-review",
  ".stamped-review",
  ".spr-review",
  ".woocommerce-Reviews .review",
  ".commentlist .review",
  ".commentlist .comment",
  "[data-testid='review']",
  ".product-reviews .review",
  ".salla-reviews .review",
  ".zid-reviews .review",
  "[class*='customer-review' i]",
  "[class*='product-review' i]",
].join(", ");

/** Common review-widget markup (Judge.me, Yotpo, Loox, Okendo, WooCommerce, Salla, Zid, etc.). */
function extractWidgetReviews($: CheerioAPI): ExtractedReview[] {
  const out: ExtractedReview[] = [];
  $(WIDGET_SELECTORS).each((_, node) => {
    const el = $(node);
    if (el.closest("header, footer, nav").length > 0) return;
    const review = reviewFromElement($, el);
    if (review) out.push(review);
  });
  return out;
}

function dedupe(reviews: ExtractedReview[]): ExtractedReview[] {
  const seen = new Set<string>();
  const out: ExtractedReview[] = [];
  for (const review of reviews) {
    if (seen.has(review.hash)) continue;
    seen.add(review.hash);
    out.push(review);
    if (out.length >= MAX_REVIEWS_PER_PAGE) break;
  }
  return out;
}

/**
 * Collects customer reviews from a product page. Prefers structured data, then microdata,
 * then common review-widget selectors. Caps at {@link MAX_REVIEWS_PER_PAGE}.
 */
export function extractReviews({ $ }: ExtractionContext): ExtractedReview[] {
  return dedupe([...extractJsonLdReviews($), ...extractMicrodataReviews($), ...extractWidgetReviews($)]);
}
