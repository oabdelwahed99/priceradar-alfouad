import { describe, expect, it } from "vitest";
import { formatMoney, formatPercent } from "./format";

describe("formatMoney", () => {
  it("formats ISO currencies", () => {
    expect(formatMoney(34.3, "USD")).toBe("$34.30");
  });
  it("returns a dash for missing values", () => {
    expect(formatMoney(null, "USD")).toBe("—");
  });
});

describe("formatPercent", () => {
  it("adds a sign to positive values", () => {
    expect(formatPercent(9.375)).toBe("+9.38%");
    expect(formatPercent(-8.5714)).toBe("-8.57%");
  });
});
