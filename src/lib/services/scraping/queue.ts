import { sleep } from "./utils";

/**
 * Runs `worker` over `items` with at most `limit` in flight. Results keep input order.
 * The worker is expected not to throw; a thrown error is captured as a rejected result.
 */
export async function runWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  const size = Math.max(1, Math.min(limit, items.length));
  let next = 0;

  async function lane() {
    while (next < items.length) {
      const index = next++;
      try {
        results[index] = { status: "fulfilled", value: await worker(items[index], index) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }

  await Promise.all(Array.from({ length: size }, lane));
  return results;
}

/**
 * Enforces a minimum interval between request starts to the same domain, process-wide.
 * Requests to different domains are not delayed.
 */
export class DomainRateLimiter {
  private nextSlot = new Map<string, number>();

  constructor(private readonly minIntervalMs: number) {}

  async acquire(domain: string, minIntervalMs = this.minIntervalMs): Promise<void> {
    const now = Date.now();
    const slot = Math.max(now, this.nextSlot.get(domain) ?? 0);
    this.nextSlot.set(domain, slot + minIntervalMs);
    const wait = slot - now;
    if (wait > 0) await sleep(wait);
  }
}
