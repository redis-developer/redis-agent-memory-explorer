import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { RedisDb, buildKey } from "../index";
import { ENV } from "../config";

describe("pipeline operations", () => {
  let redis: RedisDb;
  const testPrefix = "cauRedisTest:pipeline";

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

  it("should execute multiple SET commands in a pipeline", async () => {
    const key1 = buildKey(testPrefix, "p1");
    const key2 = buildKey(testPrefix, "p2");

    const result = await redis.executePipeline([
      { op: "set", params: { key: key1, value: "val1" } },
      { op: "set", params: { key: key2, value: "val2" } },
    ]);

    expect(result.aborted).toBe(false);
    expect(result.results).toHaveLength(2);

    const val1 = await redis.get({ key: key1 });
    const val2 = await redis.get({ key: key2 });

    expect(val1).toBe("val1");
    expect(val2).toBe("val2");
  });

  it("should execute mixed SET and GET commands", async () => {
    const key = buildKey(testPrefix, "p3");

    await redis.set({ key, value: "existing" });

    const result = await redis.executePipeline([
      { op: "get", params: { key } },
      { op: "set", params: { key, value: "updated" } },
      { op: "get", params: { key } },
    ]);

    expect(result.aborted).toBe(false);
    expect(result.results[0]).toBe("existing");
    expect(result.results[2]).toBe("updated");
  });

  it("should execute DEL in a pipeline", async () => {
    const key = buildKey(testPrefix, "p4");

    await redis.set({ key, value: "todelete" });

    const result = await redis.executePipeline([
      { op: "del", params: { keys: [key] } },
    ]);

    expect(result.aborted).toBe(false);
    expect(result.results[0]).toBe(1);
  });

  it("should execute hash operations in a pipeline", async () => {
    const key = buildKey(testPrefix, "p5");

    const result = await redis.executePipeline([
      { op: "hSet", params: { key, fields: { name: "Alice" } } },
      { op: "hGet", params: { key, field: "name" } },
    ]);

    expect(result.aborted).toBe(false);
    expect(result.results[1]).toBe("Alice");
  });
});
