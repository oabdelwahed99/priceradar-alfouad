import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "@/lib/auth/token";
import { createLinkBuilder, isLocalAppUrl, normalizeAppUrl, reportPaths, resolveLink } from "./report-links";

describe("normalizeAppUrl", () => {
  it("keeps the origin and drops trailing slashes", () => {
    expect(normalizeAppUrl(" https://radar.example.com/ ")).toBe("https://radar.example.com");
    expect(normalizeAppUrl("https://example.com/radar/")).toBe("https://example.com/radar");
  });

  it("rejects empty and non-http values", () => {
    expect(normalizeAppUrl("")).toBeNull();
    expect(normalizeAppUrl(undefined)).toBeNull();
    expect(normalizeAppUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeAppUrl("not a url")).toBeNull();
  });
});

describe("isLocalAppUrl", () => {
  it("flags addresses recipients cannot open", () => {
    expect(isLocalAppUrl("http://localhost:3000")).toBe(true);
    expect(isLocalAppUrl("http://127.0.0.1:3000")).toBe(true);
    expect(isLocalAppUrl("https://radar.example.com")).toBe(false);
    expect(isLocalAppUrl(null)).toBe(false);
  });
});

describe("createLinkBuilder", () => {
  it("returns null for every link when no app url is set", () => {
    const link = createLinkBuilder(null);
    expect(resolveLink(link, reportPaths.product("abc"))).toBeNull();
  });

  it("builds absolute links with only the params that are set", () => {
    const link = createLinkBuilder("https://radar.example.com/");
    expect(resolveLink(link, reportPaths.product("abc"))).toBe("https://radar.example.com/products/abc");
    expect(resolveLink(link, reportPaths.productContent("abc"))).toBe(
      "https://radar.example.com/products/abc?tab=content",
    );
    expect(resolveLink(link, reportPaths.alerts("OUT_OF_STOCK"))).toBe(
      "https://radar.example.com/alerts?type=OUT_OF_STOCK",
    );
    expect(resolveLink(link, reportPaths.alerts())).toBe("https://radar.example.com/alerts");
    expect(resolveLink(link, reportPaths.opportunities("restock"))).toBe(
      "https://radar.example.com/opportunities?brand=all&view=restock",
    );
  });

  it("encodes spaces as %20 so the sign-in redirect accepts the link", () => {
    const link = createLinkBuilder("https://radar.example.com");
    const href = resolveLink(link, reportPaths.opportunities("stores", "Hair Care"))!;
    expect(href).toContain("brand=Hair%20Care");
    expect(href).not.toContain("+");

    const url = new URL(href);
    const target = `${url.pathname}${url.search}`;
    expect(safeRedirectPath(target)).toBe(target);
  });

  it("produces redirect-safe paths for every page a report links to", () => {
    const link = createLinkBuilder("https://radar.example.com");
    const targets = [
      reportPaths.dashboard(),
      reportPaths.product("65f1c0a2b3c4d5e6f7a8b9c0"),
      reportPaths.productContent("65f1c0a2b3c4d5e6f7a8b9c0"),
      reportPaths.productsByGap(),
      reportPaths.productsByPosition("OVERPRICED"),
      reportPaths.alerts("PRICE_CHANGE"),
      reportPaths.brand("dermaelle"),
      reportPaths.brands(),
      reportPaths.opportunities("stores", "Dermaelle"),
      reportPaths.content("needs_work"),
      reportPaths.campaigns("our_weakness"),
    ];
    for (const target of targets) {
      const url = new URL(resolveLink(link, target)!);
      const path = `${url.pathname}${url.search}`;
      expect(safeRedirectPath(path)).toBe(path);
    }
  });
});
