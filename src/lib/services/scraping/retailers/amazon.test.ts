import { describe, expect, it } from "vitest";
import { readAmazonOffer } from "./amazon";

const page = (buybox: string) => `<html><body><div id="buybox">${buybox}</div></body></html>`;

describe("readAmazonOffer", () => {
  it("reads the buy-box price when the item can be added to the cart", () => {
    const html = page(
      `<div id="corePriceDisplay_desktop_feature_div"><span class="a-offscreen">EGP241.00</span></div>
       <div id="availability">In Stock</div><input id="add-to-cart-button">`,
    );
    expect(readAmazonOffer(html)).toEqual({ availability: "in_stock", price: 241 });
  });

  it("is out of stock when Amazon says currently unavailable, ignoring other sellers' prices", () => {
    const html = page(
      `<span class="a-offscreen">EGP125.00</span>
       <div id="availability">Currently unavailable. We don't know when or if this item will be back in stock.</div>`,
    );
    expect(readAmazonOffer(html)).toEqual({ availability: "out_of_stock", price: null });
  });

  it("is out of stock when the buy box only offers other sellers", () => {
    const html = page(`<a id="buybox-see-all-buying-choices">See All Buying Options</a><span class="a-offscreen">EGP99.00</span>`);
    expect(readAmazonOffer(html)).toEqual({ availability: "out_of_stock", price: null });
  });
});
