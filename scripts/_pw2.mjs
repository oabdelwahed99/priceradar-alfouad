import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ locale: "en-US", userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36" });
for (const u of process.argv.slice(2)) {
  await p.goto(u, { waitUntil: "domcontentloaded", timeout: 60000 }).catch((e) => console.log("goto", String(e).slice(0, 80)));
  await p.waitForTimeout(5000);
  const info = await p.evaluate(() => {
    const t = (s) => Array.from(document.querySelectorAll(s)).slice(0, 4).map((e) => e.innerText.replace(/\s+/g, " ").trim().slice(0, 120));
    return {
      title: document.title.slice(0, 80),
      amazonPrice: t("#corePrice_feature_div .a-offscreen, #corePriceDisplay_desktop_feature_div .a-price .a-offscreen, #price_inside_buybox"),
      availability: t("#availability, #outOfStock, #buybox-see-all-buying-choices"),
      captcha: !!document.querySelector("form[action*='validateCaptcha']"),
      priceish: t("[class*='price'], [id*='price']"),
      stock: t("[class*='stock'], [class*='availability']"),
    };
  });
  console.log("\n#", u, JSON.stringify(info, null, 1));
}
await b.close();
