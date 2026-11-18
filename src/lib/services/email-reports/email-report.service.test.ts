import { describe, expect, it } from "vitest";
import type { EmailRecipientDTO } from "@/types/dto";
import { groupRecipientsByAudience, previewWarnings } from "./email-report.service";

const person = (id: string, team: EmailRecipientDTO["team"]): EmailRecipientDTO => ({
  id,
  name: id,
  email: `${id}@example.com`,
  team,
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

describe("groupRecipientsByAudience", () => {
  const recipients = [person("ceo1", "ceo"), person("s1", "sales"), person("s2", "sales"), person("m1", "marketing")];

  it("auto gives each recipient the report written for their own team", () => {
    const groups = groupRecipientsByAudience(recipients, "auto");
    expect([...groups.keys()]).toEqual(["ceo", "sales", "marketing"]);
    expect(groups.get("sales")?.map((r) => r.id)).toEqual(["s1", "s2"]);
  });

  it("a fixed audience sends everyone the same report", () => {
    const groups = groupRecipientsByAudience(recipients, "all");
    expect([...groups.keys()]).toEqual(["all"]);
    expect(groups.get("all")).toHaveLength(4);
  });
});

describe("previewWarnings", () => {
  it("warns when links are switched off", () => {
    expect(previewWarnings(null)[0]).toContain("NEXT_PUBLIC_APP_URL");
  });

  it("warns when links point at this computer", () => {
    expect(previewWarnings("http://localhost:3000")[0]).toContain("only works on this computer");
  });

  it("has no warnings for a public address", () => {
    expect(previewWarnings("https://radar.example.com")).toEqual([]);
  });
});
