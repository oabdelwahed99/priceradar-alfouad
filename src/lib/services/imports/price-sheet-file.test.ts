import { describe, expect, it } from "vitest";
import { roundPrice, setCellPrice } from "./price-sheet-file";

describe("setCellPrice", () => {
  it("replaces an existing price and keeps other fields", () => {
    const src = `        noon: { url: "https://a.com/p", price: 145, outOfStock: true },\n`;
    expect(setCellPrice(src, "https://a.com/p", 160)).toBe(
      `        noon: { url: "https://a.com/p", price: 160, outOfStock: true },\n`,
    );
  });

  it("adds a price to a one-line cell without one", () => {
    const src = `        amazon: { url: "https://a.com/p" },\n`;
    expect(setCellPrice(src, "https://a.com/p", 99.5)).toBe(`        amazon: { url: "https://a.com/p", price: 99.5 },\n`);
  });

  it("adds a price to a multi-line cell without one", () => {
    const src = `        noon: {\n          url: "https://a.com/p",\n        },\n`;
    expect(setCellPrice(src, "https://a.com/p", 10)).toBe(
      `        noon: {\n          url: "https://a.com/p",\n          price: 10,\n        },\n`,
    );
  });

  it("only touches the cell with the matching url", () => {
    const src = `a: { url: "https://a.com/1", price: 1 },\nb: { url: "https://a.com/12", price: 2 },\n`;
    expect(setCellPrice(src, "https://a.com/1", 5)).toBe(
      `a: { url: "https://a.com/1", price: 5 },\nb: { url: "https://a.com/12", price: 2 },\n`,
    );
  });

  it("updates every cell sharing the url", () => {
    const src = `a: { url: "https://a.com/1", price: 1 },\nb: { url: "https://a.com/1" },\n`;
    expect(setCellPrice(src, "https://a.com/1", 3)).toBe(
      `a: { url: "https://a.com/1", price: 3 },\nb: { url: "https://a.com/1", price: 3 },\n`,
    );
  });

  it("returns the source unchanged when the url is missing", () => {
    const src = `a: { url: "https://a.com/1", price: 1 },\n`;
    expect(setCellPrice(src, "https://b.com", 3)).toBe(src);
  });
});

describe("roundPrice", () => {
  it("rounds to cents", () => {
    expect(roundPrice(219.340000001)).toBe(219.34);
  });
});
