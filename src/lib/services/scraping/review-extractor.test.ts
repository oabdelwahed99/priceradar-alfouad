import { describe, expect, it } from "vitest";
import { createExtractionContext } from "./product-extractor";
import { extractReviews, MAX_REVIEWS_PER_PAGE, reviewHash } from "./review-extractor";

const URL = "https://store.example/products/argan-shampoo";
const extract = (html: string) => extractReviews(createExtractionContext(html, URL));

describe("extractReviews", () => {
  it("reads JSON-LD Review nodes nested under Product", () => {
    const html = `<html><head><script type="application/ld+json">
    {
      "@type": "Product",
      "name": "Argan Shampoo",
      "review": [
        {
          "@type": "Review",
          "author": { "@type": "Person", "name": "Sara" },
          "datePublished": "2024-06-01",
          "reviewBody": "Amazing shampoo, my hair feels soft and shiny after one wash.",
          "reviewRating": { "@type": "Rating", "ratingValue": "5" }
        },
        {
          "@type": "Review",
          "author": "Omar",
          "reviewBody": "Smell is too strong and packaging arrived damaged.",
          "reviewRating": { "@type": "Rating", "ratingValue": 2 }
        }
      ]
    }
    </script></head><body></body></html>`;
    const reviews = extract(html);
    expect(reviews).toHaveLength(2);
    expect(reviews[0]).toMatchObject({
      author: "Sara",
      rating: 5,
      text: expect.stringContaining("Amazing shampoo"),
      publishedAt: "2024-06-01T00:00:00.000Z",
    });
    expect(reviews[1]).toMatchObject({ author: "Omar", rating: 2 });
    expect(reviews[0].hash).toBe(
      reviewHash("Sara", "2024-06-01T00:00:00.000Z", reviews[0].text),
    );
  });

  it("reads microdata reviews", () => {
    const html = `<html><body>
      <div itemprop="review" itemscope itemtype="https://schema.org/Review">
        <span itemprop="author">Layla</span>
        <meta itemprop="datePublished" content="2024-03-15">
        <div itemprop="reviewRating" itemscope><meta itemprop="ratingValue" content="4"></div>
        <p itemprop="reviewBody">Good value for money and fast delivery to Riyadh.</p>
      </div>
    </body></html>`;
    const reviews = extract(html);
    expect(reviews).toHaveLength(1);
    expect(reviews[0]).toMatchObject({
      author: "Layla",
      rating: 4,
      text: "Good value for money and fast delivery to Riyadh.",
    });
  });

  it("reads Judge.me / WooCommerce style widgets", () => {
    const html = `<html><body>
      <div class="jdgm-rev">
        <span class="jdgm-rev__author">Nora</span>
        <div class="jdgm-rev__rating" aria-label="5 stars"></div>
        <div class="jdgm-rev__body">Best leave-in cream I have tried for curly hair.</div>
      </div>
      <ol class="commentlist">
        <li class="review">
          <strong class="woocommerce-review__author">Huda</strong>
          <div class="star-rating" aria-label="Rated 3 out of 5"></div>
          <div class="description">Average results, nothing special about the scent.</div>
        </li>
      </ol>
    </body></html>`;
    const reviews = extract(html);
    expect(reviews.length).toBeGreaterThanOrEqual(1);
    expect(reviews.some((r) => r.author === "Nora" && r.rating === 5)).toBe(true);
  });

  it("dedupes by hash and caps at MAX_REVIEWS_PER_PAGE", () => {
    const items = Array.from({ length: 60 }, (_, i) => ({
      "@type": "Review",
      author: `User${i}`,
      reviewBody: `This is a unique review number ${i} about the product quality and results.`,
      reviewRating: { "@type": "Rating", ratingValue: "4" },
    }));
    // Duplicate the first review once.
    items.push({ ...items[0] });
    const html = `<html><head><script type="application/ld+json">
      ${JSON.stringify({ "@type": "Product", review: items })}
    </script></head><body></body></html>`;
    const reviews = extract(html);
    expect(reviews).toHaveLength(MAX_REVIEWS_PER_PAGE);
    const hashes = new Set(reviews.map((r) => r.hash));
    expect(hashes.size).toBe(reviews.length);
  });

  it("ignores tiny or empty review bodies", () => {
    const html = `<html><head><script type="application/ld+json">
    {
      "@type": "Product",
      "review": [
        { "@type": "Review", "author": "A", "reviewBody": "ok", "reviewRating": { "ratingValue": 5 } },
        { "@type": "Review", "author": "B", "reviewBody": "Really soft hair after using this shampoo daily.", "reviewRating": { "ratingValue": 5 } }
      ]
    }
    </script></head><body></body></html>`;
    const reviews = extract(html);
    expect(reviews).toHaveLength(1);
    expect(reviews[0].author).toBe("B");
  });

  it("handles Arabic review text", () => {
    const html = `<html lang="ar"><head><script type="application/ld+json">
    {
      "@type": "Product",
      "review": [{
        "@type": "Review",
        "author": "نورة",
        "reviewBody": "منتج ممتاز ورائحة جميلة والتوصيل كان سريع جداً.",
        "reviewRating": { "@type": "Rating", "ratingValue": "5" }
      }]
    }
    </script></head><body></body></html>`;
    const reviews = extract(html);
    expect(reviews).toHaveLength(1);
    expect(reviews[0].author).toBe("نورة");
    expect(reviews[0].text).toContain("ممتاز");
    expect(reviews[0].rating).toBe(5);
  });
});
