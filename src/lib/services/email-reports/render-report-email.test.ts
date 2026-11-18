import { describe, expect, it } from "vitest";
import type { EmailReportAudience } from "@/types";
import type { ExecutiveReportDTO } from "@/types/dto";
import { escapeHtml, renderReportEmail } from "./render-report-email";
import { deriveReportInsights, type ReportBody } from "./report-insights";
import { createLinkBuilder } from "./report-links";
import { alertItem, decision, makeBody, TEST_APP_URL } from "./report-test-fixtures";

function fullReport(
  overrides: Partial<ReportBody> = {},
  audience: EmailReportAudience = "ceo",
  previous: Record<string, number> | null = null,
): ExecutiveReportDTO {
  const body = makeBody(overrides, audience);
  return { ...body, ...deriveReportInsights(body, createLinkBuilder(body.appUrl), previous) };
}

const pricing = { totalProducts: 20, productsCompared: 18, underpriced: 2, overpriced: 5, marketAligned: 11, newAlerts: 4 };

describe("escapeHtml", () => {
  it("escapes markup characters", () => {
    expect(escapeHtml(`<script>alert("x")</script>&'`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp;&#39;",
    );
  });
});

describe("renderReportEmail", () => {
  it("greets the recipient by name and states the headline first", () => {
    const report = fullReport({ pricing, decisionsTotal: 1, decisionsNeeded: [decision()] });
    const { html, text, subject } = renderReportEmail(report, { recipientName: "Sara" });

    expect(html).toContain("Hi Sara,");
    expect(text).toContain("Hi Sara,");
    expect(subject).toBe("Action needed: Price Radar CEO brief \u00B7 1 item needs action now");
    expect(html.indexOf("1 item needs action now")).toBeLessThan(html.indexOf("Your top actions"));
    expect(html.indexOf("Your top actions")).toBeLessThan(html.indexOf("Key numbers"));
    expect(html.indexOf("Key numbers")).toBeLessThan(html.indexOf("Lower the price"));
  });

  it("falls back to a role greeting when there is no recipient name", () => {
    expect(renderReportEmail(fullReport()).html).toContain("Hi CEO team,");
    expect(renderReportEmail(fullReport({}, "all")).html).toContain("Hi team,");
  });

  it("makes titles, call-to-action buttons and section links clickable", () => {
    const report = fullReport({ pricing, decisionsTotal: 1, decisionsNeeded: [decision()] });
    const { html, text } = renderReportEmail(report);

    expect(html).toContain(`href="${TEST_APP_URL}/products/p1"`);
    expect(html).toContain("Review price &rarr;");
    expect(html).toContain(`href="${TEST_APP_URL}/products?sort=gap&amp;order=desc"`);
    expect(html).toContain(`href="${TEST_APP_URL}/dashboard"`);
    expect(html).toContain(`href="${TEST_APP_URL}/products?position=OVERPRICED&amp;sort=gap&amp;order=desc"`);
    expect(text).toContain(`${TEST_APP_URL}/products/p1`);
    expect(text).toContain(`Open Price Radar: ${TEST_APP_URL}/dashboard`);
  });

  it("renders no links at all when the app url is not configured", () => {
    const report = fullReport({ appUrl: null, pricing, decisionsTotal: 1, decisionsNeeded: [decision({ href: null })] });
    const { html, text } = renderReportEmail(report);
    expect(html).not.toContain("<a ");
    expect(html).toContain("Hyalu Serum");
    expect(text).not.toContain("http");
  });

  it("shows change since the last report with good and bad colouring", () => {
    const report = fullReport({ pricing, previousReportAt: "2026-11-11T10:00:00.000Z" }, "ceo", {
      overpriced: 3,
      aligned: 14,
    });
    const { html, text } = renderReportEmail(report);
    expect(html).toContain("Change since the last CEO report");
    expect(html).toContain("\u25B2 +2");
    expect(html).toContain("#b91c1c");
    expect(html).toContain("\u25BC -3");
    expect(html).toContain("#b91c1c");
    expect(text).toContain("Priced above market: 5 (\u25B2 +2)");
  });

  it("escapes every dynamic value, including notes and product names", () => {
    const report = fullReport({
      note: `<img src=x onerror=alert(1)>`,
      pricing,
      decisionsTotal: 1,
      decisionsNeeded: [decision({ productName: "Serum <b>X</b>" })],
    });
    const { html, text } = renderReportEmail(report, { recipientName: `<i>Sara</i>` });
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x");
    expect(html).toContain("Serum &lt;b&gt;X&lt;/b&gt;");
    expect(html).toContain("Hi &lt;i&gt;Sara&lt;/i&gt;,");
    expect(text).toContain("Serum <b>X</b>");
  });

  it("refuses non-http links in href attributes", () => {
    const report = fullReport({
      pricing,
      decisionsTotal: 1,
      decisionsNeeded: [decision({ href: "javascript:alert(1)" })],
    });
    expect(renderReportEmail(report).html).not.toContain("javascript:");
  });

  it("writes a different brief for each role", () => {
    const sales = renderReportEmail(
      fullReport(
        {
          storeBriefs: [
            { name: "Noon", domain: "noon.com", brand: "Dermaelle", catalogSize: 10, restockCount: 4, pitchCount: 1, coveragePercentage: 60, talkingPoints: ["Hyalu Serum"], href: `${TEST_APP_URL}/opportunities?brand=Dermaelle&view=stores` },
          ],
          decisionsNeeded: [decision()],
        },
        "sales",
      ),
    );
    expect(sales.html).toContain("Store call list");
    expect(sales.html).toContain("Mention: Hyalu Serum");
    expect(sales.html).not.toContain("Pricing decisions");

    const marketing = renderReportEmail(
      fullReport(
        {
          contentHealth: { productsAnalyzed: 10, averageScore: 70, needsWork: 3, notCaptured: 1, competitorChanges30d: 2, href: `${TEST_APP_URL}/content?band=needs_work` },
          contentChanges: [alertItem({ type: "CONTENT_CHANGE", title: "Page updated: Noon", message: "Noon changed the title.", href: `${TEST_APP_URL}/products/p1?tab=content` })],
        },
        "marketing",
      ),
    );
    expect(marketing.html).toContain("Content health");
    expect(marketing.html).toContain("Competitor page rewrites");
    expect(marketing.html).toContain(`href="${TEST_APP_URL}/products/p1?tab=content"`);
    expect(marketing.html).not.toContain("Store call list");
    expect(marketing.html).not.toContain("Pricing decisions");
  });

  it("omits empty sections and says all clear when there is nothing to do", () => {
    const { html, subject } = renderReportEmail(fullReport({}, "marketing"));
    expect(subject).toBe("Price Radar Marketing brief \u00B7 All clear");
    expect(html).toContain("All clear. Nothing needs action right now.");
    expect(html).not.toContain("Content health");
    expect(html).not.toContain("Your top actions");
  });

  it("includes the admin note at the top", () => {
    const { html, text } = renderReportEmail(fullReport({ note: "Review before Sunday." }));
    expect(html).toContain("Review before Sunday.");
    expect(text).toContain("Note: Review before Sunday.");
  });
});
