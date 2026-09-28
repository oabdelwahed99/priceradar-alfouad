# Price Radar: Cosmetics Price Comparison & Pricing Intelligence

Price Radar compares your product prices with competitor stores. You enter a product, your own store URL and 1–20 competitor URLs. The app opens each page with Playwright, extracts price, currency, availability and product info, stores every result as an append-only price observation, and shows where your price sits in the market. It also captures each page's copy (title, description, headings, FAQ) and shows the SEO gaps between your product page and competitors'.

All pricing logic is deterministic and rule-based. There are no AI models, LLM APIs, embeddings or vector databases.

## Stack

- Next.js 16 (App Router, Turbopack), React 19 and TypeScript
- Tailwind CSS 4 and shadcn/ui (Base UI primitives), Lucide icons and Recharts
- MongoDB Atlas via Mongoose 9
- Playwright (Chromium) with Cheerio for extraction
- Zod 4 for validation and Vitest for unit tests
- pnpm

## Getting started

Requirements: Node.js 20 or later, pnpm 10, and a MongoDB Atlas cluster (or another MongoDB server).

```bash
pnpm install
pnpm playwright:install        # downloads Chromium for the scraper (once)
cp .env.example .env.local     # then fill in MONGODB_URI
pnpm seed                      # optional: load demo data
pnpm dev                       # http://localhost:3000
```

Open the site, then sign in with account ID `alfo2ad` and the `AUTH_PASSWORD` from your env file. The landing page is public. Dashboard, products, and the API require that session.

### Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `MONGODB_URI` | yes | MongoDB connection string. Never commit it. |
| `MONGODB_DB` | no | Database name when the URI has none (default `price_radar`). |
| `NEXT_PUBLIC_APP_URL` | no | Public base URL, e.g. `http://localhost:3000`. |
| `DEFAULT_WORKSPACE_ID` | no | Workspace product data is stored under (default `default`). |
| `AUTH_PASSWORD` | yes, to sign in | Password for account ID `alfo2ad`. |
| `AUTH_SECRET` | yes, to sign in | Long random string that signs the session cookie. |
| `SCRAPER_CONCURRENCY` | no | URLs scraped at the same time, 1–5 (default 3). |
| `SCRAPER_TIMEOUT_MS` | no | Navigation timeout per URL (default 30000). |
| `SCRAPER_DOMAIN_DELAY_MS` | no | Minimum delay between requests to one domain (default 1500). |

`.env.local` and `.env` are loaded; neither is committed.

### Scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` / `pnpm build` / `pnpm start` | Develop, build and serve the app |
| `pnpm typecheck` | Generate route types and run `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm seed` | Replace demo data (10 "Demo Product N" items with a year of generated history) |
| `pnpm seed:clear` | Remove demo data only |
| `pnpm import:sheet` | Import the hair care price sheet as real products (safe to re-run) |
| `pnpm scrape <url...>` | Run the scraper on URLs and print the JSON result, without saving anything |
| `pnpm playwright:install` | Install the Chromium build Playwright needs |

## Using the app

1. **Add Product** (`/products/new`): enter a name, your store URL and competitor URLs, then click **Compare Prices**.
2. The product page shows your price, the market median, average and range, the price gap, your price position and a suggested price. It also has a competitor table with a Retry button for failed stores, and a price history chart for 7 days, 30 days, 90 days, 6 months or 1 year.
3. **Refresh Prices** scrapes every URL again. Each successful scrape adds a new observation, and old ones are never overwritten. Full refreshes of the same product are limited to one every 30 seconds.
4. **Dashboard** shows portfolio KPIs, the position distribution, products that need attention and new alerts.
5. **Products** supports search, a position filter, sortable columns and pagination (all state lives in the URL).
6. **Price Matrix** (`/matrix`) shows every product as a row and every store as a column, with your store first. Each cell holds that store's latest price and its difference from your price. The lowest in-stock price in each row is highlighted, and the last column shows your position and gap to the market median. Cells show "Out of stock", "Not checked" or "Failed" when there is no current price. When the latest check failed but an earlier price exists, that price is shown with a warning icon. Demo products are hidden unless you turn them on, and **Export CSV** downloads the same grid.
7. **Retailers** are created automatically from product URLs and can also be added, renamed or deleted (only when unused).
8. **Alerts** are raised automatically. See the alert rules below.

Demo products point at reserved `.example` domains and can't be refreshed.

### Importing a price sheet

`pnpm import:sheet` loads `scripts/data/hair-care-price-sheet.ts`, which holds one row per product and one column per store (URL and price). Each sheet price is stored as a *manual* price observation (`origin: "manual"`), and the product's analysis is computed right away. Imported products are ordinary products, so **Refresh Prices** replaces the sheet prices with scraped ones. Products are matched by name and store links by URL. Re-running the import only adds new products and links, and never duplicates price history. A cell with a price but no URL is skipped and listed in the output: add the link and run the import again.

## Pricing rules

All values are computed from the latest successful observation of each source.

- **Market statistics** are the minimum, maximum, average and median of the competitor prices that count toward the market. Competitors are excluded when their scrape failed, the price is invalid, they are **out of stock**, or they use a different currency from yours.
- **Price gap:** `((own price − market median) / market median) × 100`, rounded to 2 decimals.
- **Price position:**

  | Gap | Position | Suggested price |
  | --- | --- | --- |
  | below −10% | Underpriced | median × 0.98 |
  | −10% to below −5% | Slightly underpriced | median × 0.99 |
  | −5% to +5% | Market aligned | keep current price |
  | above +5% to +10% | Slightly overpriced | median × 1.00 |
  | above +10% | Overpriced | median × 1.02 |

- Suggested prices are rounded to the currency's minor unit, rounding half away from zero. The label is always "Suggested price", never "correct" or "optimal", and is shown with the disclaimer *"Suggested price is based on observed competitor prices only."*
- Thresholds live in `src/lib/services/pricing/price-position.ts` and multipliers in `pricing-recommendation.service.ts`.

## Alert rules

Alerts are generated after each comparison:

1. **Price change:** a competitor's price differs from its previous observation.
2. **Overpriced:** your gap moves above +10% (raised only when crossing, not on every check).
3. **Underpriced:** your gap moves below −10% (raised only when crossing).
4. **Out of stock:** a competitor changes to out of stock.
5. **Content change:** a competitor rewrites the title, meta description, description, headings, bullet points or FAQ of its product page.

Alerts can be marked read, dismissed or restored, and are deleted automatically after 180 days.

## Content & SEO analysis

Every successful price check also reads the page's copy (or use **Capture content** to read copy only), and the product page's **Content & SEO** tab (`/products/:id?tab=content`) compares your page with competitors'. Like pricing, it is rule-based: no AI models.

The **Content & SEO** page (`/content`) puts every product in one table: content score, failed and improvable checks, missing keywords, missing product facts, description length against the competitor median, and the latest competitor page rewrite. It supports search, a score filter (needs work below 50, fair 50–79, good 80+, not captured), sortable columns and pagination, and opens each product's Content & SEO tab. Demo products are excluded.

**Two ways to scrape:**

- **Capture content** reads every store page's copy without touching prices, so imported sheet prices stay as they are. It is available per product (Content & SEO tab) and for all products in the current filter (`/content`).
- **Refresh all prices** (`/content`) runs the full price check for every product in the current filter. It replaces sheet prices with scraped ones, may raise price alerts, and also captures content.

Bulk runs go through products one at a time from the browser, so keep the tab open. The table updates as each product finishes, and the run can be stopped after the current product. Products that were refreshed less than 30 seconds ago, or are already being checked, are skipped.

**What is captured:** page title, meta description, the product description (the longest of the JSON-LD description and the page's description block), H1–H3 headings, bullet points in the description, FAQ questions (`FAQPage` JSON-LD), rating and review count, image alt-text coverage and page language. Headings from site chrome, recommendation carousels, cart drawers and pop-ups are skipped. Content extraction never affects price extraction.

**Versioning:** content is stored in `ProductContentSnapshot`, one document per distinct version of a page. A new version is saved only when the copy changes (a hash of title, meta description, description, headings, bullets and FAQ). Ratings and image counts are updated in place.

**Analysis:**

- **Keyword gap:** words and two-word phrases used on at least 30% of competitor pages (minimum 2; 1 when there are fewer than 3 pages) that your page never uses. Arabic text is normalized (diacritics, alef/ya/ta-marbuta variants, the definite article) so spelling variants count together. Stopwords, store names and commerce boilerplate are ignored.
- **Product facts:** cosmetics attributes detected in English and Arabic, such as ingredients, how to use, hair or skin type, sulfate-free, paraben-free, halal, cruelty-free, size and country of origin.
- **Overlap:** the share of the shorter description's vocabulary found in the other. 80% or more usually means both pages use the manufacturer's text.
- **SEO checklist:** title length (30–65 characters), meta description (70–160), a single H1, description depth versus the competitor median, original copy, keyword and fact coverage, bullet points, FAQ markup, review stars markup and image alt text (80%+). The **content score** is the share of applicable checks passed.

Thresholds live in `src/lib/services/content/content-analysis.ts` and attribute patterns in `text-analysis.ts`. Competitor content is shown for research only: copying it can breach copyright, and search engines rank duplicate text lower.

## Scraping behaviour and safety

- One shared headless Chromium, with a fresh browser context per page. Images, fonts and media are blocked, and pages use Playwright's default user agent. There is no stealth mode or fingerprint spoofing.
- **robots.txt** is fetched and respected per domain (cached for 1 hour), including `Crawl-delay` (capped at 30 seconds).
- At most **3 URLs at once** (configurable up to 5). Requests to the same domain are spaced at least 1.5 seconds apart. Every page has a navigation timeout.
- Local and private network addresses are rejected.
- Pages that return 401, 403 or 429, or show a CAPTCHA or bot challenge, are reported as **blocked** and skipped. The app never attempts to bypass CAPTCHAs, anti-bot systems or logins.
- One failing URL never breaks the comparison. Each source reports its own error (invalid URL, timeout, unavailable, blocked, empty page, rendering failure, price not found, currency not found) with a Retry action.
- Extraction tries these strategies in order: JSON-LD `Product`/`Offer` data, microdata, price meta tags, price data attributes, common price CSS selectors, and finally visible text. Site-specific scrapers can be registered in `src/lib/services/scraping/registry.ts` by implementing `RetailerScraper`.

Only scrape sites whose terms allow it.

## Architecture

```
src/
  app/                  pages (dashboard, products, matrix, content, retailers, alerts) and api/ route handlers
  components/           ui/ (shadcn), layout/, products/, pricing/, content/, dashboard/, retailers/, alerts/
  lib/
    db/                 Mongoose connection and page data loading
    services/           business logic: scraping/, pricing/, content/, comparison/, products/, retailers/, alerts/, dashboard/, matrix/, imports/
    validation/         Zod schemas shared by API routes, pages and forms
    demo/               deterministic demo data generator
  models/               Product, Retailer, ProductSource, PriceObservation, ProductContentSnapshot, Alert
  types/                shared enums and DTOs
  utils/                formatting helpers
scripts/                seed, scrape and import CLIs; data/ holds price sheets
```

Route handlers and pages only validate input and call services. All scraping, pricing and alert logic lives in `src/lib/services`. Each product keeps a denormalized `latestAnalysis` snapshot, which makes the list and dashboard queries cheap. Full history stays in `PriceObservation`.

### API

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/products` | Create a product with its own and competitor URLs |
| `GET` | `/api/products` | List products (`q`, `position`, `sort`, `order`, `page`, `pageSize`) |
| `GET` / `DELETE` | `/api/products/:id` | Product detail / delete it with its history and alerts |
| `POST` | `/api/products/:id/compare` | Scrape all sources, or only `{ sourceIds }` |
| `POST` | `/api/products/:id/refresh` | Manual refresh (30-second cooldown) |
| `GET` | `/api/products/:id/prices` | Competitor comparison rows |
| `GET` | `/api/products/:id/analysis` | Market statistics, position and suggested price |
| `GET` | `/api/products/:id/history` | Price history per source (`range` = `7d`, `30d`, `90d`, `6m` or `1y`) |
| `GET` | `/api/products/:id/content` | Content & SEO analysis: checklist, keyword gap, product facts and per-page content |
| `POST` | `/api/products/:id/content` | Capture page content from every store link without changing prices |
| `GET` | `/api/content` | Content & SEO overview of all products (`q`, `band`, `sort`, `order`, `page`, `pageSize`) |
| `GET` | `/api/matrix/export` | Price matrix as CSV (`q`, `position`, `demo=1`) |
| `GET` / `POST` | `/api/retailers` | List with stats / create |
| `PATCH` / `DELETE` | `/api/retailers/:id` | Rename / delete an unused retailer |
| `GET` | `/api/alerts` | List (`status` = `active`, `new`, `read`, `dismissed` or `all`; `type`, `page`) |
| `PATCH` | `/api/alerts/:id` | Set `{ status }` |
| `POST` | `/api/alerts/mark-all-read` | Mark every new alert as read |

Responses use `{ "data": ... }` for success and `{ "error": { "code", "message", "details" } }` for errors. Validation errors return 400, missing resources 404, conflicts 409 and database outages 503.

## Notes and limitations

- One sign-in account, ID `alfo2ad`. All data is still scoped by `workspaceId` (`DEFAULT_WORKSPACE_ID`, default `default`).
- Scrapes run inside the request (`maxDuration` is 300 seconds), which suits a small number of URLs. A background job queue is the natural next step for scheduled refreshes.
- The refresh cooldown and the per-product run lock live in memory, so they are per server instance.
- Tests are pinned to Vitest 3 so they run on Node 20; newer Vitest majors require Node 22.12+.
# priceradar-alfouad
