import { describe, expect, it } from "vitest";
import {
  createEmailRecipientSchema,
  emailReportPreviewSchema,
  emailReportSendSchema,
  updateEmailRecipientSchema,
} from "./email-report.schema";

describe("createEmailRecipientSchema", () => {
  it("accepts a valid recipient and lowercases email", () => {
    const parsed = createEmailRecipientSchema.parse({
      name: "Sara",
      email: "Sara@Company.COM",
      team: "ceo",
    });
    expect(parsed.email).toBe("sara@company.com");
    expect(parsed.isActive).toBe(true);
  });

  it("rejects invalid email and team", () => {
    expect(createEmailRecipientSchema.safeParse({ name: "Sara", email: "nope", team: "ceo" }).success).toBe(false);
    expect(
      createEmailRecipientSchema.safeParse({ name: "Sara", email: "sara@company.com", team: "finance" }).success,
    ).toBe(false);
  });
});

describe("updateEmailRecipientSchema", () => {
  it("requires at least one field", () => {
    expect(updateEmailRecipientSchema.safeParse({}).success).toBe(false);
    expect(updateEmailRecipientSchema.safeParse({ isActive: false }).success).toBe(true);
  });
});

describe("email report schemas", () => {
  it("defaults preview audience and period", () => {
    const parsed = emailReportPreviewSchema.parse({});
    expect(parsed.audience).toBe("ceo");
    expect(parsed.periodDays).toBe(7);
  });

  it("requires recipients for send and caps period values", () => {
    expect(emailReportSendSchema.safeParse({ recipientIds: [] }).success).toBe(false);
    expect(
      emailReportSendSchema.safeParse({
        recipientIds: ["507f1f77bcf86cd799439011"],
        periodDays: 9,
      }).success,
    ).toBe(false);
    expect(
      emailReportSendSchema.safeParse({
        recipientIds: ["507f1f77bcf86cd799439011"],
        audience: "sales",
        periodDays: 14,
      }).success,
    ).toBe(true);
  });

  it("sends each recipient their own team's report by default", () => {
    const parsed = emailReportSendSchema.parse({ recipientIds: ["507f1f77bcf86cd799439011"] });
    expect(parsed.audience).toBe("auto");
  });

  it("only allows 'auto' when sending, not when previewing one report", () => {
    expect(emailReportPreviewSchema.safeParse({ audience: "auto" }).success).toBe(false);
    expect(emailReportPreviewSchema.parse({ audience: "sales", recipientName: " Sara " }).recipientName).toBe("Sara");
  });
});
