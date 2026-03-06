import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { RedisDb } from "../index";
import { ENV } from "../config";

describe("health operations", () => {
  let redis: RedisDb;

  beforeAll(async () => {
    redis = RedisDb.create({ url: ENV.REDIS_URL });
    await redis.connect();
  });

  afterAll(async () => {
    await redis.close();
  });

  it("should return true for ping", async () => {
    const result = await redis.ping();

    expect(result).toBe(true);
  });

  it("should return dbSize as a number", async () => {
    const result = await redis.dbSize();

    expect(typeof result).toBe("number");
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it("should return info as a non-empty string", async () => {
    const result = await redis.info();

    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain("redis_version");
  });

  it("should flush the database", async () => {
    await redis.set({ key: "cauRedisTest:health:flush", value: "temp" });
    const sizeBefore = await redis.dbSize();
    const result = await redis.flushDb();
    const sizeAfter = await redis.dbSize();

    expect(result).toBe(true);
    expect(sizeAfter).toBeLessThan(sizeBefore);
  });
});
