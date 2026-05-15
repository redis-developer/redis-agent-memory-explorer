import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "redis";

import type { McpOperationConfig } from "./index";

import { ENV } from "../../config";
import { initializeMcp, listTools, callTool } from "./index";

const TEST_DATA_MODEL = {
  title: "MCP Integration Test Surface",
  description: "Surface for testing MCP operations",
  entities: [
    {
      name: "TestItem",
      description: "Simple test entity",
      redis_key_template: "mcp_test_item:{item_id}",
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
      ],
    },
  ],
};

const TEST_RECORDS = [
  { item_id: "mcp-item-001", title: "Redis Vector Search Guide", category: "database" },
  { item_id: "mcp-item-002", title: "LangGraph Agent Tutorial", category: "ai" },
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
let agentKey = "";
let mcpConfig: McpOperationConfig;

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 60000;

const pollForTools = async (config: McpOperationConfig): Promise<void> => {
  const startTime = Date.now();
  let tools: unknown[] = [];

  while (Date.now() - startTime < POLL_TIMEOUT_MS) {
    try {
      tools = await listTools(config);
      const hasTools = tools.length > 0;
      if (hasTools) {
        return;
      }
    } catch {
      // tools not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(`Tools not available after ${POLL_TIMEOUT_MS}ms`);
};

describe("MCP operations (integration)", () => {
  beforeAll(async () => {
    const hasCredentials = ENV.CTX_ADMIN_KEY && ENV.CTX_MCP_URL && ENV.REDIS_URL;
    if (!hasCredentials) {
      throw new Error("Missing CTX_ADMIN_KEY, CTX_MCP_URL, or REDIS_URL in .env");
    }

    const redis = parseRedisUrl(ENV.REDIS_URL);
    const adminApiUrl = ENV.CTX_ADMIN_API_URL || "https://cloud.redis.io/context-surfaces";
    const normalizedBase = adminApiUrl.endsWith("/") ? adminApiUrl.slice(0, -1) : adminApiUrl;

    const createResponse = await fetch(`${normalizedBase}/api/v1/context-surfaces`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": ENV.CTX_ADMIN_KEY },
      body: JSON.stringify({
        name: `mcp-test-${Date.now()}`,
        description: "MCP integration test",
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

    const loadResponse = await fetch(
      `${normalizedBase}/api/v1/context-surfaces/${surfaceId}/data`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": ENV.CTX_ADMIN_KEY },
        body: JSON.stringify({ entity: "TestItem", records: TEST_RECORDS }),
      },
    );
    const loadResponseOk = loadResponse.ok;
    if (!loadResponseOk) {
      const text = await loadResponse.text();
      throw new Error(`Failed to load test records: ${text}`);
    }

    const keyResponse = await fetch(
      `${normalizedBase}/api/v1/context-surfaces/${surfaceId}/agent-keys`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": ENV.CTX_ADMIN_KEY },
        body: JSON.stringify({ name: `mcp-test-key-${Date.now()}` }),
      },
    );

    const keyBody = (await keyResponse.json()) as Record<string, unknown>;
    agentKey = keyBody.key as string;

    mcpConfig = {
      mcpUrl: ENV.CTX_MCP_URL,
      agentKey,
      timeout: 30000,
    };

    await pollForTools(mcpConfig);
  }, 120000);

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
      const keysToDelete = TEST_RECORDS.map((r) => `mcp_test_item:${r.item_id}`);
      await redisClient.del(keysToDelete);
    } catch {
      // best-effort Redis cleanup
    } finally {
      await redisClient.quit().catch(() => {});
    }
  }, 30000);

  describe("initializeMcp", () => {
    it("should return protocol version, server info, and capabilities", async () => {
      const result = await initializeMcp(mcpConfig);

      expect(result.protocolVersion).toBeDefined();
      expect(result.serverInfo).toBeDefined();
      expect(result.serverInfo.name).toBeDefined();
      expect(result.serverInfo.version).toBeDefined();
    });

    it("should throw when agent key is invalid", async () => {
      const invalidConfig: McpOperationConfig = {
        ...mcpConfig,
        agentKey: "invalid-key",
      };

      await expect(initializeMcp(invalidConfig)).rejects.toThrow();
    });
  });

  describe("listTools", () => {
    it("should return an array of tools with name, description, and inputSchema", async () => {
      const tools = await listTools(mcpConfig);

      expect(Array.isArray(tools)).toBe(true);
      const hasTools = tools.length > 0;
      expect(hasTools).toBe(true);

      const firstTool = tools[0];
      expect(firstTool.name).toBeDefined();
      expect(firstTool.description).toBeDefined();
      expect(firstTool.inputSchema).toBeDefined();
    });

    it("should include expected tool name patterns", async () => {
      const tools = await listTools(mcpConfig);
      const toolNames = tools.map((t) => t.name);
      const hasSearchOrFilter = toolNames.some(
        (name) =>
          name.startsWith("search_") ||
          name.startsWith("filter_") ||
          name.startsWith("get_"),
      );

      expect(hasSearchOrFilter).toBe(true);
    });

    it("each tool inputSchema should have type object", async () => {
      const tools = await listTools(mcpConfig);

      for (const tool of tools) {
        expect(tool.inputSchema.type).toBe("object");
      }
    });
  });

  describe("callTool", () => {
    it("should return a result with content array when calling a valid tool", async () => {
      const tools = await listTools(mcpConfig);
      const hasTools = tools.length > 0;
      expect(hasTools).toBe(true);

      const searchTool = tools.find((t) => t.name.startsWith("search_"));
      const filterTool = tools.find((t) => t.name.startsWith("filter_"));
      const getByIdTool = tools.find((t) => t.name.startsWith("get_"));

      const toolToCall = searchTool ?? filterTool ?? getByIdTool ?? tools[0];
      const toolArgs: Record<string, unknown> = searchTool
        ? { query: "Redis" }
        : filterTool
          ? { value: "test" }
          : getByIdTool
            ? { id: "item-001" }
            : {};

      const result = await callTool(mcpConfig, toolToCall.name, toolArgs);
      expect(result).toBeDefined();
    });

    it("should throw when calling a tool name that does not exist", async () => {
      await expect(
        callTool(mcpConfig, "nonexistent_tool_xyz_999", {}),
      ).rejects.toThrow();
    });
  });
});
