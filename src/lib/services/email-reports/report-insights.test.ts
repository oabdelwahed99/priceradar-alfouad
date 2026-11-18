import { describe, expect, it } from "vitest";
import {
  deriveActions,
  deriveHeadline,
  deriveKpis,
  deriveReportInsights,
  kpisToSnapshot,
} from "./report-insights";
import { createLinkBuilder } from "./report-links";
import { alertItem, decision, makeBody, TEST_APP_URL } from "./report-test-fixtures";

const link = createLinkBuilder(TEST_APP_URL);

/** Intl currency output uses a non-breaking space between code and amount. */
const plain = (value: string) => value.replace(/\u00a0/g, " ");

describe("CEO insights", () => {
  it("turns an overpriced product into a ranked 'lower the price' action with a link", () => {
    const body = makeBody({
      decisionsTotal: 1,
      decisionsNeeded: [decision({ gapPercentage: 33.3, suggestedPrice: 310 })],
    });
    const actions = deriveActions(body, link);
    expect(actions[0]).toMatchObject({ priority: "high", href: `${TEST_APP_URL}/products/p1` });
    expect(plain(actions[0].title)).toBe("Lower Hyalu Serum to EGP 310.00");
    expect(actions[0].detail).toContain("33% above the market median");
  });

  it("describes margin left on the table for an underpriced product", () => {
    const body = makeBody({
      decisionsTotal: 1,
      decisionsNeeded: [
        decision({
          productId: "p2",
          productName: "Cica Cream",
          direction: "raise",
          gapPercentage: -18,
          ownPrice: 150,
          marketMedian: 183,
          suggestedPrice: 180,
          priceChange: 30,
          position: "UNDERPRICED",
          href: `${TEST_APP_URL}/products/p2`,
        }),
      ],
    });
    const [action] = deriveActions(body, link);
    expect(plain(action.title)).toBe("Raise Cica Cream to EGP 180.00");
    expect(action.detail).toContain("18% below the market median");
    expect(plain(action.detail)).toContain("EGP 30.00");
    expect(action.priority).toBe("medium");
  });

  it("flags a big competitor price cut and partner undercutting", () => {
    const body = makeBody({
      priceChanges: [alertItem({ changePercentage: -22 })],
      brandCompliance: [
        {
          brandName: "Dermaelle",
          brandSlug: "dermaelle",
          belowOfficial: 12,
          aboveOfficial: 1,
          outOfStock: 2,
          productCount: 20,
          storeCount: 5,
          href: `${TEST_APP_URL}/brands/dermaelle`,
        },
      ],
    });
    const actions = deriveActions(body, link);
    expect(actions.map((a) => a.id)).toEqual(expect.arrayContaining(["cut-a1", "below-official"]));
    expect(actions.every((a) => a.priority === "high")).toBe(true);
    expect(actions.find((a) => a.id === "below-official")?.href).toBe(`${TEST_APP_URL}/brands/dermaelle`);
  });

  it("caps the list at five actions and puts high priority first", () => {
    const body = makeBody({
      decisionsTotal: 6,
      decisionsNeeded: [
        decision({ productId: "a", productName: "A", gapPercentage: 12 }),
        decision({ productId: "b", productName: "B", gapPercentage: 14 }),
        decision({ productId: "c", productName: "C", gapPercentage: 15 }),
        decision({ productId: "d", productName: "D", direction: "raise", gapPercentage: -15 }),
      ],
      priceChanges: [alertItem({ changePercentage: -30 })],
    });
    const actions = deriveActions(body, link);
    expect(actions.length).toBeLessThanOrEqual(5);
    expect(actions[0].priority).toBe("high");
  });
});

describe("Sales insights", () => {
  it("builds a call action for the store with the most empty shelves", () => {
    const body = makeBody(
      {
        storeBriefs: [
          {
            name: "Noon",
            domain: "noon.com",
            brand: "Dermaelle",
            catalogSize: 10,
            restockCount: 4,
            pitchCount: 2,
            coveragePercentage: 60,
            talkingPoints: ["Hyalu Serum", "Cica Cream"],
            href: `${TEST_APP_URL}/opportunities?brand=Dermaelle&view=stores`,
          },
        ],
        storeCompliance: [
          {
            brandName: "Dermaelle",
            brandSlug: "dermaelle",
            storeName: "El Ezaby",
            domain: "elezabypharmacy.com",
            listings: 8,
            belowOfficial: 4,
            outOfStock: 0,
            averageGapPercentage: -9.5,
            href: `${TEST_APP_URL}/brands/dermaelle`,
          },
        ],
      },
      "sales",
    );
    const actions = deriveActions(body, link);
    expect(actions[0].title).toBe("Call Noon: 4 products out of stock");
    expect(actions[0].detail).toContain("Hyalu Serum, Cica Cream");
    const undercut = actions.find((a) => a.id.startsWith("undercut"));
    expect(undercut?.title).toContain("El Ezaby sells 4 Dermaelle products below the official price");
    expect(undercut?.detail).toContain("10% off");
  });
});

describe("Marketing insights", () => {
  it("prioritises weak content, competitor rewrites and review angles", () => {
    const body = makeBody(
      {
        contentHealth: {
          productsAnalyzed: 20,
          averageScore: 72,
          needsWork: 8,
          notCaptured: 3,
          competitorChanges30d: 4,
          href: `${TEST_APP_URL}/content?band=needs_work`,
        },
        contentGaps: [
          {
            productId: "p9",
            productName: "Night Mask",
            score: 48,
            issueLabels: ["Title too short", "No FAQ"],
            topMissingKeywords: ["hydrating", "overnight"],
            missingFacts: [],
            href: `${TEST_APP_URL}/products/p9?tab=content`,
          },
        ],
        contentChanges: [
          alertItem({
            id: "c1",
            type: "CONTENT_CHANGE",
            title: "Page updated: Noon",
            message: "Noon changed the title of its Night Mask page.",
            href: `${TEST_APP_URL}/products/p9?tab=content`,
          }),
        ],
        campaignInsights: [
          { title: "Delivery complaints", type: "our_weakness", suggestedAction: "Fix delivery first.", evidence: "12 reviews", href: `${TEST_APP_URL}/campaigns?type=our_weakness` },
          { title: "Rivals smell strong", type: "competitor_weakness", suggestedAction: "Lead with gentle scent.", evidence: "9 reviews", href: `${TEST_APP_URL}/campaigns?type=competitor_weakness` },
        ],
      },
      "marketing",
    );
    const actions = deriveActions(body, link);
    expect(actions[0]).toMatchObject({ priority: "high", title: "Improve the Night Mask page (score 48/100)" });
    expect(actions[0].detail).toContain("Title too short, No FAQ");
    expect(actions[0].detail).toContain("hydrating, overnight");
    expect(actions.map((a) => a.id)).toEqual(
      expect.arrayContaining(["rewrite-c1", "insight-ours", "insight-angle", "content-not-captured"]),
    );
    expect(actions.find((a) => a.id === "content-not-captured")?.href).toBe(
      `${TEST_APP_URL}/content?band=not_captured`,
    );
  });
});

describe("all-teams insights", () => {
  it("mixes actions from every role without exceeding six", () => {
    const body = makeBody(
      {
        decisionsTotal: 3,
        decisionsNeeded: [
          decision({ productId: "a", productName: "A" }),
          decision({ productId: "b", productName: "B" }),
          decision({ productId: "c", productName: "C" }),
        ],
        storeBriefs: [
          { name: "Noon", domain: "noon.com", brand: "Dermaelle", catalogSize: 10, restockCount: 5, pitchCount: 0, coveragePercentage: 50, talkingPoints: [], href: null },
        ],
        contentGaps: [
          { productId: "p9", productName: "Night Mask", score: 40, issueLabels: [], topMissingKeywords: [], missingFacts: [], href: null },
        ],
      },
      "all",
    );
    const actions = deriveActions(body, link);
    expect(actions.length).toBeLessThanOrEqual(6);
    expect(actions.map((a) => a.id)).toEqual(expect.arrayContaining(["call-noon.com", "content-p9"]));
  });
});

describe("deriveHeadline", () => {
  it("is critical when something needs action now", () => {
    const body = makeBody({
      pricing: { totalProducts: 20, productsCompared: 18, underpriced: 2, overpriced: 5, marketAligned: 11, newAlerts: 4 },
      decisionsTotal: 1,
      decisionsNeeded: [decision()],
    });
    const headline = deriveHeadline(body, deriveActions(body, link));
    expect(headline.status).toBe("critical");
    expect(headline.title).toBe("1 item needs action now");
    expect(headline.summary[0]).toBe("18 products compared: 5 priced above market, 2 below, 11 aligned.");
    expect(headline.summary).toContain("1 product sit more than 10% away from the market median.");
  });

  it("is healthy with a calm summary when there is nothing to do", () => {
    const body = makeBody();
    const headline = deriveHeadline(body, deriveActions(body, link));
    expect(headline.status).toBe("healthy");
    expect(headline.summary).toEqual(["No notable changes in this period."]);
  });

  it("is 'attention' when only medium or low actions exist", () => {
    const body = makeBody({
      decisionsTotal: 1,
      decisionsNeeded: [decision({ gapPercentage: 12, direction: "raise", priceChange: 20 })],
    });
    const headline = deriveHeadline(body, deriveActions(body, link));
    expect(headline.status).toBe("attention");
    expect(headline.title).toBe("1 thing worth a look");
  });
});

describe("deriveKpis", () => {
  const pricing = { totalProducts: 20, productsCompared: 18, underpriced: 2, overpriced: 5, marketAligned: 11, newAlerts: 4 };

  it("shows role-specific KPIs without deltas for the first report", () => {
    const kpis = deriveKpis(makeBody({ pricing }), link, null);
    expect(kpis.map((k) => k.id)).toEqual(["compared", "overpriced", "underpriced", "aligned", "newAlerts"]);
    expect(kpis.every((k) => k.delta === null)).toBe(true);
    expect(kpis.find((k) => k.id === "overpriced")?.href).toBe(
      `${TEST_APP_URL}/products?position=OVERPRICED&sort=gap&order=desc`,
    );
  });

  it("computes the change since the last report", () => {
    const kpis = deriveKpis(makeBody({ pricing }), link, { overpriced: 3, underpriced: 2, compared: 18 });
    expect(kpis.find((k) => k.id === "overpriced")).toMatchObject({ delta: 2, goodWhen: "down" });
    expect(kpis.find((k) => k.id === "underpriced")?.delta).toBe(0);
    expect(kpis.find((k) => k.id === "aligned")?.delta).toBeNull();
  });

  it("formats the content score and skips KPIs whose data was not loaded", () => {
    const kpis = deriveKpis(
      makeBody(
        {
          contentHealth: { productsAnalyzed: 5, averageScore: 81, needsWork: 2, notCaptured: 0, competitorChanges30d: 1, href: null },
        },
        "marketing",
      ),
      link,
      null,
    );
    expect(kpis.find((k) => k.id === "contentScore")?.display).toBe("81/100");
    expect(kpis.find((k) => k.id === "ourWeaknesses")).toBeUndefined();
  });

  it("round-trips through the snapshot saved with each report", () => {
    const kpis = deriveKpis(makeBody({ pricing }), link, null);
    expect(kpisToSnapshot(kpis)).toMatchObject({ compared: 18, overpriced: 5, underpriced: 2 });
  });
});

describe("deriveReportInsights", () => {
  it("returns headline, actions and KPIs together", () => {
    const result = deriveReportInsights(makeBody({ decisionsTotal: 1, decisionsNeeded: [decision()] }), link, null);
    expect(result.headline.status).toBe("critical");
    expect(result.actions).toHaveLength(1);
    expect(Array.isArray(result.kpis)).toBe(true);
  });
});
