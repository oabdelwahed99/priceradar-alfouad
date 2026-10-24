export type AccountRole = "admin" | "member";

export type Account = {
  id: string;
  name: string;
  role: AccountRole;
  /** Env var that holds this account's password. */
  passwordEnv: "AUTH_PASSWORD" | "ADMIN_PASSWORD";
};

export type AccountSession = {
  accountId: string;
  name: string;
  role: AccountRole;
};

/** Accounts that can sign in. Every account can generate AI drafts. Only admins can capture content or refresh prices. */
export const ACCOUNTS: readonly Account[] = [
  { id: "eslam_dermaelle", name: "Dermaelle", role: "member", passwordEnv: "AUTH_PASSWORD" },
  { id: "admin", name: "Admin", role: "admin", passwordEnv: "ADMIN_PASSWORD" },
];

export const ACCOUNT_ID = "eslam_dermaelle";

export const ACCOUNT_NAME = "Dermaelle";

export const ADMIN_ACCOUNT_ID = "admin";

export function findAccount(accountId: string): Account | null {
  return ACCOUNTS.find((account) => account.id === accountId) ?? null;
}

export const SESSION_COOKIE = "radar_session";

/** Session lifetime: 14 days. */
export const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;
