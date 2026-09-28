import { describe, expect, it } from "vitest";
import { analyzeProductPage, type PageSnapshot } from "./page-analysis";
import { ScrapeError } from "./types";

const snap = (overrides: Partial<PageSnapshot>): PageSnapshot => ({
  url: "https://store-b.example/p/1",
  finalUrl: "https://store-b.example/p/1",
  html: "<html><body><main><h1>Demo Product</h1><span class='price'>$31.00</span><button>Add to cart</button></main></body></html>",
  title: "Demo Product",
  visibleText: "Demo Product $31.00 Add to cart",
  httpStatus: 200,
  ...overrides,
});

function codeOf(fn: () => unknown): string | null {
  try {
    fn();
    return null;
  } catch (e) {
    return e instanceof ScrapeError ? e.code : "OTHER";
  }
}

describe("analyzeProductPage", () => {
  it("returns a structured success result", () => {
    const result = analyzeProductPage(snap({}));
    expect(result).toMatchObject({
      success: true,
      price: 31,
      currency: "USD",
      productName: "Demo Product",
      availability: "in_stock",
      strategy: "selectors",
      warnings: [],
    });
    expect(new Date(result.scrapedAt).getTime()).not.toBeNaN();
  });

  it("classifies blocked pages without attempting to bypass them", () => {
    expect(codeOf(() => analyzeProductPage(snap({ httpStatus: 403 })))).toBe("BLOCKED");
    expect(codeOf(() => analyzeProductPage(snap({ httpStatus: 429 })))).toBe("BLOCKED");
    expect(codeOf(() => analyzeProductPage(snap({ title: "Just a moment..." })))).toBe("BLOCKED");
    expect(
      codeOf(() => analyzeProductPage(snap({ visibleText: "Please verify you are a human to continue", html: "<html></html>" }))),
    ).toBe("BLOCKED");
  });

  it("classifies unavailable, empty and priceless pages", () => {
    expect(codeOf(() => analyzeProductPage(snap({ httpStatus: 404 })))).toBe("UNAVAILABLE");
    expect(codeOf(() => analyzeProductPage(snap({ httpStatus: 502 })))).toBe("UNAVAILABLE");
    expect(codeOf(() => analyzeProductPage(snap({ html: "<html><body></body></html>", visibleText: "" })))).toBe("EMPTY_PAGE");
    expect(
      codeOf(() =>
        analyzeProductPage(snap({ html: "<html><body><main><h1>Demo</h1><p>Coming soon to our store.</p></main></body></html>", visibleText: "Demo Coming soon to our store." })),
      ),
    ).toBe("PRICE_NOT_FOUND");
  });

  it("warns when currency cannot be determined", () => {
    const result = analyzeProductPage(
      snap({
        html: "<html><body><main><h1>Demo Product</h1><span data-price='12.50'>12.50</span></main></body></html>",
        visibleText: "Demo Product 12.50",
      }),
    );
    expect(result.currency).toBeNull();
    expect(result.warnings).toContain("CURRENCY_NOT_FOUND");
  });
});
