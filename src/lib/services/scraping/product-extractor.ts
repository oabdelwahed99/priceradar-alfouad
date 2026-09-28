import { load } from "cheerio";
import type { ExtractionContext, ProductInfo } from "./types";
import { parseStructuredProducts } from "./structured-data";
import { normalizeWhitespace, toAbsoluteUrl } from "./utils";

export function createExtractionContext(html: string, url: string): ExtractionContext {
  const $ = load(html);
  return { $, url, structuredData: parseStructuredProducts($, url) };
}

/** Product name, brand and image: JSON-LD first, then microdata, OpenGraph/meta and page headings. */
export function extractProductInfo({ $, url, structuredData }: ExtractionContext): ProductInfo {
  const ld = structuredData.find((p) => p.name) ?? structuredData[0];
  const meta = (key: string) =>
    $(`meta[property="${key}"]`).attr("content") ?? $(`meta[name="${key}"]`).attr("content") ?? null;

  const productName =
    ld?.name ??
    normalizeWhitespace($('[itemprop="name"]').first().attr("content") ?? $('[itemprop="name"]').first().text()) ??
    normalizeWhitespace(meta("og:title")) ??
    normalizeWhitespace($("h1").first().text()) ??
    normalizeWhitespace($("title").first().text());

  const brandEl = $('[itemprop="brand"]').first();
  const brand =
    ld?.brand ??
    normalizeWhitespace(brandEl.find('[itemprop="name"]').attr("content") ?? brandEl.attr("content") ?? brandEl.text()) ??
    normalizeWhitespace(meta("product:brand") ?? meta("og:brand"));

  const imageUrl =
    ld?.image ??
    toAbsoluteUrl(meta("og:image") ?? meta("twitter:image"), url) ??
    toAbsoluteUrl($('[itemprop="image"]').first().attr("content") ?? $('[itemprop="image"]').first().attr("src"), url);

  return {
    productName: productName ? productName.slice(0, 300) : null,
    brand: brand ? brand.slice(0, 120) : null,
    imageUrl,
  };
}
