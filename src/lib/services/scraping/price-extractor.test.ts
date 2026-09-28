import { describe, expect, it } from "vitest";
import {
  attributeStrategy,
  extractPrice,
  jsonLdStrategy,
  metaStrategy,
  microdataStrategy,
  selectorStrategy,
  visibleTextStrategy,
} from "./price-extractor";
import { createExtractionContext, extractProductInfo } from "./product-extractor";
import type { PriceStrategy } from "./types";

const URL_ = "https://store-a.example/product/demo-cleanser";
const ctx = (body: string, head = "") =>
  createExtractionContext(`<html><head>${head}</head><body>${body}</body></html>`, URL_);

const jsonLd = (data: unknown) => `<script type="application/ld+json">${JSON.stringify(data)}</script>`;

describe("JSON-LD extraction", () => {
  it("extracts price, currency and availability from a Product offer", () => {
    const c = ctx(
      "",
      jsonLd({
        "@context": "https://schema.org",
        "@type": "Product",
        name: "Demo Foaming Cleanser 236ml",
        brand: { "@type": "Brand", name: "Demo Brand" },
        image: ["https://cdn.example/demo.jpg"],
        offers: { "@type": "Offer", price: "32.00", priceCurrency: "USD", availability: "https://schema.org/InStock" },
      }),
    );
    expect(extractPrice(c)).toMatchObject({ price: 32, currency: "USD", availability: "in_stock", strategy: "json-ld" });
    expect(extractProductInfo(c)).toEqual({
      productName: "Demo Foaming Cleanser 236ml",
      brand: "Demo Brand",
      imageUrl: "https://cdn.example/demo.jpg",
    });
  });

  it("handles @graph, AggregateOffer lowPrice/highPrice", () => {
    const c = ctx(
      "",
      jsonLd({
        "@graph": [
          { "@type": "WebPage", name: "x" },
          {
            "@type": ["Product"],
            name: "Demo Serum",
            offers: { "@type": "AggregateOffer", lowPrice: 18.5, highPrice: 29, priceCurrency: "EUR", offerCount: 3 },
          },
        ],
      }),
    );
    expect(jsonLdStrategy.extract(c)).toMatchObject({ price: 18.5, currency: "EUR", lowPrice: 18.5, highPrice: 29 });
  });

  it("reads priceSpecification with a strikethrough original price", () => {
    const c = ctx(
      "",
      jsonLd({
        "@type": "Product",
        name: "Demo Cream",
        offers: {
          "@type": "Offer",
          priceCurrency: "GBP",
          priceSpecification: [
            { "@type": "UnitPriceSpecification", price: 24.99 },
            { "@type": "UnitPriceSpecification", price: 29.99, priceType: "https://schema.org/StrikethroughPrice" },
          ],
        },
      }),
    );
    expect(jsonLdStrategy.extract(c)).toMatchObject({ price: 24.99, originalPrice: 29.99, currency: "GBP" });
  });

  it("prefers the in-stock lowest offer when multiple offers exist", () => {
    const c = ctx(
      "",
      jsonLd({
        "@type": "Product",
        name: "Demo Toner",
        offers: [
          { "@type": "Offer", price: 15, priceCurrency: "USD", availability: "OutOfStock" },
          { "@type": "Offer", price: 17, priceCurrency: "USD", availability: "InStock" },
          { "@type": "Offer", price: 19, priceCurrency: "USD", availability: "InStock" },
        ],
      }),
    );
    expect(jsonLdStrategy.extract(c)).toMatchObject({ price: 17, availability: "in_stock" });
  });

  it("tolerates invalid JSON-LD and falls through to the next strategy", () => {
    const c = ctx(
      `<div itemscope itemtype="https://schema.org/Product"><span itemprop="name">Demo</span>
        <div itemprop="offers" itemscope itemtype="https://schema.org/Offer">
          <meta itemprop="price" content="21.00"><meta itemprop="priceCurrency" content="AED">
          <link itemprop="availability" href="https://schema.org/OutOfStock">
        </div></div>`,
      `<script type="application/ld+json">{ "@type": "Product", "offers": { broken </script>`,
    );
    expect(extractPrice(c)).toMatchObject({ price: 21, currency: "AED", availability: "out_of_stock", strategy: "microdata" });
  });
});

describe("microdata / meta / attributes", () => {
  it("reads itemprop price text with currency symbol", () => {
    const c = ctx(`<div itemscope itemtype="http://schema.org/Offer"><span itemprop="price">€19,90</span></div>`);
    expect(microdataStrategy.extract(c)).toMatchObject({ price: 19.9, currency: "EUR" });
  });

  it("reads OpenGraph product price meta tags and sale price", () => {
    const c = ctx(
      "",
      `<meta property="product:price:amount" content="35.00"><meta property="product:price:currency" content="USD">
       <meta property="product:sale_price:amount" content="31.00">`,
    );
    expect(metaStrategy.extract(c)).toMatchObject({ price: 31, originalPrice: 35, currency: "USD" });
  });

  it("reads data-price attributes and converts minor units when text confirms", () => {
    const c = ctx(`<span class="amount" data-price="3200" data-currency="USD">$32.00</span>`);
    expect(attributeStrategy.extract(c)).toMatchObject({ price: 32, currency: "USD" });
    const plain = ctx(`<div data-product-price="27.5">AED 27.50</div>`);
    expect(attributeStrategy.extract(plain)).toMatchObject({ price: 27.5, currency: "AED" });
  });
});

describe("selector extraction", () => {
  it("prefers the sale price and captures the old price, ignoring related products", () => {
    const c = ctx(`
      <div class="product-info">
        <h1>Demo Cleanser</h1>
        <div class="price-box">
          <span class="old-price">$35.00</span>
          <span class="sale-price">$31.00</span>
        </div>
      </div>
      <section class="related-products"><span class="sale-price">$9.00</span></section>`);
    expect(selectorStrategy.extract(c)).toMatchObject({ price: 31, originalPrice: 35, currency: "USD" });
  });

  it("strips strikethrough prices from a combined price container", () => {
    const c = ctx(`<p class="price"><del>£40.00</del> <ins>£32.50</ins></p>`);
    expect(selectorStrategy.extract(c)).toMatchObject({ price: 32.5, currency: "GBP" });
  });

  it("ignores price containers with large text blocks", () => {
    const c = ctx(`<div class="pricing-policy">We match prices on thousands of items, terms apply for 12.00 promotions and more text here</div>`);
    expect(selectorStrategy.extract(c)).toBeNull();
  });
});

describe("visible text fallback", () => {
  it("finds a currency-tagged price in main content", () => {
    const c = ctx(`<header>Free shipping over $50</header><main><h1>Demo Mask</h1><p>Price: AED 45.50</p></main>`);
    expect(visibleTextStrategy.extract(c)).toMatchObject({ price: 45.5, currency: "AED" });
  });
});

describe("extractPrice chain", () => {
  it("returns null when no price exists", () => {
    expect(extractPrice(ctx("<main><h1>Demo</h1><p>Contact us for pricing.</p></main>"))).toBeNull();
  });

  it("fills currency from page-level signals when the strategy lacks it", () => {
    const c = ctx(`<span data-price="12.99">12.99</span><p>All prices in SAR. Shipping SAR 15</p>`);
    expect(extractPrice(c)).toMatchObject({ price: 12.99, currency: "SAR", strategy: "attributes" });
  });

  it("detects availability from page text when structured data lacks it", () => {
    const c = ctx(`<main><span class="price">$20.00</span><button>Sold out</button></main>`);
    expect(extractPrice(c)).toMatchObject({ price: 20, availability: "out_of_stock" });
  });

  it("supports custom retailer strategies ahead of the defaults", () => {
    const custom: PriceStrategy = {
      name: "retailer-x",
      extract: ({ $ }) => {
        const v = Number($("#rx-price").attr("data-v"));
        return v > 0
          ? { price: v, currency: "USD", originalPrice: null, lowPrice: null, highPrice: null, availability: "in_stock", strategy: "retailer-x" }
          : null;
      },
    };
    const c = ctx(`<i id="rx-price" data-v="42"></i><span class="price">$99.00</span>`);
    expect(extractPrice(c, [custom, selectorStrategy])).toMatchObject({ price: 42, strategy: "retailer-x" });
  });
});
