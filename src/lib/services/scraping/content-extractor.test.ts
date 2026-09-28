import { describe, expect, it } from "vitest";
import { extractPageContent } from "./content-extractor";
import { analyzeContentPage, analyzeProductPage } from "./page-analysis";
import { createExtractionContext } from "./product-extractor";
import { ScrapeError } from "./types";

const URL = "https://store.example/products/argan-shampoo";

const extract = (html: string) => extractPageContent(createExtractionContext(html, URL));

const PRODUCT_PAGE = `<!doctype html>
<html lang="en-US">
<head>
  <title>Argan Oil Shampoo 400ml – Store</title>
  <meta name="description" content="Sulfate-free argan oil shampoo for dry and damaged hair.">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "Argan Oil Shampoo",
    "description": "<p>Short &amp; sweet.</p>",
    "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.6", "reviewCount": "128" },
    "offers": { "@type": "Offer", "price": "59.00", "priceCurrency": "SAR", "availability": "https://schema.org/InStock" }
  }
  </script>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      { "@type": "Question", "name": "Is it safe for colored hair?", "acceptedAnswer": { "@type": "Answer", "text": "Yes." } },
      { "@type": "Question", "name": "How often should I use it?", "acceptedAnswer": { "@type": "Answer", "text": "Daily." } }
    ]
  }
  </script>
</head>
<body>
  <header><nav><h2>Shop by category</h2></nav></header>
  <main>
    <h1>Argan Oil Shampoo</h1>
    <img src="/a.jpg" alt="Argan shampoo bottle"><img src="/b.jpg" alt=""><img src="/c.jpg">
    <div class="product__description">
      <h2>Why you'll love it</h2>
      <p>A gentle, sulfate-free cleanser enriched with Moroccan argan oil that restores shine to dry, damaged hair.</p>
      <ul><li>Sulfate-free formula</li><li>Paraben-free</li><li>Sulfate-free formula</li></ul>
      <h3>How to use</h3>
      <p>Apply to wet hair, massage and rinse.</p>
    </div>
  </main>
  <footer><h2>Newsletter</h2></footer>
</body>
</html>`;

describe("extractPageContent", () => {
  it("reads title, meta description, headings, bullets, FAQ, rating, images and language", () => {
    const content = extract(PRODUCT_PAGE);
    expect(content.title).toBe("Argan Oil Shampoo 400ml – Store");
    expect(content.metaDescription).toBe("Sulfate-free argan oil shampoo for dry and damaged hair.");
    expect(content.headings).toEqual({ h1: ["Argan Oil Shampoo"], h2: ["Why you'll love it"], h3: ["How to use"] });
    expect(content.bulletPoints).toEqual(["Sulfate-free formula", "Paraben-free"]);
    expect(content.faqQuestions).toEqual(["Is it safe for colored hair?", "How often should I use it?"]);
    expect(content.rating).toEqual({ value: 4.6, count: 128 });
    expect(content.images).toEqual({ total: 3, withAlt: 1 });
    expect(content.language).toBe("en-us");
  });

  it("prefers the fuller page description over a short structured-data one", () => {
    const content = extract(PRODUCT_PAGE);
    expect(content.description).toContain("Moroccan argan oil");
    expect(content.description).toContain("Apply to wet hair");
  });

  it("uses the structured-data description (HTML stripped) when the page has no description block", () => {
    const html = `<html><head><script type="application/ld+json">
      {"@type":"Product","name":"Serum","description":"<p>Hyaluronic acid serum that hydrates skin &amp; plumps fine lines for a smoother look.</p>"}
      </script></head><body><h1>Serum</h1></body></html>`;
    expect(extract(html).description).toBe("Hyaluronic acid serum that hydrates skin & plumps fine lines for a smoother look.");
  });

  it("falls back to the meta description and handles Arabic pages", () => {
    const html = `<html lang="ar" dir="rtl"><head><title>شامبو بزيت الأرجان</title>
      <meta property="og:description" content="شامبو خالي من السلفات للشعر الجاف والتالف"></head>
      <body><h1>شامبو بزيت الأرجان</h1></body></html>`;
    const content = extract(html);
    expect(content.description).toBe("شامبو خالي من السلفات للشعر الجاف والتالف");
    expect(content.language).toBe("ar");
    expect(content.headings.h1).toEqual(["شامبو بزيت الأرجان"]);
  });

  it("skips headings from recommendation carousels, product tiles and UI widgets", () => {
    const html = `<html><body class="template-product recommendations-enabled"><main>
      <h1>Leave-In Cream</h1>
      <h2>Key Active Ingredient</h2>
      <h2>How to use ?</h2>
      <h2>Language</h2>
      <h2>Customer Reviews</h2>
      <section class="related-products"><h2>Similar Products</h2><h3>Other Shampoo 300ml</h3></section>
      <div class="grid"><h2><a href="/p/2">Serum 102ml</a></h2></div>
    </main></body></html>`;
    const { headings } = extract(html);
    expect(headings.h1).toEqual(["Leave-In Cream"]);
    expect(headings.h2).toEqual(["Key Active Ingredient", "How to use ?"]);
    expect(headings.h3).toEqual([]);
  });

  it("drops inline styles and scripts from description text", () => {
    const html = `<html><body><h1>X</h1><div class="product-description">
      <style>.rcp { font-weight: bold; max-width: 100px; }</style><script>var tracking = true;</script>
      <p>Lightweight leave-in cream that detangles and protects curly hair from frizz.</p></div></body></html>`;
    expect(extract(html).description).toBe("Lightweight leave-in cream that detangles and protects curly hair from frizz.");
  });

  it("ignores wrappers that are too large to be a description", () => {
    const filler = "word ".repeat(4_000);
    const html = `<html><body><div class="page-description-wrapper">${filler}</div><h1>X</h1></body></html>`;
    expect(extract(html).description).toBeNull();
  });

  it("returns empty collections when nothing is present", () => {
    const content = extract("<html><body><p>Hello</p></body></html>");
    expect(content).toMatchObject({
      title: null,
      metaDescription: null,
      description: null,
      bulletPoints: [],
      faqQuestions: [],
      rating: null,
      images: { total: 0, withAlt: 0 },
      language: null,
    });
  });
});

describe("analyzeContentPage", () => {
  const snapshot = (html: string, overrides = {}) => ({
    url: URL,
    finalUrl: URL,
    html,
    title: "Serum",
    visibleText: "Serum Hydrating serum for dry skin",
    httpStatus: 200,
    ...overrides,
  });

  it("succeeds on pages without a detectable price", () => {
    const html = `<html><head><title>Serum</title></head><body><h1>Serum</h1><div class="product-description">Hydrating serum for dry skin with hyaluronic acid and niacinamide.</div></body></html>`;
    const result = analyzeContentPage(snapshot(html));
    expect(result.success).toBe(true);
    expect(result.content.description).toContain("hyaluronic acid");
  });

  it("still rejects blocked pages", () => {
    expect(() => analyzeContentPage(snapshot("<html></html>", { httpStatus: 403 }))).toThrow(ScrapeError);
  });
});

describe("analyzeProductPage content", () => {
  it("attaches page content to successful scrapes", () => {
    const result = analyzeProductPage({
      url: URL,
      finalUrl: URL,
      html: PRODUCT_PAGE,
      title: "Argan Oil Shampoo 400ml – Store",
      visibleText: "Argan Oil Shampoo SAR 59.00 Add to cart",
      httpStatus: 200,
    });
    expect(result.price).toBe(59);
    expect(result.content?.faqQuestions).toHaveLength(2);
  });
});
