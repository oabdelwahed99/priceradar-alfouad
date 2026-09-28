import { afterEach, describe, expect, it } from "vitest";
import { ACCOUNT_ID } from "@/lib/auth/constants";
import { createSessionToken, passwordMatches, safeRedirectPath, verifySessionToken } from "@/lib/auth/token";

const NOW = 1_700_000_000_000;

describe("session tokens", () => {
  const previous = process.env.AUTH_SECRET;

  afterEach(() => {
    if (previous === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previous;
  });

  it("accepts a token it just signed and rejects tampering and expiry", async () => {
    process.env.AUTH_SECRET = "test-secret";
    const token = await createSessionToken(NOW);
    expect(await verifySessionToken(token, NOW)).toEqual({ accountId: ACCOUNT_ID });

    const [accountId, expiresAt, signature] = token.split(".");
    expect(await verifySessionToken(`${accountId}.${expiresAt}.${signature.slice(0, -1)}0`, NOW)).toBeNull();
    expect(await verifySessionToken(`other.${expiresAt}.${signature}`, NOW)).toBeNull();
    expect(await verifySessionToken(token, Number(expiresAt))).toBeNull();
  });

  it("rejects tokens when the secret is missing", async () => {
    delete process.env.AUTH_SECRET;
    await expect(createSessionToken(NOW)).rejects.toThrow(/AUTH_SECRET/);
    expect(await verifySessionToken("alfo2ad.1.aa", NOW)).toBeNull();
  });
});

describe("passwordMatches", () => {
  it("matches the same password and rejects empty or different values", async () => {
    expect(await passwordMatches("correct horse", "correct horse")).toBe(true);
    expect(await passwordMatches("correct horse", "wrong")).toBe(false);
    expect(await passwordMatches("", "correct horse")).toBe(false);
    expect(await passwordMatches("correct horse", "")).toBe(false);
  });
});

describe("safeRedirectPath", () => {
  it("keeps in-app paths and drops external targets", () => {
    expect(safeRedirectPath("/products?tab=content")).toBe("/products?tab=content");
    expect(safeRedirectPath("/dashboard")).toBe("/dashboard");
    expect(safeRedirectPath("//evil.example")).toBe("/dashboard");
    expect(safeRedirectPath("https://evil.example")).toBe("/dashboard");
    expect(safeRedirectPath("/sign-in")).toBe("/dashboard");
    expect(safeRedirectPath(null)).toBe("/dashboard");
  });
});
