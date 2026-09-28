import type { Availability, ScrapeErrorCode } from "@/types";
import { calculateMedian } from "@/lib/services/pricing/pricing-analysis.service";
import { roundForCurrency } from "@/lib/services/pricing/rounding";

/**
 * Deterministic, obviously fictional demo data: "Demo Product N" sold by "Demo ..." retailers on
 * reserved `.example` domains. Prices are generated, not sampled from any real store.
 */

export const DEMO_CURRENCY = "USD";
export const DEMO_BRAND = "Demo Brand";
export const DEMO_PRODUCT_COUNT = 10;
const HISTORY_WEEKS = 52;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

export type DemoRetailerKey = "own" | "a" | "b" | "c" | "d";

export const DEMO_RETAILERS: { key: DemoRetailerKey; name: string; domain: string; isOwnStore: boolean }[] = [
  { key: "own", name: "Demo Own Store", domain: "demo-own-store.example", isOwnStore: true },
  { key: "a", name: "Demo Competitor A", domain: "demo-competitor-a.example", isOwnStore: false },
  { key: "b", name: "Demo Competitor B", domain: "demo-competitor-b.example", isOwnStore: false },
  { key: "c", name: "Demo Competitor C", domain: "demo-competitor-c.example", isOwnStore: false },
  { key: "d", name: "Demo Competitor D", domain: "demo-competitor-d.example", isOwnStore: false },
];

const CATEGORIES = [
  ["Cleanser", "150ml"],
  ["Moisturizer", "50ml"],
  ["Serum", "30ml"],
  ["Sunscreen", "50ml"],
  ["Toner", "200ml"],
  ["Shampoo", "250ml"],
  ["Conditioner", "250ml"],
  ["Body Lotion", "400ml"],
  ["Lip Balm", "4g"],
  ["Face Mask", "75ml"],
] as const;

/** Final own-price gap vs the competitor median per product; spread across all five positions. */
const TARGET_GAPS = [-16, -8, -3, 0.5, 3, 7, 12, 22, -12, 1.5];

export interface DemoObservation {
  at: Date;
  price: number;
  originalPrice: number | null;
  availability: Availability;
}

export interface DemoSource {
  retailerKey: DemoRetailerKey;
  url: string;
  isOwnStore: boolean;
  sortOrder: number;
  observations: DemoObservation[];
  /** Set when the most recent check failed; observations then stop before `lastCheckedAt`. */
  failure: { code: ScrapeErrorCode; message: string } | null;
  lastCheckedAt: Date;
}

export interface DemoProduct {
  index: number;
  name: string;
  brand: string;
  category: string;
  size: string;
  currency: string;
  lastCheckedAt: Date;
  sources: DemoSource[];
}

/** Small seeded PRNG (mulberry32) so every seed run produces identical data. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Retail-style price ending in .49 or .99. */
function retailPrice(value: number): number {
  return Math.max(0.99, Math.round(value * 2) / 2 - 0.01);
}

const round = (value: number) => roundForCurrency(value, DEMO_CURRENCY);

function competitorSeries(
  rng: () => number,
  level: number,
  timestamps: Date[],
  { forceFinalChange }: { forceFinalChange: boolean },
): DemoObservation[] {
  let regular = retailPrice(level);
  const out: DemoObservation[] = [];
  timestamps.forEach((at, k) => {
    const isLast = k === timestamps.length - 1;
    if (rng() < 0.22 || (isLast && forceFinalChange)) {
      let next = retailPrice(level * (0.92 + rng() * 0.16));
      if (isLast && forceFinalChange && next === regular) next = retailPrice(regular * 0.9);
      regular = next;
    }
    const onPromo = !isLast && rng() < 0.05;
    out.push({
      at,
      price: onPromo ? retailPrice(regular * 0.85) : regular,
      originalPrice: onPromo ? regular : null,
      availability: "in_stock",
    });
  });
  return out;
}

export function generateDemoCatalog({ now = new Date(), seed = 20260926 }: { now?: Date; seed?: number } = {}): DemoProduct[] {
  return Array.from({ length: DEMO_PRODUCT_COUNT }, (_, index) => {
    const rng = createRng(seed + index * 7919);
    const [category, size] = CATEGORIES[index];
    const slug = `demo-product-${index + 1}`;
    const lastCheckedAt = new Date(now.getTime() - index * 7 * MINUTE_MS);
    const timestamps = Array.from(
      { length: HISTORY_WEEKS + 1 },
      (_, k) => new Date(lastCheckedAt.getTime() - (HISTORY_WEEKS - k) * WEEK_MS),
    );
    const base = 12 + rng() * 48;

    const competitors: DemoSource[] = DEMO_RETAILERS.filter((r) => !r.isOwnStore).map((retailer, i) => {
      const observations = competitorSeries(rng, base * (0.9 + rng() * 0.2), timestamps, {
        forceFinalChange: index % 3 === 0 && retailer.key === "a",
      });
      let failure: DemoSource["failure"] = null;

      if (index === 4 && retailer.key === "d") {
        observations[observations.length - 1].availability = "out_of_stock";
      }
      if (index === 6 && retailer.key === "c") {
        observations.splice(-2);
        failure = { code: "PRICE_NOT_FOUND", message: "Could not find a price on the page." };
      }

      return {
        retailerKey: retailer.key,
        url: `https://${retailer.domain}/products/${slug}`,
        isOwnStore: false,
        sortOrder: i + 1,
        observations,
        failure,
        lastCheckedAt,
      };
    });

    const finalMarket = competitors
      .filter((c) => !c.failure)
      .map((c) => c.observations[c.observations.length - 1])
      .filter((o) => o.availability !== "out_of_stock")
      .map((o) => o.price);
    const finalOwn = round(calculateMedian(finalMarket) * (1 + TARGET_GAPS[index] / 100));

    let ownRegular = retailPrice(base * (1 + TARGET_GAPS[index] / 100) * (0.97 + rng() * 0.06));
    const ownObservations: DemoObservation[] = timestamps.map((at, k) => {
      if (k === timestamps.length - 1) ownRegular = finalOwn;
      else if (rng() < 0.08) ownRegular = retailPrice(base * (0.95 + rng() * 0.15));
      return { at, price: ownRegular, originalPrice: null, availability: "in_stock" };
    });

    return {
      index,
      name: `Demo Product ${index + 1}`,
      brand: DEMO_BRAND,
      category,
      size,
      currency: DEMO_CURRENCY,
      lastCheckedAt,
      sources: [
        {
          retailerKey: "own",
          url: `https://${DEMO_RETAILERS[0].domain}/products/${slug}`,
          isOwnStore: true,
          sortOrder: 0,
          observations: ownObservations,
          failure: null,
          lastCheckedAt,
        },
        ...competitors,
      ],
    };
  });
}
