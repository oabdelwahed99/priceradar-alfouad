import { describe, expect, it } from "vitest";
import { normalizeDomain, retailerNameFromDomain, tryNormalizeDomain } from "./domain";

describe("normalizeDomain", () => {
  it("lowercases and strips www", () => {
    expect(normalizeDomain("https://WWW.Store-A.com/product/x?y=1")).toBe("store-a.com");
  });
  it("keeps other subdomains", () => {
    expect(normalizeDomain("https://shop.brand.co.uk/p")).toBe("shop.brand.co.uk");
  });
  it("returns null for invalid URLs in the safe variant", () => {
    expect(tryNormalizeDomain("not a url")).toBeNull();
  });
});

describe("retailerNameFromDomain", () => {
  it("derives readable names", () => {
    expect(retailerNameFromDomain("store-a.com")).toBe("Store A");
    expect(retailerNameFromDomain("mystore.com")).toBe("Mystore");
    expect(retailerNameFromDomain("shop.brand.co.uk")).toBe("Brand");
    expect(retailerNameFromDomain("noon.com")).toBe("Noon");
    expect(retailerNameFromDomain("mystore.example.com")).toBe("Mystore");
    expect(retailerNameFromDomain("demo-competitor-a.example")).toBe("Demo Competitor A");
  });
});
