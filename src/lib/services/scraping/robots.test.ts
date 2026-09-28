import { describe, expect, it } from "vitest";
import { createRobotsPolicy } from "./robots";

const ROBOTS = `
# Example
User-agent: *
Disallow: /checkout
Disallow: /search?
Disallow: /*.json$
Allow: /checkout/help
Crawl-delay: 2

User-agent: BadBot
Disallow: /
`;

describe("robots.txt policy", () => {
  const policy = createRobotsPolicy(ROBOTS, "PriceRadar");

  it("allows product pages", () => {
    expect(policy.isAllowed("https://store.example/product/demo")).toBe(true);
  });

  it("applies disallow rules and wildcards", () => {
    expect(policy.isAllowed("https://store.example/checkout/cart")).toBe(false);
    expect(policy.isAllowed("https://store.example/search?q=x")).toBe(false);
    expect(policy.isAllowed("https://store.example/data/feed.json")).toBe(false);
    expect(policy.isAllowed("https://store.example/data/feed.json?x=1")).toBe(true);
  });

  it("uses the longest match with allow winning", () => {
    expect(policy.isAllowed("https://store.example/checkout/help")).toBe(true);
  });

  it("reads crawl-delay", () => {
    expect(policy.crawlDelaySeconds).toBe(2);
  });

  it("applies agent-specific groups over the wildcard", () => {
    const strict = createRobotsPolicy("User-agent: *\nAllow: /\n\nUser-agent: priceradar\nDisallow: /", "PriceRadar");
    expect(strict.isAllowed("https://store.example/product/x")).toBe(false);
    expect(createRobotsPolicy(ROBOTS, "BadBot").isAllowed("https://store.example/product")).toBe(false);
  });

  it("allows everything for empty robots.txt", () => {
    expect(createRobotsPolicy("").isAllowed("https://store.example/any")).toBe(true);
  });
});
