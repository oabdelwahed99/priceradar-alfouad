import { describe, expect, it } from "vitest";
import {
  assertScrapableUrl,
  classifyScrapeError,
  detectCurrency,
  normalizeAvailability,
  parsePrice,
  parsePriceAmount,
} from "./utils";
import { ScrapeError } from "./types";

describe("parsePriceAmount", () => {
  it.each([
    ["32", 32],
    ["$32.00", 32],
    ["$1,234.56", 1234.56],
    ["1.234,56 €", 1234.56],
    ["12,50 €", 12.5],
    ["12,500", 12500],
    ["AED 45.5", 45.5],
    ["CHF 1'299.00", 1299],
    ["1 234,56 €", 1234.56],
    ["1\u00A0234,56 €", 1234.56],
    ["KWD 12.750", 12.75],
    ["45.50 60.00", 45.5],
  ])("parses %s", (input, expected) => {
    expect(parsePriceAmount(input)).toBeCloseTo(expected as number, 6);
  });

  it("accepts positive numbers and rejects invalid values", () => {
    expect(parsePriceAmount(19.99)).toBe(19.99);
    expect(parsePriceAmount(0)).toBeNull();
    expect(parsePriceAmount(-5)).toBeNull();
    expect(parsePriceAmount("free")).toBeNull();
    expect(parsePriceAmount("0.00")).toBeNull();
    expect(parsePriceAmount(Number.NaN)).toBeNull();
    expect(parsePriceAmount(null)).toBeNull();
  });
});

describe("detectCurrency", () => {
  it.each([
    ["$32", "USD"],
    ["US$ 32", "USD"],
    ["€12,50", "EUR"],
    ["£9.99", "GBP"],
    ["AED 45", "AED"],
    ["45 د.إ", "AED"],
    ["SAR 99", "SAR"],
    ["E£ 250", "EGP"],
    ["CA$ 20", "CAD"],
    ["no currency here 12.00", null],
  ])("detects %s", (input, expected) => {
    expect(detectCurrency(input)).toBe(expected);
  });

  it("parses price and currency together", () => {
    expect(parsePrice("Now only €24,90")).toEqual({ amount: 24.9, currency: "EUR" });
  });
});

describe("normalizeAvailability", () => {
  it("maps schema.org values", () => {
    expect(normalizeAvailability("https://schema.org/InStock")).toBe("in_stock");
    expect(normalizeAvailability("http://schema.org/OutOfStock")).toBe("out_of_stock");
    expect(normalizeAvailability("PreOrder")).toBe("preorder");
    expect(normalizeAvailability("LimitedAvailability")).toBe("limited");
    expect(normalizeAvailability("something")).toBe("unknown");
    expect(normalizeAvailability(undefined)).toBe("unknown");
  });
});

describe("assertScrapableUrl", () => {
  it("rejects invalid and private URLs", () => {
    expect(() => assertScrapableUrl("not a url")).toThrow(ScrapeError);
    expect(() => assertScrapableUrl("ftp://store.com/x")).toThrow(ScrapeError);
    expect(() => assertScrapableUrl("http://localhost:3000/p")).toThrow(/Private/);
    expect(() => assertScrapableUrl("http://192.168.1.10/p")).toThrow(/Private/);
    expect(assertScrapableUrl("https://store-a.com/p").hostname).toBe("store-a.com");
  });
});

describe("classifyScrapeError", () => {
  it("classifies browser errors", () => {
    const timeout = Object.assign(new Error("page.goto: Timeout 30000ms exceeded."), { name: "TimeoutError" });
    expect(classifyScrapeError(timeout).code).toBe("TIMEOUT");
    expect(classifyScrapeError(new Error("net::ERR_NAME_NOT_RESOLVED at https://x.test")).code).toBe("UNAVAILABLE");
    expect(classifyScrapeError(new Error("net::ERR_CONNECTION_REFUSED")).code).toBe("UNAVAILABLE");
    expect(classifyScrapeError(new Error("page.goto: net::ERR_HTTP2_PROTOCOL_ERROR at https://x.test")).code).toBe("BLOCKED");
    expect(classifyScrapeError(new Error("Target page, context or browser has been closed")).code).toBe("RENDER_FAILURE");
    expect(classifyScrapeError(new Error("browserType.launch: Executable doesn't exist")).message).toMatch(/playwright:install/);
    expect(classifyScrapeError(new ScrapeError("PRICE_NOT_FOUND", "nope")).code).toBe("PRICE_NOT_FOUND");
    expect(classifyScrapeError("weird").code).toBe("UNKNOWN");
  });
});
