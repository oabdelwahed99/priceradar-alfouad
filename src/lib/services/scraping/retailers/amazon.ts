import { load } from "cheerio";
import { analyzeProductPage } from "../page-analysis";
import type { ScrapedProduct } from "../types";
import { parsePrice } from "../utils";
import { GenericRetailerScraper } from "./generic.scraper";

const UNAVAILABLE = /currently unavailable|out of stock|غير متوفر|نفذت الكمية/i;

export interface AmazonOffer {
  availability: "in_stock" | "out_of_stock";
  /** Buy-box price; null when Amazon shows no offer of its own (only other sellers, or none). */
  price: number | null;
}

/**
 * The price and stock Amazon sells at. Prices elsewhere on the page belong to other sellers
 * and are ignored. No add-to-cart button means the featured offer is gone.
 */
export function readAmazonOffer(html: string): AmazonOffer | null {
  const $ = load(html);
  const hasCart = $("#add-to-cart-button").length > 0;
  const seeAll =
    $("#buybox-see-all-buying-choices, #aod-ingress-link").length > 0 ||
    /see all buying options/i.test($("#buybox, #desktop_buybox").text());
  const unavailable =
    UNAVAILABLE.test($("#availability").text()) || (!hasCart && (seeAll || UNAVAILABLE.test($("#buybox").text())));
  if (!hasCart && !unavailable) return null;

  if (unavailable) return { availability: "out_of_stock", price: null };
  const price = parsePrice(
    $("#corePriceDisplay_desktop_feature_div .a-offscreen, #corePrice_feature_div .a-offscreen").first().text(),
  );
  return price ? { availability: "in_stock", price: price.amount } : null;
}

export class AmazonScraper extends GenericRetailerScraper {
  override readonly name = "amazon";

  override canHandle(url: string): boolean {
    try {
      return /(^|\.)amazon\./i.test(new URL(url).hostname);
    } catch {
      return false;
    }
  }

  override async scrape(url: string): Promise<ScrapedProduct> {
    try {
      const snapshot = await this.loadPage(url);
      const result = analyzeProductPage(snapshot, this.options.strategies);
      const offer = readAmazonOffer(snapshot.html);
      if (!offer) return result;
      if (offer.availability === "out_of_stock") {
        return { ...result, price: 0, originalPrice: null, lowPrice: null, highPrice: null, availability: "out_of_stock" };
      }
      return offer.price === null ? result : { ...result, price: offer.price, availability: "in_stock" };
    } catch (error) {
      return this.failure(url, error);
    }
  }
}
