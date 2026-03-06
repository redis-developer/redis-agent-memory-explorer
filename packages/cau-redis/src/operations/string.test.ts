import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { RedisDb, buildKey } from "../index";
import { ENV } from "../config";

describe("string operations", () => {
  let redis: RedisDb;
  const testPrefix = "cauRedisTest:string";

  beforeAll(async () => {
    redis = RedisDb.create({ url: ENV.REDIS_URL });
    await redis.connect();
  });

  afterAll(async () => {
    const scanResult = await redis.scan({ pattern: `${testPrefix}:*` });
    const hasKeys = scanResult.keys.length > 0;
    if (hasKeys) {
      await redis.del({ keys: scanResult.keys });
    }
    await redis.close();
  });

  it("should set and get a string value", async () => {
    const key = buildKey(testPrefix, "basic");
    const value = "hello-redis";

    await redis.set({ key, value });
    const result = await redis.get({ key });

    expect(result).toBe(value);
  });

  it("should return null for a non-existent key", async () => {
    const key = buildKey(testPrefix, "nonexistent");

    const result = await redis.get({ key });

    expect(result).toBeNull();
  });

  it("should set with TTL", async () => {
    const key = buildKey(testPrefix, "ttl");
    const value = "expires-soon";
    const ttlSec = 60;

    await redis.set({ key, value, ttlSec });
    const ttlResult = await redis.ttl({ key });

    expect(ttlResult).toBeGreaterThan(0);
    expect(ttlResult).toBeLessThanOrEqual(ttlSec);
  });

  it("should respect NX flag (set only if not exists)", async () => {
    const key = buildKey(testPrefix, "nx");
    const value1 = "first";
    const value2 = "second";

    await redis.set({ key, value: value1 });
    const result = await redis.set({ key, value: value2, nx: true });
    const storedValue = await redis.get({ key });

    expect(result).toBe(false);
    expect(storedValue).toBe(value1);
  });

  it("should set with setEx", async () => {
    const key = buildKey(testPrefix, "setex");
    const value = "setex-value";
    const ttlSec = 120;

    const result = await redis.setEx({ key, value, ttlSec });
    const ttlResult = await redis.ttl({ key });

    expect(result).toBe(true);
    expect(ttlResult).toBeGreaterThan(0);
  });

  it("should getSet (set new value and return old)", async () => {
    const key = buildKey(testPrefix, "getset");
    const oldValue = "old";
    const newValue = "new";

    await redis.set({ key, value: oldValue });
    const result = await redis.getSet({ key, value: newValue });
    const currentValue = await redis.get({ key });

    expect(result).toBe(oldValue);
    expect(currentValue).toBe(newValue);
  });

  it("should mSet and mGet multiple keys", async () => {
    const key1 = buildKey(testPrefix, "mset1");
    const key2 = buildKey(testPrefix, "mset2");
    const entries = { [key1]: "val1", [key2]: "val2" };

    await redis.mSet({ entries });
    const results = await redis.mGet({ keys: [key1, key2] });

    expect(results).toEqual(["val1", "val2"]);
  });

  it("should increment a value", async () => {
    const key = buildKey(testPrefix, "incr");

    await redis.set({ key, value: "10" });
    const result = await redis.incr({ key, by: 5 });

    expect(result).toBe(15);
  });

  it("should decrement a value", async () => {
    const key = buildKey(testPrefix, "decr");

    await redis.set({ key, value: "10" });
    const result = await redis.decr({ key, by: 3 });

    expect(result).toBe(7);
  });

  it("should append to a string value", async () => {
    const key = buildKey(testPrefix, "append");
    const initial = "hello";
    const suffix = "-world";

    await redis.set({ key, value: initial });
    const newLength = await redis.append({ key, value: suffix });
    const result = await redis.get({ key });

    expect(newLength).toBe(initial.length + suffix.length);
    expect(result).toBe("hello-world");
  });
});
