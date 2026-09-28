import { describe, expect, it } from "vitest";
import { isDatabaseUnavailableError } from "./mongoose";

describe("isDatabaseUnavailableError", () => {
  it("detects configuration and connectivity failures", () => {
    expect(isDatabaseUnavailableError(new Error("Invalid server environment: MONGODB_URI: Required"))).toBe(true);
    expect(isDatabaseUnavailableError(new Error("connect ECONNREFUSED 127.0.0.1:27017"))).toBe(true);
    const selection = new Error("Server selection timed out after 10000 ms");
    selection.name = "MongooseServerSelectionError";
    expect(isDatabaseUnavailableError(selection)).toBe(true);
  });

  it("ignores other errors", () => {
    expect(isDatabaseUnavailableError(new Error("Cast to ObjectId failed"))).toBe(false);
    expect(isDatabaseUnavailableError("MONGODB_URI")).toBe(false);
  });
});
