import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ locale: "en-US", userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36" });
for (const u of process.argv.slice(2)) {
  await p.goto(u, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
  await p.waitForTimeout(3500);
  const info = await p.evaluate(() => {
    const ld = Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map((s) => s.textContent).filter((t) => /ffer|price/i.test(t)).map((t) => t.replace(/\s+/g, " ").slice(0, 500));
    const avail = document.querySelector("#availability")?.innerText.replace(/\s+/g, " ").trim() ?? "";
    const cart = !!document.querySelector("#add-to-cart-button, #buy-now-button");
    const seeAll = !!document.querySelector("#buybox-see-all-buying-choices, #aod-ingress-link, a[href*='offer-listing']");
    const core = document.querySelector("#corePriceDisplay_desktop_feature_div, #corePrice_feature_div")?.innerText.replace(/\s+/g, " ").trim().slice(0, 120) ?? "";
    return { avail, cart, seeAll, core, ld };
  });
  console.log("\n#", u.split("/dp/")[1]);
  console.log(JSON.stringify(info, null, 1));
}
await b.close();
