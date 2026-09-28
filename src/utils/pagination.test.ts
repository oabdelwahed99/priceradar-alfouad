import { describe, expect, it } from "vitest";
import { pageWindow } from "./pagination";

describe("pageWindow", () => {
  it("returns a single page", () => {
    expect(pageWindow(1, 1)).toEqual([1]);
  });

  it("returns nothing for zero pages", () => {
    expect(pageWindow(1, 0)).toEqual([]);
  });

  it("shows all pages when there are no gaps", () => {
    expect(pageWindow(2, 4)).toEqual([1, 2, 3, 4]);
  });

  it("inserts gaps around a window in the middle", () => {
    expect(pageWindow(5, 10)).toEqual([1, null, 4, 5, 6, null, 10]);
  });

  it("handles the first and last page", () => {
    expect(pageWindow(1, 10)).toEqual([1, 2, null, 10]);
    expect(pageWindow(10, 10)).toEqual([1, null, 9, 10]);
  });
});
