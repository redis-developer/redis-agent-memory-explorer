import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { createClient } from "redis";

import { ContextSurfaces } from "./context-surfaces";
import { ENV } from "./config";

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

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 60000;

const waitForSurfaceActive = async (
  cs: ContextSurfaces,
  surfaceId: string,
  timeoutMs = 30000,
  intervalMs = 2000,
): Promise<void> => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const surface = await cs.getSurface(surfaceId);
    const isActive = surface.status === "active";
    if (isActive) {
      return;
    }
    const isFailed = surface.status === "failed" || surface.status === "indices_failed";
    if (isFailed) {
      throw new Error(`Surface entered terminal status: ${surface.status} (${surface.statusReason ?? "no reason"})`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Surface did not become active within ${timeoutMs}ms`);
};

const TEST_DATA_MODEL = {
  title: "E2E Test Surface",
  description: "End-to-end integration test surface",
  entities: [
    {
      name: "E2EItem",
      description: "Simple test entity for e2e",
      redisKeyTemplate: "e2e_item:{item_id}",
      fields: [
        {
          name: "item_id",
          type: "str",
          description: "Unique ID",
          isKeyComponent: true,
        },
        {
          name: "title",
          type: "str",
          description: "Item title",
          redisIndices: [{ type: "text" as const }],
        },
        {
          name: "category",
          type: "str",
          description: "Category tag",
          redisIndices: [{ type: "tag" as const }],
        },
      ],
    },
  ],
};

const TEST_RECORDS = [
  { item_id: "e2e-001", title: "Redis Vector Search Guide", category: "database" },
  { item_id: "e2e-002", title: "LangGraph Agent Tutorial", category: "ai" },
];

describe("ContextSurfaces singleton", () => {
  afterEach(async () => {
    try {
      const instance = ContextSurfaces.getInstance();
      await instance.close();
    } catch {
      // not initialized -- nothing to clean
    }
  });

  it("should throw when getInstance is called before create", () => {
    expect(() => ContextSurfaces.getInstance()).toThrow(
      "ContextSurfaces not initialized",
    );
  });

  it("should return the instance after create is called", () => {
    ContextSurfaces.create({
      adminApiUrl: "https://example.com",
      adminKey: "test-key",
    });

    const instance = ContextSurfaces.getInstance();
    expect(instance).toBeDefined();
  });

  it("should return the same instance on subsequent getInstance calls", () => {
    ContextSurfaces.create({
      adminApiUrl: "https://example.com",
      adminKey: "test-key",
    });

    const first = ContextSurfaces.getInstance();
    const second = ContextSurfaces.getInstance();
    expect(first).toBe(second);
  });

  it("should throw on getInstance after close", async () => {
    const instance = ContextSurfaces.create({
      adminApiUrl: "https://example.com",
      adminKey: "test-key",
    });

    await instance.close();

    expect(() => ContextSurfaces.getInstance()).toThrow(
      "ContextSurfaces not initialized",
    );
  });
});

describe("ContextSurfaces end-to-end flow", () => {
  let cs: ContextSurfaces;
  let surfaceId = "";
  let agentKeyValue = "";

  beforeAll(() => {
    const hasCredentials = ENV.CTX_ADMIN_KEY && ENV.CTX_MCP_URL && ENV.REDIS_URL;
    if (!hasCredentials) {
      throw new Error("Missing CTX_ADMIN_KEY, CTX_MCP_URL, or REDIS_URL in .env for e2e tests");
    }

    cs = ContextSurfaces.create({
      adminApiUrl: ENV.CTX_ADMIN_API_URL || undefined,
      mcpUrl: ENV.CTX_MCP_URL || undefined,
      adminKey: ENV.CTX_ADMIN_KEY,
    });
  });

  afterAll(async () => {
    const hasSurface = surfaceId !== "";
    if (hasSurface) {
      try {
        await cs.deleteSurface(surfaceId);
      } catch {
        // best-effort cleanup
      }
    }
    await cs.close();

    const redisClient = createClient({ url: ENV.REDIS_URL });
    try {
      await redisClient.connect();
      const keysToDelete = TEST_RECORDS.map((r) => `e2e_item:${r.item_id}`);
      await redisClient.del(keysToDelete);
    } catch {
      // best-effort Redis cleanup
    } finally {
      await redisClient.quit().catch(() => {});
    }
  }, 30000);

  it("should create a surface with a data model and data source", async () => {
    const redis = parseRedisUrl(ENV.REDIS_URL);

    const surface = await cs.createSurface({
      name: `e2e-test-${Date.now()}`,
      description: "E2E integration test surface",
      dataModel: TEST_DATA_MODEL,
      dataSource: {
        type: "redis",
        name: "test-redis",
        connectionConfig: {
          addr: redis.addr,
          username: redis.username,
          password: redis.password,
          db: redis.db,
          tlsEnabled: redis.tls,
          poolSize: 5,
          minIdleConns: 1,
        },
      },
    });

    expect(surface.id).toBeDefined();
    expect(surface.name).toContain("e2e-test-");
    surfaceId = surface.id;
  }, 30000);

  it("should create an agent key for the surface", async () => {
    const agentKey = await cs.createAgentKey(surfaceId, {
      name: `e2e-key-${Date.now()}`,
    });

    expect(agentKey.key).toBeDefined();
    expect(agentKey.contextSurfaceId).toBe(surfaceId);
    agentKeyValue = agentKey.key;
  }, 15000);

  it("should set the agent key via setAgentKey", () => {
    cs.setAgentKey(agentKeyValue);
  });

  it("should load records into the surface", async () => {
    await waitForSurfaceActive(cs, surfaceId);

    const result = await cs.loadRecords(surfaceId, {
      entity: "E2EItem",
      records: TEST_RECORDS,
    });

    expect(result.loaded).toBe(TEST_RECORDS.length);
  }, 60000);

  it("should list tools via MCP after data is loaded", async () => {
    const startTime = Date.now();
    let tools: Awaited<ReturnType<typeof cs.listTools>> = [];

    while (Date.now() - startTime < POLL_TIMEOUT_MS) {
      try {
        tools = await cs.listTools();
        const hasTools = tools.length > 0;
        if (hasTools) {
          break;
        }
      } catch {
        // not ready yet
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    expect(tools.length).toBeGreaterThan(0);
    expect(tools[0].name).toBeDefined();
    expect(tools[0].inputSchema).toBeDefined();
  }, 90000);

  it("should call a search tool and get results", async () => {
    const tools = await cs.listTools();
    const searchTool = tools.find((t) => t.name.startsWith("search_"));
    const filterTool = tools.find((t) => t.name.startsWith("filter_"));
    const getByIdTool = tools.find((t) => t.name.startsWith("get_"));

    const toolToCall = searchTool ?? filterTool ?? getByIdTool;
    expect(toolToCall).toBeDefined();

    const toolArgs: Record<string, unknown> = searchTool
      ? { query: "Redis" }
      : filterTool
        ? { value: "database" }
        : { id: "e2e-001" };

    const result = await cs.callTool(toolToCall!.name, toolArgs);
    expect(result).toBeDefined();
  }, 15000);

  it("should get the surface by id", async () => {
    const surface = await cs.getSurface(surfaceId);

    expect(surface.id).toBe(surfaceId);
    expect(surface.name).toContain("e2e-test-");
  }, 10000);

  it("should delete the surface (cleanup)", async () => {
    await cs.deleteSurface(surfaceId);

    await expect(cs.getSurface(surfaceId)).rejects.toThrow();
    surfaceId = "";
  }, 15000);
});

describe("setAgentKey", () => {
  afterEach(async () => {
    try {
      const instance = ContextSurfaces.getInstance();
      await instance.close();
    } catch {
      // not initialized
    }
  });

  it("should throw on listTools when agent key has not been set", async () => {
    ContextSurfaces.create({
      adminApiUrl: ENV.CTX_ADMIN_API_URL || "https://example.com",
      adminKey: ENV.CTX_ADMIN_KEY || "test-key",
      mcpUrl: ENV.CTX_MCP_URL || "https://example.com/mcp",
    });

    const cs = ContextSurfaces.getInstance();

    await expect(cs.listTools()).rejects.toThrow();
  });
});
