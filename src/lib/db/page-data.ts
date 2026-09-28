import { isDatabaseConfigured, isDatabaseUnavailableError } from "./mongoose";

export type PageData<T> = { ok: true; data: T } | { ok: false; message: string };

/**
 * Loads data for a server-rendered page. Database outages become a renderable notice;
 * any other error is rethrown so the route's error boundary handles it.
 */
export async function loadPageData<T>(load: () => Promise<T>): Promise<PageData<T>> {
  if (!isDatabaseConfigured()) {
    return { ok: false, message: "Set MONGODB_URI in .env.local (see .env.example) and restart the server to load data." };
  }
  try {
    return { ok: true, data: await load() };
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      console.error("[page] database unavailable:", (error as Error).message);
      return {
        ok: false,
        message: "Could not reach MongoDB. Check MONGODB_URI, network access and the Atlas IP allowlist, then reload.",
      };
    }
    throw error;
  }
}
