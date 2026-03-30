import type { StructuredToolInterface } from "@langchain/core/tools";
import type { MemoryPromptRequest } from "cau-redis-agent-memory";

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { AgentMemory, MemoryType } from "cau-redis-agent-memory";

import { getAppState } from "../app-state";
import { ENV } from "../config";
import {
  AGENT_SEARCH_DEFAULT_LIMIT,
  AGENT_SESSION_LIST_DEFAULT_LIMIT,
  AGENT_SESSION_MEMORIES_LIMIT,
} from "../constants";

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
    entities: z
      .array(z.string())
      .optional()
      .describe("Filter by entity names"),
    limit: z
      .number()
      .optional()
      .default(AGENT_SEARCH_DEFAULT_LIMIT)
      .describe("Max results to return"),
  }),
  func: async ({ query, memoryType, topics, entities, limit }) => {
    const { namespace, userId } = getAppState();

    let memoryTypeFilter: { eq: string } | undefined;
    if (memoryType) {
      memoryTypeFilter = { eq: memoryType };
    }

    let topicsFilter: { any: string[] } | undefined;
    if (topics) {
      topicsFilter = { any: topics };
    }

    let entitiesFilter: { any: string[] } | undefined;
    if (entities) {
      entitiesFilter = { any: entities };
    }

    const agentMemoryInst = AgentMemory.getInstance();
    const result = await agentMemoryInst.searchLongTermMemory({
      text: query,
      namespace: { eq: namespace },
      userId: { eq: userId },
      memoryType: memoryTypeFilter,
      topics: topicsFilter,
      entities: entitiesFilter,
      limit: limit ?? AGENT_SEARCH_DEFAULT_LIMIT,
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
    const { namespace } = getAppState();
    const agentMemoryInst = AgentMemory.getInstance();
    const result = await agentMemoryInst.searchLongTermMemory({
      text: query ?? "",
      sessionId: { eq: sessionId },
      namespace: { eq: namespace },
      limit: AGENT_SESSION_MEMORIES_LIMIT,
    });

    return JSON.stringify(result);
  },
});

const getMemoryContextTool = new DynamicStructuredTool({
  name: "getMemoryContext",
  description:
    "Get a fully hydrated memory context for a query. Combines working memory (live session) with long-term memory search. Use this as the primary tool for answering questions when a session is active.",
  schema: z.object({
    query: z.string().describe("The user's question"),
    sessionId: z
      .string()
      .optional()
      .describe("Active session ID for working memory context"),
    includeAllLongTermMemories: z
      .boolean()
      .optional()
      .default(true)
      .describe("Whether to search long-term memories"),
  }),
  func: async ({ query, sessionId, includeAllLongTermMemories }) => {
    const { namespace, userId } = getAppState();
    const request: MemoryPromptRequest = { query };

    if (sessionId) {
      request.session = {
        sessionId,
        userId,
        modelName: ENV.MODEL_NAME,
        contextWindowMax: ENV.CONTEXT_WINDOW_MAX,
      };
    }

    if (includeAllLongTermMemories) {
      request.longTermSearch = {
        namespace: { eq: namespace },
        userId: { eq: userId },
      };
    }

    const agentMemoryInst = AgentMemory.getInstance();
    const result = await agentMemoryInst.memoryPrompt(request);

    return JSON.stringify(result);
  },
});

const listSessionsTool = new DynamicStructuredTool({
  name: "listSessions",
  description:
    "List all working memory sessions for the current user. Each session corresponds to a meeting transcript that was played back. Returns session IDs that can be used with other tools.",
  schema: z.object({
    limit: z
      .number()
      .optional()
      .default(AGENT_SESSION_LIST_DEFAULT_LIMIT)
      .describe("Max sessions to return"),
  }),
  func: async ({ limit }) => {
    const { namespace, userId } = getAppState();
    const agentMemoryInst = AgentMemory.getInstance();
    const result = await agentMemoryInst.listSessions({
      namespace,
      userId,
      limit: limit ?? AGENT_SESSION_LIST_DEFAULT_LIMIT,
    });

    return JSON.stringify(result);
  },
});

const getComputedSummariesTool = new DynamicStructuredTool({
  name: "getComputedSummaries",
  description:
    "Get AI-generated summary narratives that have already been computed from summary views. Returns the actual generated text. Use listSummaryViews first to discover available views, then call this with a specific viewName to fetch the computed summaries.",
  schema: z.object({
    viewName: z
      .string()
      .optional()
      .describe(
        "Name of the summary view (e.g., 'Client Memory Summary', 'Session Recap'). If not provided, returns computed summaries from all views.",
      ),
  }),
  func: async ({ viewName }) => {
    const { namespace, userId } = getAppState();
    const agentMemoryInst = AgentMemory.getInstance();
    const allViews = await agentMemoryInst.listSummaryViews();
    const ownViews = allViews.filter(
      (v) => v.filters?.namespace === namespace,
    );

    let targetViews = ownViews;
    if (viewName) {
      targetViews = ownViews.filter((v) => v.name === viewName);
    }

    const summaries = [];
    for (const view of targetViews) {
      const partitions = await agentMemoryInst.listSummaryViewPartitions(
        view.id,
        { namespace, userId },
      );
      summaries.push({ viewName: view.name, viewId: view.id, partitions });
    }

    return JSON.stringify(summaries);
  },
});

const getWorkingMemoryStateTool = new DynamicStructuredTool({
  name: "getWorkingMemoryState",
  description:
    "Get the current working memory state for a session, including message count, token usage, and auto-generated context summary. Use when the user asks about what happened in a specific session or about context window state.",
  schema: z.object({
    sessionId: z.string().describe("The session ID"),
  }),
  func: async ({ sessionId }) => {
    const { namespace, userId } = getAppState();
    const agentMemoryInst = AgentMemory.getInstance();
    const result = await agentMemoryInst.getWorkingMemory(sessionId, {
      namespace,
      userId,
    });

    let output: Record<string, unknown> = {
      error: `No working memory found for session: ${sessionId}`,
    };
    if (result) {
      output = {
        sessionId: result.sessionId,
        messageCount: result.messages.length,
        tokens: result.tokens,
        context: result.context,
        contextPercentageTotalUsed: result.contextPercentageTotalUsed,
        memoriesAttached: result.memories.length,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      };
    }

    return JSON.stringify(output);
  },
});

const listSummaryViewsTool = new DynamicStructuredTool({
  name: "listSummaryViews",
  description:
    "List all available summary view definitions. Each view is a recipe for how to summarize long-term memories (e.g., grouped by user, by session, by topic). Use this to discover what views exist before fetching computed summaries with getComputedSummaries, or before getting a single view's full definition with getSummaryView.",
  schema: z.object({}),
  func: async () => {
    const { namespace } = getAppState();
    const agentMemoryInst = AgentMemory.getInstance();
    const allViews = await agentMemoryInst.listSummaryViews();
    const views = allViews.filter((v) => v.filters?.namespace === namespace);

    const mapped = views.map((v) => ({
      viewId: v.id,
      name: v.name,
      source: v.source,
      groupBy: v.groupBy,
      timeWindowDays: v.timeWindowDays,
      continuous: v.continuous,
      prompt: v.prompt,
    }));

    return JSON.stringify({ views: mapped, total: mapped.length });
  },
});

const getSummaryViewTool = new DynamicStructuredTool({
  name: "getSummaryView",
  description:
    "Get a single summary view definition by ID. Returns the full configuration: name, source, groupBy fields, filters, timeWindowDays, continuous flag, prompt template, and model. Use this after listSummaryViews to inspect a specific view's settings, or when the user asks how a particular summary is configured.",
  schema: z.object({
    viewId: z.string().describe("The summary view ID"),
  }),
  func: async ({ viewId }) => {
    const agentMemoryInst = AgentMemory.getInstance();
    const view = await agentMemoryInst.getSummaryView(viewId);

    let output: Record<string, unknown> = {
      error: `No summary view found with ID: ${viewId}`,
    };
    if (view) {
      output = {
        viewId: view.id,
        name: view.name,
        source: view.source,
        groupBy: view.groupBy,
        filters: view.filters,
        timeWindowDays: view.timeWindowDays,
        continuous: view.continuous,
        prompt: view.prompt,
        modelName: view.modelName,
      };
    }

    return JSON.stringify(output);
  },
});

const createMemoryTools = (): StructuredToolInterface[] => {
  return [
    searchMemoriesTool,
    searchMemoriesBySessionTool,
    getMemoryContextTool,
    listSessionsTool,
    getComputedSummariesTool,
    getWorkingMemoryStateTool,
    listSummaryViewsTool,
    getSummaryViewTool,
  ];
};

export { createMemoryTools };
