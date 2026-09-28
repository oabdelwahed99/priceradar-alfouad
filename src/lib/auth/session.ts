import { cookies } from "next/headers";
import { SESSION_COOKIE, SESSION_TTL_MS } from "@/lib/auth/constants";
import { verifySessionToken } from "@/lib/auth/token";

export async function getSession(): Promise<{ accountId: string } | null> {
  const jar = await cookies();
  return verifySessionToken(jar.get(SESSION_COOKIE)?.value);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  };
}
