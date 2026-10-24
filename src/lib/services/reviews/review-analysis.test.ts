import { describe, expect, it } from "vitest";
import {
  analyzeSentiment,
  detectThemes,
  sentimentFromRating,
  sentimentFromText,
  summarizeReviews,
  topComplainedThemes,
  topPraisedThemes,
} from "./review-analysis";

describe("sentimentFromRating", () => {
  it("maps stars to sentiment bands", () => {
    expect(sentimentFromRating(5)).toBe("positive");
    expect(sentimentFromRating(4)).toBe("positive");
    expect(sentimentFromRating(3)).toBe("neutral");
    expect(sentimentFromRating(2)).toBe("negative");
    expect(sentimentFromRating(1)).toBe("negative");
    expect(sentimentFromRating(null)).toBeNull();
  });
});

describe("sentimentFromText", () => {
  it("detects English positive and negative wording", () => {
    expect(sentimentFromText("Amazing soft hair, I love this shampoo")).toBe("positive");
    expect(sentimentFromText("Terrible product, waste of money and damaged bottle")).toBe("negative");
  });

  it("detects Arabic positive and negative wording", () => {
    expect(sentimentFromText("منتج ممتاز ورائحة جميلة")).toBe("positive");
    expect(sentimentFromText("سيء جداً وما أنصح فيه")).toBe("negative");
  });
});

describe("analyzeSentiment", () => {
  it("prefers rating over text", () => {
    expect(analyzeSentiment({ rating: 5, text: "terrible awful waste" })).toBe("positive");
    expect(analyzeSentiment({ rating: 1, text: "amazing love best" })).toBe("negative");
  });

  it("falls back to text when rating is missing", () => {
    expect(analyzeSentiment({ rating: null, text: "Great results and soft hair" })).toBe("positive");
  });
});

describe("detectThemes", () => {
  it("finds English and Arabic cosmetics themes", () => {
    expect(detectThemes("The price is too expensive for this size")).toContain("price");
    expect(detectThemes("Delivery was late and shipping took forever")).toContain("delivery");
    expect(detectThemes("Smell is lovely and the fragrance lasts")).toContain("scent");
    expect(detectThemes("السعر غالي والتوصيل متأخر")).toEqual(
      expect.arrayContaining(["price", "delivery"]),
    );
    expect(detectThemes("تسبب لي حساسية وتهيج")).toContain("irritation");
    expect(detectThemes("مش ينشف البشرة وحمايته عاليه")).toEqual(
      expect.arrayContaining(["texture", "results"]),
    );
    expect(detectThemes("في علبة جت مكسورة")).toContain("packaging");
    expect(detectThemes("بشرتي بتبريك اوت ومنفعش")).toEqual(
      expect.arrayContaining(["irritation", "results"]),
    );
  });
});

describe("summarizeReviews", () => {
  it("aggregates ratings, sentiment, themes and keywords", () => {
    const summary = summarizeReviews([
      { rating: 5, text: "Amazing scent and soft hair, great results" },
      { rating: 5, text: "Love the fragrance, soft shiny hair" },
      { rating: 1, text: "Terrible delivery, late shipping and damaged packaging" },
      { rating: 2, text: "Expensive price and poor value" },
    ]);
    expect(summary.total).toBe(4);
    expect(summary.averageRating).toBe(3.3);
    expect(summary.sentiment.positive).toBe(2);
    expect(summary.sentiment.negative).toBe(2);
    expect(summary.themes.some((t) => t.themeId === "scent" && t.positive >= 1)).toBe(true);
    expect(summary.themes.some((t) => t.themeId === "delivery" && t.negative >= 1)).toBe(true);
    expect(topPraisedThemes(summary.themes)[0]?.themeId).toMatch(/scent|results|texture/);
    expect(topComplainedThemes(summary.themes).some((t) => t.themeId === "delivery" || t.themeId === "price")).toBe(
      true,
    );
    expect(summary.positiveKeywords.length).toBeGreaterThan(0);
    expect(summary.negativeKeywords.length).toBeGreaterThan(0);
  });

  it("returns empty summary for no reviews", () => {
    expect(summarizeReviews([])).toMatchObject({
      total: 0,
      averageRating: null,
      positivePercentage: null,
      themes: [],
    });
  });
});
