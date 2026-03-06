import { describe, it, expect } from "vitest";

import { buildKey } from "./build-key.util";

describe("buildKey", () => {
  it("should join two segments with colon", () => {
    const result = buildKey("myapp", "user");
    expect(result).toBe("myapp:user");
  });

  it("should join multiple segments with colons", () => {
    const result = buildKey("myapp", "user", "123", "profile");
    expect(result).toBe("myapp:user:123:profile");
  });

  it("should return the single segment when only one is provided", () => {
    const result = buildKey("solo");
    expect(result).toBe("solo");
  });

  it("should handle empty string segments", () => {
    const result = buildKey("myapp", "", "user");
    expect(result).toBe("myapp::user");
  });
});
