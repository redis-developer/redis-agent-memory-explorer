import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { RedisDb, buildKey } from "../index";
import { ENV } from "../config";

describe("json operations", () => {
  let redis: RedisDb;
  const testPrefix = "cauRedisTest:json";

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

  it("should set and get a JSON document at root path", async () => {
    const key = buildKey(testPrefix, "doc1");
    const value = { name: "Alice", age: 30 };

    const setResult = await redis.jsonSet({ key, value });
    const getResult = await redis.jsonGet<typeof value>({ key });

    expect(setResult).toBe(true);
    expect(getResult).toEqual(value);
  });

  it("should update a nested path", async () => {
    const key = buildKey(testPrefix, "doc2");
    const value = { name: "Bob", score: 100 };

    await redis.jsonSet({ key, value });
    await redis.jsonSet({ key, path: "$.score", value: 200 });
    const result = await redis.jsonGet<typeof value>({ key });

    expect(result).toBeDefined();
    expect((result as typeof value).score).toBe(200);
  });

  it("should return null for a non-existent JSON key", async () => {
    const key = buildKey(testPrefix, "nonexistent");

    const result = await redis.jsonGet({ key });

    expect(result).toBeNull();
  });

  it("should delete a JSON document", async () => {
    const key = buildKey(testPrefix, "doc3");
    const value = { temp: true };

    await redis.jsonSet({ key, value });
    const delResult = await redis.jsonDel({ key });
    const getResult = await redis.jsonGet({ key });

    expect(delResult).toBe(1);
    expect(getResult).toBeNull();
  });

  it("should mGet multiple JSON documents", async () => {
    const key1 = buildKey(testPrefix, "mget1");
    const key2 = buildKey(testPrefix, "mget2");

    await redis.jsonSet({ key: key1, value: { id: 1 } });
    await redis.jsonSet({ key: key2, value: { id: 2 } });

    const results = await redis.jsonMGet({ keys: [key1, key2] });

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({ id: 1 });
    expect(results[1]).toEqual({ id: 2 });
  });

  it("should append to a JSON array", async () => {
    const key = buildKey(testPrefix, "arr1");
    const value = { tags: ["a", "b"] };

    await redis.jsonSet({ key, value });
    const newLength = await redis.jsonArrAppend({
      key,
      path: "$.tags",
      values: ["c"],
    });

    expect(newLength).toBe(3);

    const result = await redis.jsonGet<typeof value>({ key });
    expect((result as typeof value).tags).toEqual(["a", "b", "c"]);
  });

  it("should increment a JSON number", async () => {
    const key = buildKey(testPrefix, "num1");
    const value = { counter: 10 };

    await redis.jsonSet({ key, value });
    const result = await redis.jsonNumIncrBy({
      key,
      path: "$.counter",
      by: 5,
    });

    expect(result).toBe(15);
  });

  it("should respect NX flag on jsonSet", async () => {
    const key = buildKey(testPrefix, "nxjson");
    const value = { original: true };

    await redis.jsonSet({ key, value });
    const result = await redis.jsonSet({ key, value: { replaced: true }, nx: true });

    expect(result).toBe(false);

    const stored = await redis.jsonGet<typeof value>({ key });
    expect(stored).toEqual(value);
  });
});
