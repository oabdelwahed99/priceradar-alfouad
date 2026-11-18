/**
 * Scrape audit: pnpm audit:prices [domain...] [--apply]
 *
 * Scrapes every product link in the database and cross-checks the result against the store's own
 * product API where one exists (Shopify `/products.json`, WooCommerce Store API).
 * --reuse skips scraping and re-checks the scrape results saved in the last report.
 * Writes a report to audit-report.json. Nothing is saved to the database unless --apply is set:
 * then every product whose links were all verified or unverifiable is refreshed via the app.
 */
import "./load-env";
import { readFile, writeFile } from "node:fs/promises";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import { compareProduct } from "@/lib/services/comparison/comparison.service";
import { closeBrowser } from "@/lib/services/scraping/browser";
import { scrapeMany } from "@/lib/services/scraping/scraper.service";
import type { ScrapedProduct } from "@/lib/services/scraping/types";
import type { ScrapeErrorCode } from "@/types";
import { getCurrentWorkspaceId } from "@/lib/workspace";
import { Product, ProductSource, Retailer } from "@/models";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";
const API_DELAY_MS = 2_500;

interface Truth {
  platform: "shopify" | "woocommerce";
  price: number;
  inStock: boolean;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getJson(url: string): Promise<unknown | null> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" } }).catch(() => null);
    if (res?.status === 429) {
      await sleep(20_000 * (attempt + 1));
      continue;
    }
    if (!res?.ok) return null;
    return res.json().catch(() => null);
  }
  return null;
}

interface ShopifyVariant {
  id: number;
  price: string;
  available: boolean;
}

const MAX_CATALOG_PAGES = 60;
const shopifyHandle = (url: URL) => {
  const raw = url.pathname.match(/\/products\/([^/?#]+)/)?.[1];
  return raw ? decodeURIComponent(raw).toLowerCase() : null;
};

/**
 * Per-store catalog from `/products.json`, paged until every wanted handle is found. One bulk request per
 * 250 products is far less likely to be rate limited than one `/products/<handle>.js` call per link.
 */
const catalogs = new Map<string, Promise<Map<string, ShopifyVariant[]>>>();
function shopifyCatalog(origin: string, wanted: Set<string>): Promise<Map<string, ShopifyVariant[]>> {
  let catalog = catalogs.get(origin);
  if (!catalog) {
    catalog = (async () => {
      const found = new Map<string, ShopifyVariant[]>();
      for (let page = 1; page <= MAX_CATALOG_PAGES; page++) {
        const data = (await getJson(`${origin}/products.json?limit=250&page=${page}`)) as
          | { products: { handle: string; variants: ShopifyVariant[] }[] }
          | null;
        if (!data?.products?.length) break;
        for (const p of data.products) found.set(decodeURIComponent(p.handle).toLowerCase(), p.variants);
        if ([...wanted].every((h) => found.has(h))) break;
        await sleep(1_000);
      }
      return found;
    })();
    catalogs.set(origin, catalog);
  }
  return catalog;
}

const wantedHandles = new Map<string, Set<string>>();

async function shopifyTruth(url: URL): Promise<Truth | null> {
  const handle = shopifyHandle(url);
  if (!handle) return null;
  const variants = (await shopifyCatalog(url.origin, wantedHandles.get(url.origin) ?? new Set([handle]))).get(handle);
  if (!variants?.length) return null;
  const wanted = url.searchParams.get("variant");
  const variant =
    (wanted && variants.find((v) => String(v.id) === wanted)) || variants.find((v) => v.available) || variants[0];
  return { platform: "shopify", price: Number(variant.price), inStock: variant.available };
}

async function wooTruth(url: URL): Promise<Truth | null> {
  const slug = url.pathname.match(/\/product\/([^/?#]+)/)?.[1];
  if (!slug) return null;
  const data = (await getJson(`${url.origin}/wp-json/wc/store/v1/products?slug=${slug}`)) as
    | { prices: { price: string; currency_minor_unit: number }; is_in_stock: boolean }[]
    | null;
  const p = Array.isArray(data) ? data[0] : null;
  if (!p) return null;
  return { platform: "woocommerce", price: Number(p.prices.price) / 10 ** p.prices.currency_minor_unit, inStock: p.is_in_stock };
}

async function truthFor(rawUrl: string): Promise<Truth | null> {
  const url = new URL(rawUrl);
  if (/\/products\//.test(url.pathname)) return shopifyTruth(url);
  if (/\/product\//.test(url.pathname)) return wooTruth(url);
  return null;
}

interface Row {
  store: string;
  domain: string;
  product: string;
  productId: string;
  sourceId: string;
  url: string;
  scraped: { price: number; inStock: boolean | null } | { error: string };
  truth: Truth | null;
  verdict: "ok" | "price-mismatch" | "stock-mismatch" | "scrape-failed" | "unverified";
}

/** Scrape results from the last audit-report.json, so a re-check does not scrape every page again. */
async function previousScrapes(sourceIds: string[]): Promise<ScrapedProduct[]> {
  const rows = JSON.parse(await readFile("audit-report.json", "utf8")) as Row[];
  const bySource = new Map(rows.map((r) => [r.sourceId, r]));
  return sourceIds.map((id): ScrapedProduct => {
    const row = bySource.get(id);
    const scraped = row?.scraped;
    const at = new Date().toISOString();
    if (!row || !scraped || "error" in scraped) {
      return { success: false, url: row?.url ?? "", error: "not in previous report", errorCode: (scraped as { error?: ScrapeErrorCode } | undefined)?.error ?? "UNKNOWN", scrapedAt: at };
    }
    return {
      success: true, url: row.url, finalUrl: row.url, productName: null, brand: null, price: scraped.price, currency: null,
      originalPrice: null, lowPrice: null, highPrice: null,
      availability: scraped.inStock === null ? "unknown" : scraped.inStock ? "in_stock" : "out_of_stock",
      imageUrl: null, strategy: "reused", warnings: [], content: null, scrapedAt: at,
    };
  });
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const reuse = args.includes("--reuse");
  const domains = args.filter((a) => !a.startsWith("--"));

  await connectToDatabase();
  const workspaceId = getCurrentWorkspaceId();
  const retailers = await Retailer.find({ workspaceId, ...(domains.length ? { domain: { $in: domains } } : {}) }).lean();
  const products = new Map(
    (await Product.find({ workspaceId, isDemo: { $ne: true } }, { name: 1 }).lean()).map((p) => [String(p._id), p.name]),
  );
  const retailerById = new Map(retailers.map((r) => [String(r._id), r]));
  const sources = (await ProductSource.find({ workspaceId, retailerId: { $in: retailers.map((r) => r._id) } }).lean()).filter(
    (s) => products.has(String(s.productId)),
  );
  console.log(`Auditing ${sources.length} links on ${retailers.length} stores...`);

  const byDomain = new Map<string, typeof sources>();
  for (const s of sources) {
    const url = new URL(s.url);
    const handle = shopifyHandle(url);
    if (handle) wantedHandles.set(url.origin, (wantedHandles.get(url.origin) ?? new Set()).add(handle));
    const d = retailerById.get(String(s.retailerId))!.domain;
    byDomain.set(d, [...(byDomain.get(d) ?? []), s]);
  }
  const scrapes = reuse ? await previousScrapes(sources.map((s) => String(s._id))) : await scrapeMany(sources.map((s) => s.url));

  // Store APIs rate-limit aggressively, so they are queried only after scraping, one request per store at a time.
  console.log("Cross-checking with store APIs...");
  const truths = new Map<string, Truth | null>();
  await Promise.all(
    [...byDomain.values()].map(async (list) => {
      for (const s of list) {
        truths.set(String(s._id), await truthFor(s.url).catch(() => null));
        await sleep(API_DELAY_MS);
      }
    }),
  );

  const rows: Row[] = sources.map((s, i) => {
    const retailer = retailerById.get(String(s.retailerId))!;
    const r = scrapes[i];
    const truth = truths.get(String(s._id)) ?? null;
    const base = {
      store: retailer.name,
      domain: retailer.domain,
      product: products.get(String(s.productId))!,
      productId: String(s.productId),
      sourceId: String(s._id),
      url: s.url,
      truth,
    };
    if (!r.success) return { ...base, scraped: { error: r.errorCode }, verdict: "scrape-failed" };
    const inStock = r.availability === "unknown" ? null : r.availability !== "out_of_stock";
    const scraped = { price: r.price, inStock };
    if (!truth) return { ...base, scraped, verdict: "unverified" };
    if (Math.abs(truth.price - r.price) > 0.01) return { ...base, scraped, verdict: "price-mismatch" };
    if (inStock !== null && inStock !== truth.inStock) return { ...base, scraped, verdict: "stock-mismatch" };
    return { ...base, scraped, verdict: "ok" };
  });

  await writeFile("audit-report.json", JSON.stringify(rows, null, 2));

  const stores = [...new Set(rows.map((r) => r.store))];
  for (const store of stores) {
    const list = rows.filter((r) => r.store === store);
    const count = (v: Row["verdict"]) => list.filter((r) => r.verdict === v).length;
    console.log(
      `${store.padEnd(24)} ok ${count("ok")}, price wrong ${count("price-mismatch")}, stock wrong ${count("stock-mismatch")}, ` +
        `failed ${count("scrape-failed")}, unverified ${count("unverified")}`,
    );
    for (const r of list.filter((x) => x.verdict.endsWith("mismatch"))) {
      const s = r.scraped as { price: number; inStock: boolean | null };
      console.log(
        `    ${r.verdict}: ${r.product} scraped ${s.price}/${s.inStock ? "in" : s.inStock === false ? "out" : "?"} ` +
          `store says ${r.truth!.price}/${r.truth!.inStock ? "in" : "out"}  ${r.url}`,
      );
    }
  }

  if (!apply) return;
  const blocked = new Set(rows.filter((r) => r.verdict.endsWith("mismatch")).map((r) => r.sourceId));
  const toRefresh = new Map<string, string[]>();
  for (const r of rows) {
    if (r.verdict === "scrape-failed" || blocked.has(r.sourceId)) continue;
    toRefresh.set(r.productId, [...(toRefresh.get(r.productId) ?? []), r.sourceId]);
  }
  console.log(`\nWriting ${[...toRefresh.values()].flat().length} links to the database...`);
  for (const [productId, sourceIds] of toRefresh) await compareProduct(workspaceId, productId, { sourceIds });
  console.log("Done.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeBrowser();
    await mongoose.disconnect();
  });
