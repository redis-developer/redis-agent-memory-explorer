import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { RedisDb } from "./index";
import { ENV } from "./config";

describe("RedisDb class", () => {
  afterAll(() => {
    try {
      const instance = RedisDb.getInstance();
      instance.close();
    } catch {
      // already cleaned up
    }
  });

  it("should create an instance with default config", () => {
    const redis = RedisDb.create();

    expect(redis).toBeInstanceOf(RedisDb);
    expect(redis.isConnected()).toBe(false);

    redis.close();
  });

  it("should create an instance with custom config", () => {
    const redis = RedisDb.create({ url: ENV.REDIS_URL });

    expect(redis).toBeInstanceOf(RedisDb);

    redis.close();
  });

  it("should store and retrieve the singleton instance", () => {
    const redis = RedisDb.create({ url: ENV.REDIS_URL });
    const retrieved = RedisDb.getInstance();

    expect(retrieved).toBe(redis);

    redis.close();
  });

  it("should throw when getInstance() called without create()", () => {
    const redis = RedisDb.create();
    redis.close();

    expect(() => RedisDb.getInstance()).toThrow("not initialized");
  });

  it("should clear singleton on close", async () => {
    const redis = RedisDb.create({ url: ENV.REDIS_URL });
    await redis.connect();
    await redis.close();

    expect(() => RedisDb.getInstance()).toThrow("not initialized");
  });

  it("should throw when performing operations without connect", async () => {
    const redis = RedisDb.create({ url: ENV.REDIS_URL });

    await expect(redis.set({ key: "test", value: "val" })).rejects.toThrow(
      "not connected",
    );

    redis.close();
  });
});
