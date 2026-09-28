import { describe, expect, it } from "vitest";
import { DomainRateLimiter, runWithConcurrency } from "./queue";
import { sleep } from "./utils";

describe("runWithConcurrency", () => {
  it("never exceeds the limit and preserves order", async () => {
    let active = 0;
    let peak = 0;
    const results = await runWithConcurrency([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      active++;
      peak = Math.max(peak, active);
      await sleep(10 + (7 - n) * 2);
      active--;
      return n * 10;
    });
    expect(peak).toBeLessThanOrEqual(3);
    expect(results.map((r) => (r.status === "fulfilled" ? r.value : null))).toEqual([10, 20, 30, 40, 50, 60, 70]);
  });

  it("isolates failures", async () => {
    const results = await runWithConcurrency(["a", "b", "c"], 2, async (s) => {
      if (s === "b") throw new Error("boom");
      return s;
    });
    expect(results[0]).toEqual({ status: "fulfilled", value: "a" });
    expect(results[1].status).toBe("rejected");
    expect(results[2]).toEqual({ status: "fulfilled", value: "c" });
  });

  it("handles empty input", async () => {
    expect(await runWithConcurrency([], 3, async () => 1)).toEqual([]);
  });
});

describe("DomainRateLimiter", () => {
  it("spaces requests to the same domain but not across domains", async () => {
    const limiter = new DomainRateLimiter(40);
    const start = Date.now();
    await Promise.all([limiter.acquire("a.com"), limiter.acquire("b.com")]);
    expect(Date.now() - start).toBeLessThan(30);
    await limiter.acquire("a.com");
    expect(Date.now() - start).toBeGreaterThanOrEqual(35);
  });
});
