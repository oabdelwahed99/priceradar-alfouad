import { describe, expect, it } from "vitest";
import { detectContentAlerts } from "../alerts/alert-rules";
import { buildContentAnalysis, type ContentFields, type ContentPageInput } from "./content-analysis";
import { changedContentFields, contentHash } from "./content.service";

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

const page = (sourceId: string, retailerName: string, isOwnStore: boolean, c: ContentFields | null, versionCount = 1): ContentPageInput => ({
  sourceId,
  retailerName,
  url: `https://${retailerName.toLowerCase().replace(/\s+/g, "")}.example/p`,
  isOwnStore,
  content: c,
  contentSince: c ? new Date("2026-09-01T00:00:00Z") : null,
  lastSeenAt: c ? new Date("2026-09-20T00:00:00Z") : null,
  versionCount: c ? versionCount : 0,
});

const check = (analysis: ReturnType<typeof buildContentAnalysis>, id: string) => analysis.checks.find((c) => c.id === id);

describe("buildContentAnalysis", () => {
  it("reports NO_CONTENT when nothing has been captured", () => {
    const analysis = buildContentAnalysis([page("own", "Glow Store", true, null), page("a", "Store A", false, null)]);
    expect(analysis.status).toBe("NO_CONTENT");
    expect(analysis.score).toBeNull();
    expect(analysis.checks).toEqual([]);
    expect(analysis.pages.every((p) => !p.captured)).toBe(true);
  });

  it("flags a thin, duplicated own page and lists what competitors cover", () => {
    const own = content({
      title: "Shampoo",
      metaDescription: null,
      description: MANUFACTURER_TEXT,
      headings: { h1: [], h2: [], h3: [] },
      bulletPoints: [],
      images: { total: 4, withAlt: 1 },
    });
    const competitor = (extra: string, faq: string[] = []) =>
      content({
        description: `${MANUFACTURER_TEXT} ${extra} Ingredients: aqua, argan oil. Halal certified and cruelty free.`,
        faqQuestions: faq,
        rating: { value: 4.5, count: 20 },
      });
    const analysis = buildContentAnalysis([
      page("own", "Glow Store", true, own),
      page("a", "Store A", false, competitor("Loved by curly hair.", ["Is it safe for colored hair?"]), 3),
      page("b", "Store B", false, competitor("Great for curly hair.")),
      page("c", "Store C", false, null),
    ]);

    expect(analysis.status).toBe("OK");
    expect(analysis.competitorCount).toBe(3);
    expect(analysis.competitorPagesCaptured).toBe(2);
    expect(check(analysis, "title")?.status).toBe("warn");
    expect(check(analysis, "meta_description")?.status).toBe("fail");
    expect(check(analysis, "h1")?.status).toBe("fail");
    expect(check(analysis, "duplicate")?.status).toBe("fail");
    expect(check(analysis, "faq")?.status).toBe("warn");
    expect(check(analysis, "rating")?.status).toBe("warn");
    expect(check(analysis, "image_alt")?.status).toBe("warn");
    expect(check(analysis, "bullets")?.status).toBe("warn");
    expect(check(analysis, "attributes")?.message).toMatch(/ingredients list/);
    expect(analysis.score).toBeLessThan(40);

    const missing = analysis.keywords.missing.map((t) => t.term);
    expect(missing).toContain("curly hair");
    expect(missing).toContain("halal");
    expect(missing).not.toContain("store");

    const halal = analysis.attributes.find((a) => a.id === "halal")!;
    expect(halal.own).toBe(false);
    expect(halal.competitorsWith).toEqual(["Store A", "Store B"]);

    const pageA = analysis.pages.find((p) => p.sourceId === "a")!;
    expect(pageA.versionCount).toBe(3);
    expect(pageA.similarityToOwn).toBe(100);
    expect(analysis.pages.find((p) => p.sourceId === "c")!.captured).toBe(false);
  });

  it("passes a strong, original own page", () => {
    const own = content({
      title: "Argan Oil Shampoo 400ml – Sulfate-Free for Dry Hair",
      description:
        "Our salon-developed cleanser pairs cold-pressed Moroccan argan with plant keratin, rebuilding brittle strands after bleaching, heat styling or swimming. Expect visibly glossier lengths within two weeks, calmer frizz during humid summers and easier detangling for kids. Ingredients: aqua, argan kernel oil, hydrolyzed keratin. How to use: massage into wet hair, rinse, repeat when needed. Sulfate free, halal, cruelty free, curly hair friendly.",
      faqQuestions: ["Can I use it daily?"],
      rating: { value: 4.8, count: 51 },
    });
    const analysis = buildContentAnalysis([
      page("own", "Glow Store", true, own),
      page("a", "Store A", false, content()),
      page("b", "Store B", false, content()),
    ]);
    for (const id of ["title", "meta_description", "h1", "description", "duplicate", "faq", "rating", "image_alt"]) {
      expect(check(analysis, id)?.status, id).toBe("pass");
    }
    expect(analysis.benchmark.own?.descriptionWords).toBeGreaterThan(analysis.benchmark.competitorMedian.descriptionWords!);
  });

  it("still lists competitor terms when your own page is not captured", () => {
    const analysis = buildContentAnalysis([
      page("own", "Glow Store", true, null),
      page("a", "Store A", false, content()),
    ]);
    expect(analysis.ownPageCaptured).toBe(false);
    expect(analysis.checks).toEqual([]);
    expect(analysis.keywords.missing.length).toBeGreaterThan(0);
    expect(analysis.attributes.every((a) => a.own === null)).toBe(true);
  });
});

describe("content versioning", () => {
  it("hashes only the tracked copy fields", () => {
    const a = content();
    expect(contentHash(a)).toBe(contentHash({ ...a }));
    expect(contentHash(a)).toBe(contentHash(content({ rating: { value: 5, count: 999 }, images: { total: 9, withAlt: 0 } })));
    expect(contentHash(a)).not.toBe(contentHash(content({ title: "New title" })));
  });

  it("lists the fields that changed", () => {
    expect(changedContentFields(content(), content({ title: "New", bulletPoints: ["x"] }))).toEqual(["title", "bulletPoints"]);
    expect(changedContentFields(content(), content())).toEqual([]);
  });
});

describe("detectContentAlerts", () => {
  it("raises alerts for competitor page changes only", () => {
    const drafts = detectContentAlerts("Argan Shampoo", [
      { sourceId: "s1", retailerId: "r1", retailerName: "Store A", isOwnStore: false, fields: ["title", "description"] },
      { sourceId: "s2", retailerId: "r2", retailerName: "My Store", isOwnStore: true, fields: ["title"] },
      { sourceId: "s3", retailerId: "r3", retailerName: "Store B", isOwnStore: false, fields: [] },
    ]);
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({
      type: "CONTENT_CHANGE",
      sourceId: "s1",
      title: "Page updated: Store A",
      message: "Store A changed the title and description of its Argan Shampoo page.",
    });
  });
});
