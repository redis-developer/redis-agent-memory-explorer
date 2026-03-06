import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { RedisDb, buildKey } from "../index";
import { ENV } from "../config";

describe("key operations", () => {
  let redis: RedisDb;
  const testPrefix = "cauRedisTest:key";

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

  it("should check if a key exists", async () => {
    const key = buildKey(testPrefix, "exists1");

    await redis.set({ key, value: "present" });
    const existsResult = await redis.exists({ key });
    const notExistsResult = await redis.exists({
      key: buildKey(testPrefix, "nope"),
    });

    expect(existsResult).toBe(true);
    expect(notExistsResult).toBe(false);
  });

  it("should delete keys", async () => {
    const key1 = buildKey(testPrefix, "del1");
    const key2 = buildKey(testPrefix, "del2");

    await redis.set({ key: key1, value: "a" });
    await redis.set({ key: key2, value: "b" });
    const deleted = await redis.del({ keys: [key1, key2] });

    expect(deleted).toBe(2);
  });

  it("should set and check expire (TTL)", async () => {
    const key = buildKey(testPrefix, "expire1");
    const ttlSec = 300;

    await redis.set({ key, value: "temp" });
    const result = await redis.expire({ key, ttlSec });
    const ttlResult = await redis.ttl({ key });

    expect(result).toBe(true);
    expect(ttlResult).toBeGreaterThan(0);
    expect(ttlResult).toBeLessThanOrEqual(ttlSec);
  });

  it("should return -1 TTL for key with no expiry", async () => {
    const key = buildKey(testPrefix, "noexpiry");

    await redis.set({ key, value: "permanent" });
    const ttlResult = await redis.ttl({ key });

    expect(ttlResult).toBe(-1);
  });

  it("should return -2 TTL for non-existent key", async () => {
    const key = buildKey(testPrefix, "ghost");

    const ttlResult = await redis.ttl({ key });

    expect(ttlResult).toBe(-2);
  });

  it("should set pExpire and check pTtl", async () => {
    const key = buildKey(testPrefix, "pexpire1");
    const ttlMs = 60000;

    await redis.set({ key, value: "temp" });
    const result = await redis.pExpire({ key, ttlMs });
    const pttlResult = await redis.pTtl({ key });

    expect(result).toBe(true);
    expect(pttlResult).toBeGreaterThan(0);
    expect(pttlResult).toBeLessThanOrEqual(ttlMs);
  });

  it("should rename a key", async () => {
    const key = buildKey(testPrefix, "rename-src");
    const newKey = buildKey(testPrefix, "rename-dst");

    await redis.set({ key, value: "moveme" });
    const result = await redis.rename({ key, newKey });
    const value = await redis.get({ key: newKey });

    expect(result).toBe(true);
    expect(value).toBe("moveme");
  });

  it("should return key type", async () => {
    const key = buildKey(testPrefix, "typed");

    await redis.set({ key, value: "stringval" });
    const result = await redis.type({ key });

    expect(result).toBe("string");
  });

  it("should return 'none' for non-existent key type", async () => {
    const key = buildKey(testPrefix, "notype");

    const result = await redis.type({ key });

    expect(result).toBe("none");
  });

  it("should scan keys matching a pattern", async () => {
    const key1 = buildKey(testPrefix, "scan1");
    const key2 = buildKey(testPrefix, "scan2");

    await redis.set({ key: key1, value: "a" });
    await redis.set({ key: key2, value: "b" });

    const allKeys: string[] = [];
    let cursor = 0;
    let iterations = 0;
    const maxIterations = 20;

    do {
      const result = await redis.scan({
        pattern: `${testPrefix}:scan*`,
        count: 100,
        cursor,
      });
      allKeys.push(...result.keys);
      cursor = result.cursor;
      iterations++;
    } while (cursor !== 0 && iterations < maxIterations);

    expect(allKeys).toContain(key1);
    expect(allKeys).toContain(key2);
  });
});
