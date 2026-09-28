import { ACCOUNT_ID, SESSION_TTL_MS } from "@/lib/auth/constants";

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

async function hmac(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return toHex(signature);
}

function authSecret(): string | null {
  const secret = process.env.AUTH_SECRET;
  return secret && secret.length > 0 ? secret : null;
}

export async function createSessionToken(now = Date.now()): Promise<string> {
  const secret = authSecret();
  if (!secret) throw new Error("AUTH_SECRET is not set.");
  const expiresAt = now + SESSION_TTL_MS;
  const payload = `${ACCOUNT_ID}.${expiresAt}`;
  const signature = await hmac(secret, payload);
  return `${payload}.${signature}`;
}

export async function verifySessionToken(
  token: string | undefined,
  now = Date.now(),
): Promise<{ accountId: string } | null> {
  const secret = authSecret();
  if (!secret || !token) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [accountId, expiresRaw, signature] = parts;
  if (accountId !== ACCOUNT_ID || !/^\d+$/.test(expiresRaw)) return null;

  const expiresAt = Number(expiresRaw);
  if (expiresAt <= now) return null;

  const expected = await hmac(secret, `${accountId}.${expiresRaw}`);
  if (!timingSafeEqual(expected, signature)) return null;
  return { accountId };
}

export async function passwordMatches(input: string, expected: string): Promise<boolean> {
  if (!input || !expected) return false;
  const encoded = new TextEncoder();
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoded.encode(input)),
    crypto.subtle.digest("SHA-256", encoded.encode(expected)),
  ]);
  return timingSafeEqual(toHex(left), toHex(right));
}

/** Only in-app paths. Anything else goes to the dashboard. */
export function safeRedirectPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || value.startsWith("/sign-in")) {
    return "/dashboard";
  }
  if (!/^\/[A-Za-z0-9/_\-.?=&%]*$/.test(value)) return "/dashboard";
  return value;
}
