"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { findAccount, SESSION_COOKIE } from "@/lib/auth/constants";
import { sessionCookieOptions } from "@/lib/auth/session";
import { createSessionToken, passwordMatches, safeRedirectPath } from "@/lib/auth/token";

export type SignInState = { error: string } | null;

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const accountId = String(formData.get("accountId") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!process.env.AUTH_SECRET) {
    return { error: "Sign-in is not configured." };
  }

  const account = findAccount(accountId);
  const expectedPassword = account ? (process.env[account.passwordEnv] ?? "") : (process.env.AUTH_PASSWORD ?? "");
  const passwordOk = await passwordMatches(password, expectedPassword);
  if (!account || !passwordOk) {
    return { error: "Account ID or password is incorrect." };
  }

  const token = await createSessionToken(account.id);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, sessionCookieOptions());
  redirect(safeRedirectPath(typeof formData.get("next") === "string" ? String(formData.get("next")) : null));
}

export async function signOut(): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
  redirect("/");
}
