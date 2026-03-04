import { describe, it, expect } from "vitest";

import { buildFindOptions, buildUpdateOptions } from "./build-options.util";

describe("buildFindOptions", () => {
  it("should return an empty object when no options are provided", () => {
    const result = buildFindOptions({
      collection: "users",
      filter: {},
    });
    expect(result).toEqual({});
  });

  it("should map projection to FindOptions", () => {
    const result = buildFindOptions({
      collection: "users",
      filter: {},
      projection: { name: 1, email: 1 },
    });
    expect(result.projection).toEqual({ name: 1, email: 1 });
  });

  it("should map sort to FindOptions", () => {
    const result = buildFindOptions({
      collection: "users",
      filter: {},
      sort: { createdAt: -1 },
    });
    expect(result.sort).toEqual({ createdAt: -1 });
  });

  it("should map limit and skip to FindOptions", () => {
    const result = buildFindOptions({
      collection: "users",
      filter: {},
      limit: 10,
      skip: 20,
    });
    expect(result.limit).toBe(10);
    expect(result.skip).toBe(20);
  });

  it("should map all options together", () => {
    const result = buildFindOptions({
      collection: "users",
      filter: {},
      projection: { name: 1 },
      sort: { name: 1 },
      limit: 5,
      skip: 0,
    });
    expect(result.projection).toEqual({ name: 1 });
    expect(result.sort).toEqual({ name: 1 });
    expect(result.limit).toBe(5);
    expect(result.skip).toBe(0);
  });
});

describe("buildUpdateOptions", () => {
  it("should return an empty object when upsert is not provided", () => {
    const result = buildUpdateOptions({});
    expect(result).toEqual({});
  });

  it("should map upsert to UpdateOptions", () => {
    const result = buildUpdateOptions({ upsert: true });
    expect(result.upsert).toBe(true);
  });

  it("should map upsert false to UpdateOptions", () => {
    const result = buildUpdateOptions({ upsert: false });
    expect(result.upsert).toBe(false);
  });
});
