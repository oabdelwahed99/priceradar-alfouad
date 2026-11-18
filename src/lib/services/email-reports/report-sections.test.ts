import { describe, expect, it } from "vitest";
import { audienceHas, audienceLabel, audiencePurpose, sectionsForAudience } from "./report-sections";

describe("sectionsForAudience", () => {
  it("gives the CEO decisions, competitor moves and brand risk", () => {
    expect(sectionsForAudience("ceo")).toEqual(["decisions", "priceChanges", "brandCompliance"]);
  });

  it("gives sales the call list first", () => {
    expect(sectionsForAudience("sales")).toEqual([
      "storeBriefs",
      "restocks",
      "storeCompliance",
      "outOfStock",
      "newListings",
      "unopenedDoors",
    ]);
  });

  it("gives marketing content and review angles", () => {
    expect(sectionsForAudience("marketing")).toEqual(["contentHealth", "contentChanges", "campaignInsights"]);
  });

  it("includes every role's sections without duplicates for the all audience", () => {
    const all = sectionsForAudience("all");
    expect(new Set(all).size).toBe(all.length);
    for (const audience of ["ceo", "sales", "marketing"] as const) {
      for (const id of sectionsForAudience(audience)) expect(all).toContain(id);
    }
  });
});

describe("audienceHas", () => {
  it("lets the builder skip data a role never reads", () => {
    expect(audienceHas("marketing", "decisions")).toBe(false);
    expect(audienceHas("ceo", "contentHealth")).toBe(false);
    expect(audienceHas("sales", "storeBriefs")).toBe(true);
  });
});

describe("labels", () => {
  it("labels audiences and describes their purpose", () => {
    expect(audienceLabel("ceo")).toBe("CEO");
    expect(audienceLabel("all")).toBe("All teams");
    expect(audiencePurpose("sales")).toContain("Stores to call");
  });
});
