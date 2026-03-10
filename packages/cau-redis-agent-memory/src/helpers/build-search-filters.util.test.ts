import type { MemorySearchOptions } from "../types";

import { describe, it, expect } from "vitest";

import { DEFAULT_SEARCH_LIMIT } from "../constants";
import { buildSearchFilters } from "./build-search-filters.util";

describe("buildSearchFilters", () => {
  it("should set text when provided", () => {
    const options: MemorySearchOptions = { text: "hello world" };
    const result = buildSearchFilters(options);

    expect(result.text).toBe("hello world");
  });

  it("should set default limit when none specified", () => {
    const options: MemorySearchOptions = { text: "test" };
    const result = buildSearchFilters(options);

    expect(result.limit).toBe(DEFAULT_SEARCH_LIMIT);
  });

  it("should use provided limit over default", () => {
    const limit = 25;
    const options: MemorySearchOptions = { text: "test", limit };
    const result = buildSearchFilters(options);

    expect(result.limit).toBe(limit);
  });

  it("should build userId eq filter", () => {
    const userId = "alice";
    const options: MemorySearchOptions = {
      text: "test",
      userId: { eq: userId },
    };
    const result = buildSearchFilters(options);

    expect(result.userId).toBeDefined();
    expect((result.userId as Record<string, unknown>).eq).toBe(userId);
  });

  it("should build topics any filter", () => {
    const topics = ["food", "travel"];
    const options: MemorySearchOptions = {
      text: "test",
      topics: { any: topics },
    };
    const result = buildSearchFilters(options);

    expect(result.topics).toBeDefined();
    expect((result.topics as Record<string, unknown>).any).toEqual(topics);
  });

  it("should build createdAt date filter from string", () => {
    const dateStr = "2024-01-01T00:00:00.000Z";
    const options: MemorySearchOptions = {
      text: "test",
      createdAt: { gte: dateStr },
    };
    const result = buildSearchFilters(options);

    expect(result.createdAt).toBeDefined();
    expect((result.createdAt as Record<string, unknown>).gte).toBe(dateStr);
  });

  it("should build createdAt date filter from Date object", () => {
    const date = new Date("2024-06-15T12:00:00.000Z");
    const options: MemorySearchOptions = {
      text: "test",
      createdAt: { lte: date },
    };
    const result = buildSearchFilters(options);

    expect(result.createdAt).toBeDefined();
    expect((result.createdAt as Record<string, unknown>).lte).toBe(
      date.toISOString(),
    );
  });

  it("should build combined filters", () => {
    const options: MemorySearchOptions = {
      text: "preferences",
      userId: { eq: "bob" },
      namespace: { eq: "production" },
      memoryType: { in: ["semantic"] },
      limit: 5,
      offset: 10,
      recencyBoost: true,
    };
    const result = buildSearchFilters(options);

    expect(result.text).toBe("preferences");
    expect(result.userId).toBeDefined();
    expect(result.namespace).toBeDefined();
    expect(result.memoryType).toBeDefined();
    expect(result.limit).toBe(5);
    expect(result.offset).toBe(10);
    expect(result.recency).toBeDefined();
    expect(result.recency!.recency_boost).toBe(true);
  });

  it("should build sessionId with in and notIn filters", () => {
    const options: MemorySearchOptions = {
      text: "test",
      sessionId: { in: ["s1", "s2"], notIn: ["s3"] },
    };
    const result = buildSearchFilters(options);

    expect(result.sessionId).toBeDefined();
    const sid = result.sessionId as Record<string, unknown>;
    expect(sid.in_).toEqual(["s1", "s2"]);
    expect(sid.not_in).toEqual(["s3"]);
  });

  it("should set optimizeQuery when provided", () => {
    const options: MemorySearchOptions = {
      text: "test",
      optimizeQuery: true,
    };
    const result = buildSearchFilters(options);

    expect(result.optimizeQuery).toBe(true);
  });

  it("should set distanceThreshold when provided", () => {
    const threshold = 0.5;
    const options: MemorySearchOptions = {
      text: "test",
      distanceThreshold: threshold,
    };
    const result = buildSearchFilters(options);

    expect(result.distanceThreshold).toBe(threshold);
  });
});
