import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { RedisDb, buildKey } from "../index";
import { ENV } from "../config";

describe("hash operations", () => {
  let redis: RedisDb;
  const testPrefix = "cauRedisTest:hash";

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

  it("should set and get a hash field", async () => {
    const key = buildKey(testPrefix, "h1");
    const field = "name";
    const value = "Alice";

    await redis.hSet({ key, fields: { [field]: value } });
    const result = await redis.hGet({ key, field });

    expect(result).toBe(value);
  });

  it("should return null for a non-existent hash field", async () => {
    const key = buildKey(testPrefix, "h1");

    const result = await redis.hGet({ key, field: "nonexistent" });

    expect(result).toBeNull();
  });

  it("should set multiple fields and get all", async () => {
    const key = buildKey(testPrefix, "h2");
    const fields = { name: "Bob", role: "admin", status: "active" };

    await redis.hSet({ key, fields });
    const result = await redis.hGetAll({ key });

    expect(result).toEqual(fields);
  });

  it("should delete hash fields", async () => {
    const key = buildKey(testPrefix, "h3");

    await redis.hSet({ key, fields: { a: "1", b: "2", c: "3" } });
    const deleted = await redis.hDel({ key, fields: ["a", "b"] });
    const remaining = await redis.hGetAll({ key });

    expect(deleted).toBe(2);
    expect(remaining).toEqual({ c: "3" });
  });

  it("should check if a hash field exists", async () => {
    const key = buildKey(testPrefix, "h4");

    await redis.hSet({ key, fields: { present: "yes" } });
    const existsResult = await redis.hExists({ key, field: "present" });
    const notExistsResult = await redis.hExists({ key, field: "absent" });

    expect(existsResult).toBe(true);
    expect(notExistsResult).toBe(false);
  });

  it("should return all hash keys", async () => {
    const key = buildKey(testPrefix, "h5");
    const fields = { x: "1", y: "2", z: "3" };

    await redis.hSet({ key, fields });
    const keys = await redis.hKeys({ key });

    expect(keys.sort()).toEqual(["x", "y", "z"]);
  });

  it("should return all hash values", async () => {
    const key = buildKey(testPrefix, "h6");
    const fields = { x: "10", y: "20" };

    await redis.hSet({ key, fields });
    const vals = await redis.hVals({ key });

    expect(vals.sort()).toEqual(["10", "20"]);
  });

  it("should increment a hash field by value", async () => {
    const key = buildKey(testPrefix, "h7");

    await redis.hSet({ key, fields: { counter: "10" } });
    const result = await redis.hIncrBy({ key, field: "counter", by: 7 });

    expect(result).toBe(17);
  });

  it("should return empty object for hGetAll on non-existent key", async () => {
    const key = buildKey(testPrefix, "h_nonexistent");

    const result = await redis.hGetAll({ key });

    expect(result).toEqual({});
  });
});
