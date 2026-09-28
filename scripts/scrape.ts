/**
 * Manual scraper check: pnpm scrape <url> [url...]
 * Runs the same registry, queue and extraction chain as the app, without touching the database.
 */
import "./load-env";
import { closeBrowser } from "@/lib/services/scraping/browser";
import { scrapeMany } from "@/lib/services/scraping/scraper.service";

async function main() {
  const urls = process.argv.slice(2);
  if (urls.length === 0) {
    console.error("Usage: pnpm scrape <url> [url...]");
    process.exit(1);
  }
  const started = Date.now();
  const results = await scrapeMany(urls);
  for (const result of results) {
    console.log(JSON.stringify(result, null, 2));
  }
  const ok = results.filter((r) => r.success).length;
  console.error(`\n${ok}/${results.length} succeeded in ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => closeBrowser());
