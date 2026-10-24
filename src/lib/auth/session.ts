import { cookies } from "next/headers";
import { SESSION_COOKIE, SESSION_TTL_MS, type AccountSession } from "@/lib/auth/constants";
import { verifySessionToken } from "@/lib/auth/token";
import { AppError, ForbiddenError } from "@/lib/errors";

export async function getSession(): Promise<AccountSession | null> {
  const jar = await cookies();
  return verifySessionToken(jar.get(SESSION_COOKIE)?.value);
}

/** Any signed-in account. AI drafts and campaign ideas use this. */
export async function requireSession(): Promise<AccountSession> {
  const session = await getSession();
  if (!session) throw new AppError("Sign in required.", 401, "UNAUTHORIZED");
  return session;
}

/** Capture content and price refresh are limited to the admin account. */
export async function requireAdmin(): Promise<AccountSession> {
  const session = await requireSession();
  if (session.role !== "admin") {
    throw new ForbiddenError("Only an admin can capture content or refresh prices.");
  }
  return session;
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
