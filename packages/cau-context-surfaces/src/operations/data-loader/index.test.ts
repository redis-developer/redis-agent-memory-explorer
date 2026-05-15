import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "redis";

import type { DataLoaderConfig } from "./index";

import { ENV } from "../../config";
import { loadRecords } from "./index";

const TEST_DATA_MODEL = {
  title: "Data Loader Integration Test Surface",
  description: "Surface for testing data loading",
  entities: [
    {
      name: "LoadTestItem",
      description: "Entity for load testing",
      redis_key_template: "dl_test_item:{item_id}",
      fields: [
        {
          name: "item_id",
          type: "str",
          description: "Unique ID",
          is_key_component: true,
        },
        {
          name: "title",
          type: "str",
          description: "Item title",
          redis_indices: [{ type: "text" }],
        },
        {
          name: "category",
          type: "str",
          description: "Category",
          redis_indices: [{ type: "tag" }],
        },
        {
          name: "score",
          type: "float",
          description: "Score",
          redis_indices: [{ type: "numeric", sortable: true }],
        },
      ],
    },
  ],
};

const TEST_RECORDS = [
  { item_id: "dl-001", title: "Redis Vector Search Guide", category: "database", score: 9.5 },
  { item_id: "dl-002", title: "LangGraph Agent Tutorial", category: "ai", score: 8.7 },
  { item_id: "dl-003", title: "Context Surfaces Overview", category: "database", score: 9.1 },
];

const parseRedisUrl = (url: string): { addr: string; username: string; password: string; tls: boolean; db: number } => {
  const parsed = new URL(url);
  const host = parsed.hostname;
  const port = parsed.port || "6379";
  const tls = parsed.protocol === "rediss:";
  const dbPath = parsed.pathname.replace("/", "");
  const db = dbPath ? parseInt(dbPath, 10) : 0;

  return {
    addr: `${host}:${port}`,
    username: parsed.username || "default",
    password: parsed.password,
    tls,
    db,
  };
};

let surfaceId = "";
let loaderConfig: DataLoaderConfig;

describe("Data loader operations (integration)", () => {
  beforeAll(async () => {
    const hasCredentials = ENV.CTX_ADMIN_KEY && ENV.CTX_ADMIN_API_URL && ENV.REDIS_URL;
    if (!hasCredentials) {
      throw new Error("Missing CTX_ADMIN_KEY, CTX_ADMIN_API_URL, or REDIS_URL in .env");
    }

    const redis = parseRedisUrl(ENV.REDIS_URL);
    const adminApiUrl = ENV.CTX_ADMIN_API_URL || "https://cloud.redis.io/context-surfaces";
    const normalizedBase = adminApiUrl.endsWith("/") ? adminApiUrl.slice(0, -1) : adminApiUrl;

    const createResponse = await fetch(`${normalizedBase}/api/v1/context-surfaces`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": ENV.CTX_ADMIN_KEY },
      body: JSON.stringify({
        name: `dl-test-${Date.now()}`,
        description: "Data loader integration test",
        data_model: TEST_DATA_MODEL,
        data_source: {
          type: "redis",
          name: "test-redis",
          connection_config: {
            addr: redis.addr,
            username: redis.username,
            password: redis.password,
            db: redis.db,
            tls_enabled: redis.tls,
            pool_size: 5,
            min_idle_conns: 1,
          },
        },
      }),
    });

    const createBody = (await createResponse.json()) as Record<string, unknown>;
    surfaceId = createBody.id as string;

    const pollForActive = async (): Promise<void> => {
      const pollStart = Date.now();
      const pollTimeout = 30000;
      while (Date.now() - pollStart < pollTimeout) {
        const resp = await fetch(`${normalizedBase}/api/v1/context-surfaces/${surfaceId}`, {
          headers: { "X-API-Key": ENV.CTX_ADMIN_KEY },
        });
        const body = (await resp.json()) as Record<string, unknown>;
        const status = body.status as string;
        if (status === "active") {
          return;
        }
        if (status === "failed" || status === "indices_failed") {
          throw new Error(`Surface entered terminal status: ${status} (${body.status_reason ?? "unknown"})`);
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      throw new Error(`Surface did not become active within ${pollTimeout}ms`);
    };

    await pollForActive();

    loaderConfig = {
      adminApiUrl,
      adminKey: ENV.CTX_ADMIN_KEY,
      timeout: 30000,
    };
  }, 90000);

  afterAll(async () => {
    const hasSurface = surfaceId !== "";
    if (hasSurface) {
      const adminApiUrl = ENV.CTX_ADMIN_API_URL || "https://cloud.redis.io/context-surfaces";
      const normalizedBase = adminApiUrl.endsWith("/") ? adminApiUrl.slice(0, -1) : adminApiUrl;

      await fetch(`${normalizedBase}/api/v1/context-surfaces/${surfaceId}`, {
        method: "DELETE",
        headers: { "X-API-Key": ENV.CTX_ADMIN_KEY },
      });
    }

    const redisClient = createClient({ url: ENV.REDIS_URL });
    try {
      await redisClient.connect();
      const keysToDelete = TEST_RECORDS.map((r) => `dl_test_item:${r.item_id}`);
      await redisClient.del(keysToDelete);
    } catch {
      // best-effort Redis cleanup
    } finally {
      await redisClient.quit().catch(() => {});
    }
  }, 30000);

  describe("loadRecords", () => {
    it("should load a batch of records and return the loaded count", async () => {
      const result = await loadRecords(loaderConfig, surfaceId, {
        entity: "LoadTestItem",
        records: TEST_RECORDS,
      });

      expect(result.loaded).toBe(TEST_RECORDS.length);
    });

    it("should load with onConflict overwrite without error", async () => {
      const result = await loadRecords(loaderConfig, surfaceId, {
        entity: "LoadTestItem",
        records: TEST_RECORDS,
        options: { onConflict: "overwrite" },
      });

      expect(result.loaded).toBe(TEST_RECORDS.length);
    });

    it("should throw when surface id does not exist", async () => {
      await expect(
        loadRecords(loaderConfig, "nonexistent-surface-id-xyz", {
          entity: "LoadTestItem",
          records: TEST_RECORDS,
        }),
      ).rejects.toThrow();
    });

    it("should throw when admin key is invalid", async () => {
      const invalidConfig: DataLoaderConfig = {
        ...loaderConfig,
        adminKey: "invalid-key",
      };

      await expect(
        loadRecords(invalidConfig, surfaceId, {
          entity: "LoadTestItem",
          records: TEST_RECORDS,
        }),
      ).rejects.toThrow();
    });
  });
});
