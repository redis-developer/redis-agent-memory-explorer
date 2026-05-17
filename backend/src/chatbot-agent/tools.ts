import type { StructuredToolInterface } from "@langchain/core/tools";
import type { MemoryFilter } from "cau-ram";
import type { McpTool } from "cau-context-surfaces";
import type { McpToolDef } from "../types";
import type { ContextSurfacesResult } from "../types";

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { RedisAgentMemory, MemoryType } from "cau-ram";
import { ContextSurfaces } from "cau-context-surfaces";
import { Logger } from "cau-logger";

import { getAppState } from "../app-state";
import {
  AGENT_SEARCH_DEFAULT_LIMIT,
  AGENT_SESSION_LIST_DEFAULT_LIMIT,
  AGENT_SESSION_MEMORIES_LIMIT,
} from "../constants";

let _logger: ReturnType<typeof Logger.getInstance> | null = null;
const getLogger = () => {
  if (!_logger)
    _logger = Logger.getInstance().child({ component: "ChatbotTools" });
  return _logger;
};

const searchMemoriesTool = new DynamicStructuredTool({
  name: "searchMemories",
  description:
    "Search all long-term memories using semantic similarity. Use for questions about facts, preferences, events, or any stored knowledge about the user/client.",
  schema: z.object({
    query: z.string().describe("Natural language search query"),
    memoryType: z
      .enum([MemoryType.SEMANTIC, MemoryType.EPISODIC, MemoryType.MESSAGE])
      .optional()
      .describe("Filter by memory type"),
    topics: z.array(z.string()).optional().describe("Filter by topic tags"),
    limit: z
      .number()
      .optional()
      .default(AGENT_SEARCH_DEFAULT_LIMIT)
      .describe("Max results to return"),
  }),
  func: async ({ query, memoryType, topics, limit }) => {
    const logger = getLogger();
    const { userId } = getAppState();
    const startMs = Date.now();

    logger.info("Tool: searchMemories invoked", {
      query,
      memoryType,
      topics,
      limit,
    });

    const filter: MemoryFilter = {
      ownerId: userId,
    };
    if (memoryType) {
      filter.memoryType = memoryType;
    }
    if (topics) {
      filter.topics = topics;
    }

    const result = await RedisAgentMemory.getInstance().searchLongTermMemory({
      text: query,
      filter,
      limit: limit ?? AGENT_SEARCH_DEFAULT_LIMIT,
    });

    logger.info("Tool: searchMemories completed", {
      count: result.memories.length,
      latencyMs: Date.now() - startMs,
    });

    return JSON.stringify(result);
  },
});

const searchMemoriesBySessionTool = new DynamicStructuredTool({
  name: "searchMemoriesBySession",
  description:
    "Search long-term memories extracted from a specific meeting session. Use when the user asks about a particular meeting or session.",
  schema: z.object({
    sessionId: z.string().describe("The session ID to scope the search to"),
    query: z
      .string()
      .optional()
      .describe("Optional semantic search query within the session"),
  }),
  func: async ({ sessionId, query }) => {
    const logger = getLogger();
    const startMs = Date.now();

    logger.info("Tool: searchMemoriesBySession invoked", { sessionId, query });

    const filter: MemoryFilter = {
      sessionId,
    };

    const result = await RedisAgentMemory.getInstance().searchLongTermMemory({
      text: query ?? "",
      filter,
      limit: AGENT_SESSION_MEMORIES_LIMIT,
    });

    logger.info("Tool: searchMemoriesBySession completed", {
      sessionId,
      count: result.memories.length,
      latencyMs: Date.now() - startMs,
    });

    return JSON.stringify(result);
  },
});

const getMemoryContextTool = new DynamicStructuredTool({
  name: "getMemoryContext",
  description:
    "Get a fully hydrated memory context for a query. Combines session memory with long-term memory search. Use this as the primary tool for answering questions when a session is active.",
  schema: z.object({
    query: z.string().describe("The user's question"),
    sessionId: z
      .string()
      .optional()
      .describe("Active session ID for session memory context"),
    includeAllLongTermMemories: z
      .boolean()
      .optional()
      .default(true)
      .describe("Whether to search long-term memories"),
  }),
  func: async ({ query, sessionId, includeAllLongTermMemories }) => {
    const logger = getLogger();
    const { userId } = getAppState();
    const startMs = Date.now();

    logger.info("Tool: getMemoryContext invoked", {
      query,
      sessionId,
      includeAllLongTermMemories,
    });

    const ram = RedisAgentMemory.getInstance();

    let longTermSearch: boolean | undefined;
    if (includeAllLongTermMemories) {
      longTermSearch = true;
    }

    const result = await ram.buildMemoryPrompt({
      query,
      sessionId,
      ownerId: userId,
      longTermSearch,
    });

    logger.info("Tool: getMemoryContext completed", {
      latencyMs: Date.now() - startMs,
    });

    return JSON.stringify(result);
  },
});

const listSessionsTool = new DynamicStructuredTool({
  name: "listSessions",
  description:
    "List all session memory sessions for the current user. Each session corresponds to a meeting transcript that was played back. Returns session IDs that can be used with other tools.",
  schema: z.object({
    limit: z
      .number()
      .optional()
      .default(AGENT_SESSION_LIST_DEFAULT_LIMIT)
      .describe("Max sessions to return"),
  }),
  func: async ({ limit }) => {
    const ram = RedisAgentMemory.getInstance();
    const result = await ram.listSessions({
      limit: limit ?? AGENT_SESSION_LIST_DEFAULT_LIMIT,
    });

    return JSON.stringify(result);
  },
});

const getSessionStateTool = new DynamicStructuredTool({
  name: "getSessionState",
  description:
    "Get the current session memory state, including events (messages). Use when the user asks about what happened in a specific session.",
  schema: z.object({
    sessionId: z.string().describe("The session ID"),
  }),
  func: async ({ sessionId }) => {
    const ram = RedisAgentMemory.getInstance();
    const result = await ram.getSessionMemory(sessionId);

    let output: Record<string, unknown> = {
      error: `No session memory found for session: ${sessionId}`,
    };
    if (result) {
      output = {
        sessionId: result.sessionId,
        ownerId: result.ownerId,
        eventCount: result.events.length,
      };
    }

    return JSON.stringify(output);
  },
});

const buildJsonSchemaToZod = (
  inputSchema: Record<string, unknown>,
): z.ZodType => {
  const properties = (inputSchema.properties ?? {}) as Record<
    string,
    Record<string, unknown>
  >;
  const required = (inputSchema.required ?? []) as string[];

  const shape: Record<string, z.ZodType> = {};
  const entries = Object.entries(properties);

  for (const [key, prop] of entries) {
    const description = (prop.description as string) ?? key;
    const propType = prop.type as string;

    let field: z.ZodType;
    if (propType === "number" || propType === "integer") {
      field = z.number().describe(description);
    } else {
      field = z.string().describe(description);
    }

    const isOptional = !required.includes(key);
    if (isOptional) {
      field = field.optional();
    }

    shape[key] = field;
  }

  const hasNoProperties = entries.length === 0;
  let result: z.ZodType = z.object(shape);
  if (hasNoProperties) {
    result = z.object({}).passthrough();
  }

  return result;
};

const extractMcpText = (result: {
  content?: Array<{ type: string; text?: string }>;
  isError?: boolean;
}): string => {
  const hasContent = result.content && result.content.length > 0;

  let text = "No results found.";
  if (hasContent) {
    const textParts = result
      .content!.filter((item) => item.type === "text" && item.text)
      .map((item) => item.text!);

    if (textParts.length > 0) {
      text = textParts.join("\n");
    }
  }

  return text;
};

const wrapMcpTool = (mcpTool: McpTool): DynamicStructuredTool => {
  const schema = buildJsonSchemaToZod(mcpTool.inputSchema);

  return new DynamicStructuredTool({
    name: mcpTool.name,
    description: `[Context Surfaces] ${mcpTool.description}`,
    schema,
    func: async (args: Record<string, unknown>) => {
      const logger = getLogger();
      const startMs = Date.now();

      logger.info(`Tool: ${mcpTool.name} invoked (Context Surfaces)`, { args });

      const cs = ContextSurfaces.getInstance();
      const result = await cs.callTool(mcpTool.name, args);
      const text = extractMcpText(result);

      logger.info(`Tool: ${mcpTool.name} completed`, {
        latencyMs: Date.now() - startMs,
        resultLength: text.length,
        isError: result.isError ?? false,
        resultPreview: text.slice(0, 200),
      });

      return text;
    },
  });
};

const createContextSurfacesTools = async (): Promise<ContextSurfacesResult> => {
  const logger = getLogger();

  const cs = ContextSurfaces.getInstance();
  const mcpTools = await cs.listTools();

  const tools = mcpTools.map(wrapMcpTool);
  const mcpToolDefs: McpToolDef[] = mcpTools.map((t) => ({
    name: t.name,
    description: t.description,
  }));

  logger.info("Context Surfaces tools registered", {
    count: tools.length,
    toolNames: tools.map((t) => t.name),
  });

  return { tools, mcpToolDefs };
};

const createMemoryTools = (): StructuredToolInterface[] => {
  return [
    searchMemoriesTool,
    searchMemoriesBySessionTool,
    getMemoryContextTool,
    listSessionsTool,
    getSessionStateTool,
  ];
};

const createAllTools = async (): Promise<ContextSurfacesResult> => {
  const logger = getLogger();
  const { ctxSurfaceId } = getAppState();

  const ramTools = createMemoryTools();
  const hasContextSurfaces = ctxSurfaceId !== "";

  let tools: StructuredToolInterface[] = ramTools;
  let mcpToolDefs: McpToolDef[] = [];

  if (!hasContextSurfaces) {
    logger.info("Chatbot tools: RAM only", { count: ramTools.length });
  } else {
    const csResult = await createContextSurfacesTools();
    tools = [...ramTools, ...csResult.tools];
    mcpToolDefs = csResult.mcpToolDefs;

    logger.info("Chatbot tools: RAM + Context Surfaces", {
      ramCount: ramTools.length,
      csCount: csResult.tools.length,
      totalCount: tools.length,
    });
  }

  return { tools, mcpToolDefs };
};

export { createMemoryTools, createAllTools };
