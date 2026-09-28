import { describe, expect, it } from "vitest";
import { listAlertsQuerySchema, updateAlertSchema } from "./alert.schema";
import { listProductsQuerySchema } from "./product.schema";
import { updateRetailerSchema } from "./retailer.schema";
import { firstValues, parseSearchParamsLenient, toQueryString } from "./search-params";

describe("firstValues", () => {
  it("takes the first value of repeated params and drops empty ones", () => {
    expect(firstValues({ a: ["1", "2"], b: "", c: undefined, d: "x" })).toEqual({ a: "1", d: "x" });
  });
});

describe("parseSearchParamsLenient", () => {
  it("applies defaults for empty params", () => {
    expect(parseSearchParamsLenient(listProductsQuerySchema, {})).toEqual({
      sort: "lastCheckedAt",
      order: "desc",
      page: 1,
      pageSize: 20,
    });
  });

  it("keeps valid params and drops invalid ones", () => {
    const query = parseSearchParamsLenient(listProductsQuerySchema, {
      q: "serum",
      page: "abc",
      position: "CHEAP",
      sort: "gap",
      order: "asc",
    });
    expect(query).toEqual({ q: "serum", sort: "gap", order: "asc", page: 1, pageSize: 20 });
  });

  it("parses alert filters", () => {
    expect(parseSearchParamsLenient(listAlertsQuerySchema, { status: "all", type: "OUT_OF_STOCK", page: "2" })).toEqual({
      status: "all",
      type: "OUT_OF_STOCK",
      page: 2,
      pageSize: 20,
    });
    expect(parseSearchParamsLenient(listAlertsQuerySchema, { status: "archived" }).status).toBe("active");
  });
});

describe("toQueryString", () => {
  it("omits empty values", () => {
    expect(toQueryString({ q: "a b", page: 2, position: undefined, sort: null, empty: "" })).toBe("?q=a+b&page=2");
  });

  it("returns an empty string when nothing remains", () => {
    expect(toQueryString({ q: undefined })).toBe("");
  });
});

describe("alert and retailer update schemas", () => {
  it("accepts valid alert statuses only", () => {
    expect(updateAlertSchema.safeParse({ status: "read" }).success).toBe(true);
    expect(updateAlertSchema.safeParse({ status: "archived" }).success).toBe(false);
  });

  it("only allows renaming a retailer", () => {
    expect(updateRetailerSchema.parse({ name: "  Store A  ", isOwnStore: true })).toEqual({ name: "Store A" });
    expect(updateRetailerSchema.safeParse({ name: "" }).success).toBe(false);
  });
});
