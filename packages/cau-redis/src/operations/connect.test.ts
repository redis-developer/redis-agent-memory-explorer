import { describe, it, expect } from "vitest";

import {
  DEFAULT_MAX_RETRIES,
  DEFAULT_RETRY_DELAY_MS,
  DEFAULT_RETRY_MAX_DELAY_MS,
} from "../constants";
import { computeReconnectDelay } from "./connect";

describe("computeReconnectDelay", () => {
  it("should return increasing delays using exponential backoff", () => {
    const delay0 = computeReconnectDelay(0, 10, 100);
    const delay1 = computeReconnectDelay(1, 10, 100);
    const delay2 = computeReconnectDelay(2, 10, 100);

    expect(delay0).toBe(100);
    expect(delay1).toBe(200);
    expect(delay2).toBe(400);
  });

  it("should cap delay at DEFAULT_RETRY_MAX_DELAY_MS", () => {
    const delay15 = computeReconnectDelay(15, 20, 100);

    expect(delay15).toBe(DEFAULT_RETRY_MAX_DELAY_MS);
  });

  it("should return an Error when max retries exceeded", () => {
    const maxRetries = 3;

    const result = computeReconnectDelay(maxRetries, maxRetries, 100);

    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toContain(String(maxRetries));
  });

  it("should use default values correctly", () => {
    const delay0 = computeReconnectDelay(
      0,
      DEFAULT_MAX_RETRIES,
      DEFAULT_RETRY_DELAY_MS,
    );

    expect(typeof delay0).toBe("number");
    expect(delay0).toBeGreaterThan(0);
  });
});
