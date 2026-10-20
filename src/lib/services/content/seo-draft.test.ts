import { describe, expect, it } from "vitest";
import { ValidationError } from "@/lib/errors";
import { buildContentAnalysis, type ContentFields, type ContentPageInput } from "./content-analysis";
import { buildSeoDraftPrompt, parseSeoDraftResponse } from "./seo-draft";

const MANUFACTURER_TEXT =
  "This nourishing argan oil shampoo gently cleanses dry damaged hair restoring natural shine softness strength moisture balance without heavy residue leaving hair smooth manageable fragrant. Sulfate free formula with keratin.";

const content = (overrides: Partial<ContentFields> = {}): ContentFields => ({
  title: "Argan Oil Shampoo 400ml for Dry Hair | Glow Store",
  metaDescription: "Sulfate-free argan oil shampoo with keratin that restores shine to dry, damaged hair. Free delivery.",
  description: MANUFACTURER_TEXT,
  headings: { h1: ["Argan Oil Shampoo"], h2: ["Benefits", "How to use"], h3: [] },
  bulletPoints: ["Sulfate-free", "With keratin"],
  faqQuestions: [],
  rating: null,
  images: { total: 4, withAlt: 4 },
  language: "en",
  ...overrides,
});

const page = (sourceId: string, retailerName: string, isOwnStore: boolean, c: ContentFields | null): ContentPageInput => ({
  sourceId,
  retailerName,
  url: `https://${retailerName.toLowerCase().replace(/\s+/g, "")}.example/p`,
  isOwnStore,
  content: c,
  contentSince: c ? new Date("2026-09-01T00:00:00Z") : null,
  lastSeenAt: c ? new Date("2026-09-20T00:00:00Z") : null,
  versionCount: c ? 1 : 0,
});

function thinOwnAnalysis() {
  const own = content({
    title: "Shampoo",
    metaDescription: null,
    description: MANUFACTURER_TEXT,
    headings: { h1: [], h2: [], h3: [] },
    bulletPoints: [],
    images: { total: 4, withAlt: 1 },
  });
  const competitor = content({
    description: `${MANUFACTURER_TEXT} Loved by curly hair. Ingredients: aqua, argan oil. Halal certified and cruelty free.`,
    faqQuestions: ["Is it safe for colored hair?"],
    rating: { value: 4.5, count: 20 },
  });
  return buildContentAnalysis([
    page("own", "Glow Store", true, own),
    page("a", "Store A", false, competitor),
    page("b", "Store B", false, competitor),
  ]);
}

describe("buildSeoDraftPrompt", () => {
  it("includes failing checks, missing keywords, length targets, and competitor structure without description bodies", () => {
    const analysis = thinOwnAnalysis();
    const prompt = buildSeoDraftPrompt({ name: "Argan Oil Shampoo", brand: "Glow", size: "400ml" }, analysis);

    expect(prompt).toContain("Argan Oil Shampoo");
    expect(prompt).toContain("Brand: Glow");
    expect(prompt).toContain("Size: 400ml");
    expect(prompt).toMatch(/Page title: 30–65 characters/);
    expect(prompt).toMatch(/Meta description: 70–160 characters/);
    expect(prompt).toMatch(/at least \d+ words/);
    expect(prompt).toMatch(/Meta description \(fail\)/);
    expect(prompt).toMatch(/Main heading \(H1\) \(fail\)/);
    expect(prompt).toContain("curly hair");
    expect(prompt).toMatch(/Halal|Ingredients list|Cruelty-free/i);
    expect(prompt).toContain("Store A:");
    expect(prompt).toContain("FAQ: Is it safe for colored hair?");
    expect(prompt).not.toContain("Loved by curly hair. Ingredients: aqua");
    expect(prompt).toContain("Do NOT assert them as facts");
  });
});

describe("parseSeoDraftResponse", () => {
  const valid = {
    title: "Argan Oil Shampoo 400ml – Sulfate-Free for Dry Hair",
    metaDescription: "Sulfate-free argan oil shampoo with keratin that restores shine to dry, damaged hair. Shop Glow.",
    h1: "Argan Oil Shampoo 400ml",
    description: "Our argan oil shampoo gently cleanses dry damaged hair and restores shine.",
    headings: ["Benefits", "How to use"],
    bulletPoints: ["Sulfate-free", "With keratin"],
    faq: [{ question: "Can I use it daily?", answer: "Yes, when your hair needs a gentle cleanse." }],
    unverifiedFacts: ["Halal"],
  };

  it("parses a valid model JSON payload", () => {
    expect(parseSeoDraftResponse(JSON.stringify(valid))).toEqual(valid);
  });

  it("rejects non-JSON", () => {
    expect(() => parseSeoDraftResponse("not json")).toThrow(ValidationError);
  });

  it("rejects payloads missing required fields", () => {
    expect(() => parseSeoDraftResponse(JSON.stringify({ title: "Only title" }))).toThrow(ValidationError);
  });
});
