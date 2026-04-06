# Meeting Memory Demo -- Backend Chatbot Plan (V2)

## Goal

Add a **chatbot experience** to the Meeting Memory demo, allowing the user to ask natural-language questions about all stored memories for a dataset. The chatbot is powered by **CopilotKit** (frontend) and **LangGraph** (backend), and uses the existing `cau-redis-agent-memory` package to search long-term memories, session memories, working memory, and computed summaries.

This plan covers **backend-only changes**. The CopilotKit frontend integration (provider, sidebar UI, context passing) is defined in [dev-frontend-chatbot-plan.md](./dev-frontend-chatbot-plan.md).

**What the chatbot can do:**

- Answer questions about any stored long-term memory across all sessions (semantic search)
- Answer questions scoped to a specific session's memories
- Retrieve and summarize working memory context for an active session (can use existing summary views if any)
- Leverage the `memoryPrompt` feature from the Agent Memory Server (combines working memory + long-term search into a single hydrated prompt)
- List sessions and their memory counts
- Retrieve computed summaries from pre-seeded or custom summary views
- Discover and inspect summary view definitions (source, groupBy, prompt template, etc.)

**Architecture choice: Custom LangChain tools + `cau-redis-agent-memory`**

We use **Option B** from the CopilotKit demo reference (REST API + Custom Tools) rather than the MCP approach. Why:

1. `AgentMemory` is already initialized in the backend at startup -- no second server needed
2. All memory operations are available as typed methods on `AgentMemory.getInstance()`
3. The `memoryPrompt` feature provides a single endpoint that hydrates any query with both working memory context and long-term search results -- purpose-built for chatbot use
4. Simpler infra: no MCP server process, no SSE transport, no `@langchain/mcp-adapters` dependency
5. Scoping by `namespace` and `userId` is already handled by the existing `appState`

---

## Architecture Overview

```
┌───────────────────────────────────────────────────────────────────────┐
│  Next.js Frontend                                                      │
│                                                                        │
│  CopilotKit Provider (runtimeUrl: /copilotkit)                        │
│  ┌──────────────┐  ┌───────────────────────┐  ┌────────────────────┐  │
│  │ TranscriptPanel │  │ MemoryExplorerPanel   │  │ CopilotSidebar     │  │
│  │ (existing)      │  │ (existing)            │  │ (NEW -- chatbot UI)│  │
│  └──────────────┘  └───────────────────────┘  └────────────────────┘  │
└──────────┬──────────────────┬──────────────────────┬──────────────────┘
           │ POST-only REST   │                      │ CopilotKit protocol
           │ (existing APIs)  │                      │ (/copilotkit)
┌──────────▼──────────────────▼──────────────────────▼──────────────────┐
│  cau-api-server (Express)                                              │
│                                                                        │
│  Existing routes: /api/*  (POST-only, unchanged)                      │
│                                                                        │
│  NEW: /copilotkit endpoint (Express middleware, raw req/res)          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  copilotkit-langgraph.ts                                         │  │
│  │  CopilotRuntime + LangGraphAgent                                 │  │
│  │  → connects to LangGraph dev server (port 2024)                  │  │
│  └──────────────────────────────────┬───────────────────────────────┘  │
│                                     │                                  │
│  ┌──────────────────────────────────▼───────────────────────────────┐  │
│  │  LangGraph Dev Server (npx @langchain/langgraph-cli dev)         │  │
│  │  http://127.0.0.1:2024                                           │  │
│  │                                                                   │  │
│  │  graph.ts -- ReAct agent with memory tools                       │  │
│  │  ┌─────────────────────────────────────────────┐                 │  │
│  │  │  Tools:                                      │                 │  │
│  │  │  1. searchMemories (semantic search all LT)  │                 │  │
│  │  │  2. searchMemoriesBySession (scoped)         │                 │  │
│  │  │  3. getMemoryContext (memoryPrompt)           │                 │  │
│  │  │  4. listSessions                              │                 │  │
│  │  │  5. getComputedSummaries (fetch summaries)   │                 │  │
│  │  │  6. getWorkingMemoryState                     │                 │  │
│  │  │  7. listSummaryViews (discover views)        │                 │  │
│  │  │  8. getSummaryView (inspect view definition) │                 │  │
│  │  └──────────────┬──────────────────────────────┘                 │  │
│  │                  │                                                │  │
│  │                  ▼                                                │  │
│  │  AgentMemory.getInstance() -- reuses the same singleton          │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                     │                                  │
│                                     ▼ HTTP (REST)                      │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Redis Agent Memory Server (http://localhost:8000)                │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

**Key points:**

- The CopilotKit `/copilotkit` endpoint is mounted on the same Express app (via `server.expressApp.use(...)` between `create()` and `start()`) but is NOT a `cau-api-server` route -- it uses raw Express `req`/`res` because CopilotKit's `copilotRuntimeNodeHttpEndpoint` expects that
- This works because `cau-api-server` registers routes + 404 catch-all in `start()` (via `mountRouterAndErrorHandlers`), not in `create()`. Any middleware added via `expressApp.use()` between `create()` and `start()` is registered before the routes and 404.
- The LangGraph graph runs in a separate LangGraph dev server (`npx @langchain/langgraph-cli dev` on port 2024) -- this is required for CopilotKit's streaming protocol
- Since the LangGraph dev server is a **separate Node.js process**, it needs its own `AgentMemory.create()` initialization. Both processes connect to the same AMS at `http://localhost:8000`. The `graph.ts` module initializes `AgentMemory` + loads `DatasetConfig` at import time (before the graph compiles).
- The graph's tools call `AgentMemory` methods directly (same package, same AMS connection)
- All existing REST routes are untouched -- the chatbot is purely additive

---

## Project Structure (Changes Only)

```
backend/
├── src/
│   ├── index.ts                          # MODIFIED: mount /copilotkit after ApiServer.create()
│   ├── config.ts                         # MODIFIED: add LANGGRAPH_DEPLOYMENT_URL, GOOGLE_API_KEY
│   ├── constants.ts                      # MODIFIED: add COPILOTKIT_ENDPOINT, chatbot constants
│   ├── types.ts                          # MODIFIED: add chatbot-related types
│   ├── routes.ts                         # UNCHANGED
│   ├── app-state.ts                      # UNCHANGED
│   ├── handlers/                         # UNCHANGED (all existing handlers)
│   │
│   ├── chatbot-agent/                    # NEW: LangGraph agent + CopilotKit wiring (originally agent/, renamed for clarity)
│   │   ├── graph.ts                      # LangGraph StateGraph with ReAct agent + memory tools
│   │   ├── tools.ts                      # LangChain StructuredTool definitions wrapping AgentMemory
│   │   ├── copilotkit-langgraph.ts       # CopilotRuntime + LangGraphAgent + Express handler
│   │   ├── system-prompt.ts              # System prompt template for the chatbot agent
│   │   └── index.ts                      # Barrel export
│   │
│   └── services/                         # UNCHANGED
│       ├── dataset-loader.service.ts
│       └── transcript-loader.service.ts
│
├── langgraph.json                        # NEW: LangGraph CLI config
├── .env                                  # MODIFIED: add new env vars
├── package.json                          # MODIFIED: add CopilotKit + LangGraph deps
└── tsconfig.json                         # UNCHANGED
```

---

## Prerequisites (Additional)

| Dependency                      | Version                       | Purpose                                           |
| ------------------------------- | ----------------------------- | ------------------------------------------------- |
| `@copilotkit/runtime`           | latest                        | CopilotKit server-side runtime (endpoint handler) |
| `@langchain/langgraph`          | latest                        | LangGraph graph framework                         |
| `@langchain/core`               | latest                        | LangChain core (messages, tools)                  |
| `@langchain/openai`             | latest                        | OpenAI chat model (reuse existing OPENAI_API_KEY) |
| `zod`                           | latest                        | Tool parameter schemas                            |
| `@langchain/langgraph-cli`      | latest (dev)                  | LangGraph dev server CLI                          |
| `@copilotkit/runtime/langgraph` | (part of @copilotkit/runtime) | LangGraphAgent class                              |

---

## Config Changes (`config.ts`)

| Constant                   | Env Variable                   | Default                 | Description                     |
| -------------------------- | ------------------------------ | ----------------------- | ------------------------------- |
| `LANGGRAPH_DEPLOYMENT_URL` | `LANGGRAPH_DEPLOYMENT_URL`     | `http://127.0.0.1:2024` | LangGraph dev server URL        |
| `CHATBOT_MODEL`            | `MEETING_MEMORY_CHATBOT_MODEL` | `gpt-4o-mini`           | LLM model for the chatbot agent |
| `LANGSMITH_API_KEY`        | `LANGSMITH_API_KEY`            | `""`                    | Optional: LangSmith tracing     |

**Reused from existing config:**

- `OPENAI_API_KEY` -- already required for extraction/summaries, reused for the chatbot LLM
- `AGENT_MEMORY_BASE_URL` -- same AMS instance
- `ACTIVE_DATASET`, `NAMESPACE`, `USER_ID` -- scoping for memory searches

---

## LangGraph CLI Config (`langgraph.json`)

```json
{
  "node_version": "20",
  "graphs": {
    "memoryAgent": "./src/agent/graph.ts:compiledGraph"
  },
  "env": ".env"
}
```

The graph ID `"memoryAgent"` is referenced by `copilotkit-langgraph.ts` when configuring `LangGraphAgent`.

---

## Memory Tools (`agent/tools.ts`)

Eight LangChain `StructuredTool` instances wrapping `AgentMemory` methods. Each tool reads `namespace` and `userId` from `appState` (same as existing handlers). Summary view tools apply namespace scoping: views are filtered by `view.filters.namespace`. Partitions inherit the view's scope, so no additional namespace filter is needed when listing partitions. See the backend plan's "Namespace scoping" section for details on why this is needed (AMS summary view CRUD is server-global).

### Tool 1: `searchMemories`

Semantic search across all long-term memories for the current user/namespace.

```typescript
const searchMemoriesTool = new DynamicStructuredTool({
  name: "searchMemories",
  description:
    "Search all long-term memories using semantic similarity. Use for questions about facts, preferences, events, or any stored knowledge about the user/client.",
  schema: z.object({
    query: z.string().describe("Natural language search query"),
    memoryType: z
      .enum(["semantic", "episodic", "message"])
      .optional()
      .describe("Filter by memory type"),
    topics: z.array(z.string()).optional().describe("Filter by topic tags"),
    entities: z.array(z.string()).optional().describe("Filter by entity names"),
    limit: z.number().optional().default(10).describe("Max results to return"),
  }),
  func: async ({ query, memoryType, topics, entities, limit }) => {
    const { namespace, userId } = getAppState();
    const result = await AgentMemory.getInstance().searchLongTermMemory({
      text: query,
      namespace: { eq: namespace },
      userId: { eq: userId },
      memoryType: memoryType ? { eq: memoryType } : undefined,
      topics: topics ? { any: topics } : undefined,
      entities: entities ? { any: entities } : undefined,
      limit: limit ?? 10,
    });
    return JSON.stringify(result);
  },
});
```

### Tool 2: `searchMemoriesBySession`

Scoped to a specific session's extracted memories.

```typescript
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
    const result = await AgentMemory.getInstance().searchLongTermMemory({
      text: query ?? "",
      sessionId: { eq: sessionId },
      namespace: { eq: namespace },
      limit: 50,
    });
    return JSON.stringify(result);
  },
});
```

### Tool 3: `getMemoryContext`

Leverages the `memoryPrompt` feature from AMS -- the most powerful tool. It combines working memory context + long-term semantic search into a single hydrated prompt.

```typescript
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

    const result = await AgentMemory.getInstance().memoryPrompt(request);
    return JSON.stringify(result);
  },
});
```

### Tool 4: `listSessions`

Discover available working memory sessions.

```typescript
const listSessionsTool = new DynamicStructuredTool({
  name: "listSessions",
  description:
    "List all working memory sessions for the current user. Each session corresponds to a meeting transcript that was played back. Returns session IDs that can be used with other tools.",
  schema: z.object({
    limit: z.number().optional().default(20).describe("Max sessions to return"),
  }),
  func: async ({ limit }) => {
    const { namespace, userId } = getAppState();
    const result = await AgentMemory.getInstance().listSessions({
      namespace,
      userId,
      limit: limit ?? 20,
    });
    return JSON.stringify(result);
  },
});
```

### Tool 5: `getComputedSummaries`

Fetch the **computed summary text** (the "cooked dish") from one or all summary views. This is the AI-generated narrative produced by `runSummaryViewPartition` / `computeSummary`. Maps to `AgentMemory.listSummaryViewPartitions(viewId)`.

**Namespace scoping:** Views are filtered by `view.filters.namespace` to only return views belonging to the active dataset. Partitions inherit the view's scope (the view's `filters: { namespace, user_id }` already restricts which memories are summarized), so no additional namespace filter is needed when listing partitions.

```typescript
const getComputedSummariesTool = new DynamicStructuredTool({
  name: "getComputedSummaries",
  description:
    "Get AI-generated summary narratives that have already been computed from summary views. Returns the actual generated text. Use listSummaryViews first to discover available views, then call this with a specific viewId or viewName to fetch the computed summaries.",
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
    const memory = AgentMemory.getInstance();
    const allViews = await memory.listSummaryViews();
    const ownViews = allViews.filter((v) => v.filters?.namespace === namespace);

    const targetViews = viewName
      ? ownViews.filter((v) => v.name === viewName)
      : ownViews;

    const summaries = [];
    for (const view of targetViews) {
      const partitions = await memory.listSummaryViewPartitions(view.id, {
        namespace,
        userId,
      });
      summaries.push({ viewName: view.name, viewId: view.id, partitions });
    }

    return JSON.stringify(summaries);
  },
});
```

### Tool 6: `getWorkingMemoryState`

Get the current working memory state for an active session.

```typescript
const getWorkingMemoryStateTool = new DynamicStructuredTool({
  name: "getWorkingMemoryState",
  description:
    "Get the current working memory state for a session, including message count, token usage, and auto-generated context summary. Use when the user asks about what happened in a specific session or about context window state.",
  schema: z.object({
    sessionId: z.string().describe("The session ID"),
  }),
  func: async ({ sessionId }) => {
    const { namespace, userId } = getAppState();
    const result = await AgentMemory.getInstance().getWorkingMemory(sessionId, {
      namespace,
      userId,
    });
    return JSON.stringify({
      sessionId: result.sessionId,
      messageCount: result.messages.length,
      tokens: result.tokens,
      context: result.context,
      contextPercentageTotalUsed: result.contextPercentageTotalUsed,
      memoriesAttached: result.memories.length,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    });
  },
});
```

### Tool 7: `listSummaryViews`

Discover available summary view definitions. Useful for checking what views exist before fetching computed summaries, or when the user asks "what summary views are there?".

**Namespace scoping:** Views are filtered by `view.filters.namespace` to only return views belonging to the active dataset. The AMS `listSummaryViews()` API is server-global, so client-side filtering is required.

```typescript
const listSummaryViewsTool = new DynamicStructuredTool({
  name: "listSummaryViews",
  description:
    "List all available summary view definitions. Each view is a recipe for how to summarize long-term memories (e.g., grouped by user, by session, by topic). Use this to discover what views exist before fetching computed summaries with getComputedSummaries, or before getting a single view's full definition with getSummaryView. Also useful when the user asks what kinds of summaries are available.",
  schema: z.object({}),
  func: async () => {
    const { namespace } = getAppState();
    const allViews = await AgentMemory.getInstance().listSummaryViews();
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
```

### Tool 8: `getSummaryView`

Get a single summary view's **full definition** by ID. Returns the view's configuration (source, groupBy, filters, prompt, etc.) -- the "recipe" for how the summary is built. Useful when the agent knows a `viewId` from `listSummaryViews` and needs to inspect its details.

Maps to `AgentMemory.getSummaryView(viewId)`.

```typescript
const getSummaryViewTool = new DynamicStructuredTool({
  name: "getSummaryView",
  description:
    "Get a single summary view definition by ID. Returns the full configuration: name, source, groupBy fields, filters, timeWindowDays, continuous flag, prompt template, and model. Use this after listSummaryViews to inspect a specific view's settings, or when the user asks how a particular summary is configured.",
  schema: z.object({
    viewId: z.string().describe("The summary view ID"),
  }),
  func: async ({ viewId }) => {
    const view = await AgentMemory.getInstance().getSummaryView(viewId);

    if (!view) {
      return JSON.stringify({
        error: `No summary view found with ID: ${viewId}`,
      });
    }

    return JSON.stringify({
      viewId: view.id,
      name: view.name,
      source: view.source,
      groupBy: view.groupBy,
      filters: view.filters,
      timeWindowDays: view.timeWindowDays,
      continuous: view.continuous,
      prompt: view.prompt,
      modelName: view.modelName,
    });
  },
});
```

### Tool Factory Pattern

All tools are created by a factory function that captures `getAppState` and `ENV` in closure:

```typescript
const createMemoryTools = (): StructuredTool[] => [
  searchMemoriesTool,
  searchMemoriesBySessionTool,
  getMemoryContextTool,
  listSessionsTool,
  getComputedSummariesTool,
  getWorkingMemoryStateTool,
  listSummaryViewsTool,
  getSummaryViewTool,
];

export { createMemoryTools };
```

---

## Session vs All-Data Routing: How the Agent Decides Scope

The user does **not** need to explicitly say "search this session" or "search all data." The LLM agent decides automatically based on three inputs: (1) the user's question phrasing, (2) the active session context passed from the frontend, and (3) the system prompt routing rules. The agent always states the scope in its response so the user knows where the answer came from.

### Three Inputs That Drive Routing

**1. Frontend context (automatic):** The frontend passes the active `sessionId` (if any) via CopilotKit's `useCopilotReadable`. CopilotKit delivers these to the LangGraph graph via `state.copilotkit.context` (NOT as system messages in `state.messages`). The `invokeReactNode` function extracts them and injects them as `SystemMessage` instances so the LLM can read the active session ID. If no session is active, the value is `"none"`.

**2. User question phrasing (natural language):** The LLM interprets intent:

| Question Pattern                    | Agent Interpretation                    | Tool Used                                    |
| ----------------------------------- | --------------------------------------- | -------------------------------------------- |
| "What happened in this meeting?"    | Session-scoped (uses active sessionId)  | `searchMemoriesBySession`                    |
| "What happened in the Feb 26 call?" | Session-scoped (finds matching session) | `listSessions` -> `searchMemoriesBySession`  |
| "What do we know about James?"      | All data (cross-session)                | `searchMemories`                             |
| "Tell me about retirement planning" | All data (semantic search)              | `searchMemories`                             |
| "Summarize this client"             | All data (narrative summary)            | `getComputedSummaries`                       |
| "What summary views are available?" | Discovery (list view definitions)       | `listSummaryViews`                           |
| "How is the client summary built?"  | View configuration (inspect recipe)     | `listSummaryViews` -> `getSummaryView`       |
| "Is there a session recap summary?" | Discovery + fetch                       | `listSummaryViews` -> `getComputedSummaries` |
| "What was discussed so far?"        | Session-scoped if active, else all      | `getMemoryContext` or `searchMemories`       |

**3. System prompt routing rules:** Explicit instructions in the system prompt tell the agent when to scope to a session vs search all data, and to always mention the scope in the response.

### Response Transparency

The agent **always states the search scope** in its response. This is enforced by the system prompt:

- **Session-scoped answer:** "Based on the **Feb 26 Google Meet session** (8 memories extracted): ..."
- **All-data answer:** "Across **all stored memories** (3 sessions, 24 memories): ..."
- **Combined answer:** "From the **current session's** working memory and **all long-term memories**: ..."

This way the user always knows whether the answer reflects one meeting or the full history.

### Fallback Behavior

- If the user says "this meeting" but **no session is active**, the agent responds: "No active session. Searching across all stored memories instead..." and uses `searchMemories`.
- If the user asks a vague question and a session is active, the agent prefers `getMemoryContext` (which combines both working memory + long-term search) to give the richest answer possible.

---

## System Prompt (`agent/system-prompt.ts`)

The system prompt gives the agent context about what it is, what data it has access to, and how to use its tools effectively. It includes the session routing rules above.

**Active session context:** The system prompt does NOT receive the active session ID as a parameter. Instead, the frontend passes `sessionId`, `userId`, and `namespace` via CopilotKit's `useCopilotReadable` hooks. CopilotKit delivers these to the LangGraph graph via `state.copilotkit.context`. The `invokeReactNode` function extracts them and injects them as `SystemMessage` instances before the conversation messages. The system prompt tells the LLM to read the active session ID from these injected messages.

```typescript
const buildSystemPrompt = (config: DatasetConfig): string => {
  const participants = buildParticipantsList(config);
  const userName = config.participants.rm?.name ?? config.userId;

  return `You are a Memory Assistant for the "${config.name}" demo. You help users explore and understand the memories stored in Redis Agent Memory Server.

## Context
- Dataset: ${config.name} (${config.description})
- User: ${config.userId} (${userName})
- Namespace: ${config.namespace}
- Participants: ${participants}

## Active Session Context (from Frontend)
The frontend passes context into your conversation via CopilotKit readables. These appear as system messages in your conversation BEFORE the user's question:
- "Active session ID for the current meeting playback: <sessionId or 'none'>"
- "User ID for memory scoping: <userId>"
- "Namespace for memory scoping: <namespace>"

Read the active session ID from these messages. If the value is "none", there is no active session.

## Your Capabilities
You have access to all memories stored for this user across all meeting sessions:
- **Long-term memories**: Durable facts, preferences, events extracted from meeting transcripts
- **Working memory**: Live session context including transcript messages and auto-generated summaries
- **Computed summaries**: AI-generated narrative summaries that condense memories
- **Summary view definitions**: Recipes that define how summaries are built (source, groupBy, prompt)

## Session vs All-Data Routing
Decide the search scope based on the user's question and the active session context above:
1. If the user says "this meeting", "this session", "this call", or "current session" AND an active session ID exists:
   -> Use \`searchMemoriesBySession\` or \`getMemoryContext\` with the active session ID.
2. If the user asks about a specific date or meeting (e.g., "the Feb 26 call"):
   -> Use \`listSessions\` to find the matching session, then \`searchMemoriesBySession\`.
3. If the user asks a broad question ("what do we know about...", "tell me about...", "summarize the client"):
   -> Use \`searchMemories\` (all data) or \`getComputedSummaries\`.
4. If the user asks about summaries or what summary views are available:
   -> Use \`listSummaryViews\` first, then \`getComputedSummaries\` for a specific view.
5. If the user asks how a summary is configured or built:
   -> Use \`listSummaryViews\` then \`getSummaryView\` to inspect the definition.
6. If the active session ID is "none" and the user says "this meeting", say so and fall back to searching all data.
7. When unsure, prefer \`getMemoryContext\` with the active session (if available) + long-term search enabled.

## Response Rules
- **Always state the search scope** in your response. Examples:
  - "Based on the **Feb 26 Google Meet session** (8 memories): ..."
  - "Across **all stored memories** (3 sessions, 24 total memories): ..."
  - "From the **current session's working memory** and **all long-term memories**: ..."
- Be concise and informative
- Cite specific memories when answering (include topic tags and entities when relevant)
- If no memories match the query, say so clearly
- Format responses with clear structure (bullet points, sections) for complex answers`;
};
```

---

## LangGraph Agent (`agent/graph.ts`)

A ReAct agent pattern: the LLM decides which tools to call based on the user's question, calls them, reads the results, and formulates a response.

**Separate-process initialization:** The LangGraph dev server runs `graph.ts` in its own Node.js process. It cannot share the `AgentMemory` singleton or `appState` from the main backend. So `graph.ts` must:

1. Call `AgentMemory.create()` with the same config (reads from `.env`)
2. Load the dataset config from disk (same `DatasetLoaderService`)
3. Build the system prompt from the loaded config

This initialization runs inside a `createCompiledGraph` factory that executes at module load time.

```typescript
import type { BaseMessage } from "@langchain/core/messages";
import type { DatasetConfig } from "../types";

import {
  MessagesAnnotation,
  StateGraph,
  START,
  END,
  Annotation,
} from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage } from "@langchain/core/messages";
import { AgentMemory } from "cau-redis-agent-memory";

import { createMemoryTools } from "./tools";
import { buildSystemPrompt } from "./system-prompt";
import { DatasetLoaderService } from "../services/dataset-loader.service";
import { ENV } from "../config";
import { setAppState } from "../app-state";

type CopilotKitReadable = { description: string; value: string };

type CopilotKitState = {
  context?: CopilotKitReadable[];
  actions?: unknown[];
};

const StateAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  copilotkit: Annotation<CopilotKitState>({
    reducer: (_, next) => next,
    default: () => ({}),
  }),
});

const ensureInitialized = (datasetConfig: DatasetConfig): void => {
  try {
    AgentMemory.getInstance();
  } catch {
    AgentMemory.create({
      baseUrl: ENV.AGENT_MEMORY_BASE_URL,
      defaultNamespace: datasetConfig.namespace,
      defaultModelName: ENV.MODEL_NAME,
    });
    setAppState({
      datasetConfig,
      namespace: datasetConfig.namespace,
      userId: datasetConfig.userId,
    });
  }
};

// CopilotKit passes useCopilotReadable values via state.copilotkit.context (NOT
// as system messages in state.messages). We extract them here and inject them as
// SystemMessages so the LLM sees:
//
//   [
//     SystemMessage (buildSystemPrompt -- routing rules, capabilities),
//     SystemMessage ("Active session ID for the current meeting playback: playback-2026-02-26-google-meet-..."),
//     SystemMessage ("User ID for memory scoping: sarah-chen"),
//     SystemMessage ("Namespace for memory scoping: wealth-advisor"),
//     HumanMessage  ("What happened in this meeting?"),
//   ]
const buildReadableMessages = (
  copilotkit: CopilotKitState,
): SystemMessage[] => {
  const readables = copilotkit?.context ?? [];
  return readables.map(
    (r) => new SystemMessage(`${r.description}: ${r.value}`),
  );
};

const invokeReactNode = async (
  state: typeof StateAnnotation.State,
  reactAgent: ReturnType<typeof createReactAgent>,
  datasetConfig: DatasetConfig,
): Promise<{ messages: BaseMessage[] }> => {
  const systemPrompt = buildSystemPrompt(datasetConfig);
  const readableMessages = buildReadableMessages(state.copilotkit);

  const messagesWithSystemPrompt = [
    new SystemMessage(systemPrompt),
    ...readableMessages,
    ...state.messages,
  ];

  const result = await reactAgent.invoke({
    messages: messagesWithSystemPrompt,
  });

  return { messages: result.messages };
};

const createCompiledGraph = () => {
  const datasetConfig = DatasetLoaderService.loadDatasetConfig(
    ENV.ACTIVE_DATASET,
  );

  ensureInitialized(datasetConfig);

  const llm = new ChatOpenAI({
    model: ENV.CHATBOT_MODEL,
    temperature: 0,
    apiKey: ENV.OPENAI_API_KEY,
  });

  const tools = createMemoryTools();
  const reactAgent = createReactAgent({ llm, tools });

  const graph = new StateGraph(StateAnnotation)
    .addNode("reactNode", (state) =>
      invokeReactNode(state, reactAgent, datasetConfig),
    )
    .addEdge(START, "reactNode")
    .addEdge("reactNode", END);

  return graph.compile();
};

const compiledGraph = createCompiledGraph();

export { compiledGraph };
```

**Note on `createReactAgent`:** LangGraph's prebuilt `createReactAgent` handles the full ReAct loop internally (LLM call -> tool calls -> LLM call with results -> repeat until done). We wrap it as a single node in our graph for simplicity. The graph can be extended later (e.g., add a memory-writing node, a summarization node, etc.).

**Note on session context:** The LLM does NOT need to call a tool to get the active session. CopilotKit's `useCopilotReadable` (called in the frontend `page.tsx`) delivers `sessionId`, `userId`, and `namespace` via `state.copilotkit.context`. The `buildReadableMessages` helper extracts them and converts them to `SystemMessage` instances, which are prepended to the conversation. The system prompt instructs the LLM to read the active session ID from these messages. No `extractSessionIdFromMessages` helper or `getActiveContext` tool is needed -- the LLM reads the values directly from its conversation context.

---

## CopilotKit Wiring (`agent/copilotkit-langgraph.ts`)

Connects CopilotKit's server runtime to the LangGraph dev server.

```typescript
import type { Request, Response } from "express";

import {
  CopilotRuntime,
  ExperimentalEmptyAdapter,
  copilotRuntimeNodeHttpEndpoint,
} from "@copilotkit/runtime";
import { LangGraphAgent } from "@copilotkit/runtime/langgraph";

import { ENV } from "../config";
import { COPILOTKIT_ENDPOINT } from "../constants";

const serviceAdapter = new ExperimentalEmptyAdapter();

const langGraphAgentConfig = {
  deploymentUrl: ENV.LANGGRAPH_DEPLOYMENT_URL,
  graphId: "memoryAgent",
  langsmithApiKey: ENV.LANGSMITH_API_KEY,
};

const runtime = new CopilotRuntime({
  agents: {
    default: new LangGraphAgent(langGraphAgentConfig),
  },
});

const handleCopilotKitLanggraph = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const handler = copilotRuntimeNodeHttpEndpoint({
    endpoint: COPILOTKIT_ENDPOINT,
    runtime,
    serviceAdapter,
  });
  return handler(req, res);
};

export { handleCopilotKitLanggraph };
```

---

## Express Mounting (`index.ts` Changes)

The CopilotKit endpoint is mounted on the Express app **after** `ApiServer.create()` but **before** `server.start()`. We use the `expressApp` getter exposed by `cau-api-server`.

This works because `cau-api-server` registers routes + the 404 catch-all in `start()` (inside `mountRouterAndErrorHandlers`), **not** in `create()`. The `create()` method only sets up security middleware (helmet, CORS, rate-limit), request-ID middleware, and the health endpoint. So middleware added via `expressApp.use()` between `create()` and `start()` is registered **before** the API routes and 404 catch-all.

**Middleware ordering after startup:**

```
1. Security (helmet, CORS, compression, rate-limit, body parser) -- from create()
2. Request-ID middleware -- from create()
3. GET /health -- from create()
4. /copilotkit handler -- from expressApp.use() between create() and start()  <-- NEW
5. POST /api/* routes -- from start() -> mountRouterAndErrorHandlers()
6. 404 catch-all -- from start() -> mountRouterAndErrorHandlers()
7. Error handler -- from start() -> mountRouterAndErrorHandlers()
```

```typescript
// In index.ts -- after ApiServer.create(), before server.start()

import { handleCopilotKitLanggraph } from "./agent/copilotkit-langgraph";
import { COPILOTKIT_ENDPOINT } from "./constants";

const server = ApiServer.create({ ... });

// Mount CopilotKit endpoint (raw Express middleware, not a cau-api-server route)
server.expressApp.use(COPILOTKIT_ENDPOINT, async (req, res, next) => {
  // CopilotKit's Hono-based handler expects the full path in req.url.
  // Express strips the mount path, so we restore it.
  req.url = COPILOTKIT_ENDPOINT + (req.url === "/" ? "" : req.url);

  try {
    await handleCopilotKitLanggraph(req, res);
  } catch (err) {
    next(err);
  }
});

server.start();
```

**Why raw Express middleware instead of a `cau-api-server` route:** CopilotKit's `copilotRuntimeNodeHttpEndpoint` returns a Hono-based handler that manages its own streaming protocol, request parsing, and response format. It does not fit the `RouteHandler` signature (`(input, { logger, requestId }) => data`). Mounting as Express middleware gives CopilotKit full control over the request lifecycle. No changes to `cau-api-server` are needed.

---

## Constants Changes (`constants.ts`)

```typescript
// NEW
const COPILOTKIT_ENDPOINT = "/copilotkit";
const DEFAULT_LANGGRAPH_DEPLOYMENT_URL = "http://127.0.0.1:2024";
const DEFAULT_CHATBOT_MODEL = "gpt-4o-mini";
```

---

## Package Dependencies Changes (`package.json`)

```json
{
  "dependencies": {
    "cau-api-server": "*",
    "cau-logger": "*",
    "cau-redis-agent-memory": "*",
    "@copilotkit/runtime": "latest",
    "@langchain/langgraph": "latest",
    "@langchain/core": "latest",
    "@langchain/openai": "latest",
    "zod": "latest"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "typescript": "^5.9.3",
    "@langchain/langgraph-cli": "latest"
  },
  "overrides": {
    "@ag-ui/client": "0.0.43"
  }
}
```

**Note on `overrides`:** CopilotKit has a known issue with duplicate `@ag-ui/client` versions. The override pins a single version. Check if still needed at install time.

---

## Environment File Changes (`.env`)

```env
# Existing
MEETING_MEMORY_PORT=3001
AGENT_MEMORY_BASE_URL=http://localhost:8000
MEETING_MEMORY_ACTIVE_DATASET=wealth-advisor
MEETING_MEMORY_DATA_DIR=../data
MEETING_MEMORY_ALLOWED_ORIGINS=http://localhost:3000
MEETING_MEMORY_MODEL_NAME=gpt-4o-mini
OPENAI_API_KEY=<required>

# NEW: Chatbot / LangGraph
LANGGRAPH_DEPLOYMENT_URL=http://127.0.0.1:2024
MEETING_MEMORY_CHATBOT_MODEL=gpt-4o-mini
LANGSMITH_API_KEY=<optional-for-tracing>
LANGSMITH_TRACING=false
```

---

## Package Scripts Changes (`package.json`)

```json
{
  "scripts": {
    "dev": "npx tsx --watch src/index.ts",
    "dev:langgraph": "npx @langchain/langgraph-cli dev",
    "start": "npx tsx src/index.ts"
  }
}
```

---

## Running the Chatbot

Two processes are needed (two terminals):

```bash
# Terminal 1: LangGraph dev server (graph + tools)
npm run dev:langgraph

# Terminal 2: Main backend server (existing REST API + CopilotKit endpoint)
npm run dev:api
```

The LangGraph dev server runs the graph at `http://127.0.0.1:2024`. The main backend connects to it via `CopilotRuntime` + `LangGraphAgent`. The frontend talks only to the main backend (port 3001).

**Note:** The LangGraph dev server is a development tool (fine for demos). It runs the compiled graph, exposes it via the LangGraph protocol with streaming support, and auto-reloads on file changes. For production, options include LangGraph Cloud or bundling the graph directly into the main process.

---

## Data Flow: User Asks a Question

```
Frontend (CopilotSidebar)          Backend (port 3001)         LangGraph (port 2024)     AgentMemory (port 8000)
  │                                   │                            │                          │
  │ CopilotKit message               │                            │                          │
  │ "What are James Morrison's       │                            │                          │
  │  investment preferences?"         │                            │                          │
  │──────────────────────────────────>│                            │                          │
  │   POST /copilotkit                │                            │                          │
  │                                   │ Forward to LangGraph       │                          │
  │                                   │───────────────────────────>│                          │
  │                                   │                            │                          │
  │                                   │                            │ 1. LLM decides: call     │
  │                                   │                            │    searchMemories tool   │
  │                                   │                            │    query: "investment    │
  │                                   │                            │    preferences"          │
  │                                   │                            │                          │
  │                                   │                            │ 2. Tool executes:        │
  │                                   │                            │    AgentMemory            │
  │                                   │                            │    .searchLongTermMemory()│
  │                                   │                            │───────────────────────────>
  │                                   │                            │    { memories: [...] }    │
  │                                   │                            │<──────────────────────────│
  │                                   │                            │                          │
  │                                   │                            │ 3. LLM reads results,    │
  │                                   │                            │    formulates answer     │
  │                                   │                            │                          │
  │                                   │ Stream response            │                          │
  │                                   │<───────────────────────────│                          │
  │ Streamed chat response            │                            │                          │
  │ "Based on the stored memories,   │                            │                          │
  │  James prefers bond funds over   │                            │                          │
  │  individual bond laddering..."    │                            │                          │
  │<──────────────────────────────────│                            │                          │
```

---

## Example Conversations

These examples show the agent's routing decisions and how it always states the search scope in responses.

### Q: "What do we know about James Morrison?"

**Routing decision:** Broad question, no session reference -> search all data.

```
Agent thought: Broad question about a person. Use searchMemories across all data.
Tool call: searchMemories({ query: "James Morrison", limit: 15 })
Result: 8 memories found (semantic + episodic)

Response: "Across **all stored memories** (8 memories from 2 sessions):

- **Profile**: VP of Operations at Meridian Technologies, moderate-risk HNW client
- **Financial goals**: Targeting $3M by retirement in 2031
- **Preferences**: Prefers bond funds over individual bond laddering for simplicity
- **Family**: Daughter Emily starts college in 2027 (~$200K needed); wife Maya considering early retirement 2027
- **Recent actions**: Rebalanced $150K from REITs into bonds and dividend ETFs (Feb 2026)
- **Risk tolerance**: Emotionally conservative during market downturns"
```

### Q: "What happened in this meeting?" (session active)

**Routing decision:** "this meeting" + active session -> session-scoped search.

```
Agent thought: User said "this meeting" and active session is playback-2026-02-26-google-meet-...
Tool call: searchMemoriesBySession({ sessionId: "playback-2026-02-26-google-meet-1773247345966" })
Result: 8 memories from this session

Response: "From the **Feb 26 Google Meet session** (8 memories extracted):

- Discussed REIT rebalancing -- moved $150K into bonds and dividend ETFs
- Maya's potential early retirement in 2027 was mentioned
- Emily's college fund planning for 2027 was discussed
- Sarah recommended shifting to more conservative allocation"
```

### Q: "What happened in the last meeting?" (no session active)

**Routing decision:** Refers to a meeting but no active session -> discover sessions, then scope.

```
Agent thought: No active session. Need to find sessions first, then search the latest.
Tool call: listSessions({ limit: 5 })
Result: ["playback-2026-02-26-google-meet-1773247345966", "playback-2026-01-15-phone-1773100000000"]

Agent thought: Most recent is the Feb 26 session. Search it.
Tool call: searchMemoriesBySession({ sessionId: "playback-2026-02-26-google-meet-1773247345966" })
Result: 8 memories

Response: "From the **most recent session** (Feb 26 Google Meet, 8 memories):
- Discussed REIT rebalancing -- moved $150K into bonds and dividend ETFs
- Maya's potential early retirement in 2027 was raised
- Emily's college fund planning for 2027 was discussed"
```

### Q: "Give me a complete summary of this client"

**Routing decision:** "complete summary" -> all data, use computed summary view.

```
Agent thought: User wants a complete overview. Use the Client Memory Summary view.
Tool call: getComputedSummaries({ viewName: "Client Memory Summary" })
Result: Computed summary narrative

Response: "Here is the **complete client summary** (AI-generated from all long-term memories across all sessions):

James Morrison is a moderate-risk high-net-worth client targeting $3M by retirement in 2031.
He favors dividend income and is emotionally conservative during market downturns. His daughter
Emily starts college in 2027 (~$200K needed). Wife Maya may retire early 2027, requiring income
planning revision. Recently rebalanced $150K from REITs into bonds and ETFs.

*Condensed from 8 long-term memories across 2 sessions.*"
```

### Q: "What's in the working memory right now?" (session active)

**Routing decision:** Technical question about session state -> use `getWorkingMemoryState`.

```
Agent thought: User asking about working memory state. Active session exists.
Tool call: getWorkingMemoryState({ sessionId: "playback-2026-02-26-google-meet-1773247345966" })
Result: { messageCount: 56, tokens: 4250, context: "Summary of conversation...", ... }

Response: "The **current session's working memory** contains:
- 56 messages (full transcript)
- 4,250 tokens used (32% of context window)
- Auto-generated context summary: 'Sarah and James discussed REIT rebalancing, moving $150K into bonds...'"
```

---

## Implementation Priority (Build Order)

| Phase | What                                                                                         | Why                                                     |
| ----- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 1     | Add dependencies (`package.json`) + env vars (`config.ts`, `constants.ts`, `.env`)           | Foundation                                              |
| 2     | `agent/tools.ts` -- all 8 LangChain tools wrapping AgentMemory                               | Core: tools are the chatbot's memory access             |
| 3     | `agent/system-prompt.ts` -- system prompt builder with session routing logic                 | Agent personality, routing rules, response transparency |
| 4     | `agent/graph.ts` -- ReAct agent graph + separate-process AgentMemory init + `langgraph.json` | The LangGraph graph that uses the tools                 |
| 5     | `agent/copilotkit-langgraph.ts` -- CopilotRuntime + LangGraphAgent                           | CopilotKit server-side wiring                           |
| 6     | `index.ts` -- mount `/copilotkit` on Express (between `create()` and `start()`)              | Connect CopilotKit to the main server                   |
| 7     | Test end-to-end: `npm run dev:langgraph` + `npm run dev` + CopilotKit frontend               | Integration verification                                |

---

## Resolved Decisions

These were open questions during planning. All resolved.

**[Q1] `cau-api-server` middleware ordering:** Resolved -- no changes to `cau-api-server` needed. The package registers routes + 404 in `start()` (via `mountRouterAndErrorHandlers`), not `create()`. Middleware added via `server.expressApp.use()` between `create()` and `start()` is registered before routes and the 404 catch-all. This is a documented pattern in the [cau-api-server README](../packages/cau-api-server/README.md).

**[Q2] LangGraph dev server:** Dev server is fine for the demo. Added `"dev:langgraph"` script to `package.json`. Two terminals needed: one for LangGraph, one for the main backend.

**[Q3] Session context passing:** The frontend passes the active `sessionId`, `userId`, and `namespace` via CopilotKit's `useCopilotReadable` hooks. CopilotKit delivers these to the LangGraph graph via `state.copilotkit.context` (not as system messages directly). The `buildReadableMessages` helper in `graph.ts` extracts them and injects them as `SystemMessage` instances before the conversation messages -- no `getActiveContext` tool or `extractSessionIdFromMessages` helper needed. The agent also has `listSessions` to discover sessions dynamically. The system prompt tells the LLM how to find and use the session context from the CopilotKit readables. See "Session vs All-Data Routing" section above.

**[Q4] Model choice:** OpenAI (GPT-4o-mini), reuses the existing `OPENAI_API_KEY`. Configurable via `MEETING_MEMORY_CHATBOT_MODEL` env var.

**[Q5] `@ag-ui/client` override:** The CopilotKit demo reference had this issue. The `overrides` field is included in `package.json` as a precaution. Verify at install time whether it's still needed with the latest `@copilotkit/runtime` version -- if `npm install` succeeds without peer dep warnings, the override can be removed.

**[Q6] `AgentMemory` singleton across processes:** Resolved. The LangGraph dev server is a separate Node.js process. `graph.ts` handles this with an `ensureInitialized()` function that calls `AgentMemory.create()` if the singleton doesn't exist yet. Both processes connect to the same AMS at `http://localhost:8000`. The dataset config is loaded from disk via `DatasetLoaderService` (same as the main backend). See `graph.ts` section above.

**[Q7] Frontend plan:** Created as a separate doc: [dev-frontend-chatbot-plan.md](./dev-frontend-chatbot-plan.md). Covers CopilotKit provider setup, chatbot UI placement (CopilotSidebar -- right edge overlay, recommended), `useCopilotReadable` for session context, Redis dark theme CSS overrides, and visual design. The backend plan is self-contained; the frontend plan is self-contained.

---

## Notes

- The chatbot is **purely additive** -- zero changes to existing routes, handlers, or services. All existing demo functionality (transcript playback, memory exploration, summary views) works exactly as before.
- **Session routing is automatic.** The LLM agent decides whether to search the current session or all data based on the user's question phrasing, the active session context from the frontend, and system prompt rules. The response always states the scope so the user knows the source. See "Session vs All-Data Routing" section for full details.
- The `memoryPrompt` feature from AMS is the chatbot's most powerful tool. It sends a query to AMS, which retrieves working memory context + relevant long-term memories and returns a hydrated messages array. This means the LLM gets rich context without multiple round trips.
- All memory tools respect the dataset's `namespace` and `userId` via `getAppState()` -- no cross-dataset data leakage. Summary view tools (`listSummaryViews`, `getComputedSummaries`) apply client-side namespace filtering on the view list (`view.filters.namespace`). Partitions inherit the view's scope, so no additional filter is needed. The AMS summary view CRUD is server-global, which is why view-level scoping is essential.
- The system prompt is built dynamically from `datasetConfig` and includes the active `sessionId` when provided by the frontend. Switching datasets (`ACTIVE_DATASET` env var) automatically updates the chatbot's context.
- **Two processes required:** The LangGraph dev server (`npm run dev:langgraph`) and the main backend (`npm run dev`). Both read from the same `.env` and connect to the same AMS.
- **Separate-process init:** The LangGraph dev server runs `graph.ts` in its own Node.js process. It initializes its own `AgentMemory` singleton and loads the dataset config from disk. Both processes connect to the same AMS instance.
- LangSmith tracing is optional but recommended for debugging tool calls and LLM reasoning during development.
- The same `OPENAI_API_KEY` is reused for both AMS operations (extraction, summaries) and the chatbot LLM. No additional API keys needed.
- The backend follows the same code style as the monorepo: arrow functions, consolidated exports, separate type imports, kebab-case files, no emojis.

---

---

---

---

# Meeting Memory Demo -- Frontend Chatbot Plan (V2)

## Goal

Add a **chatbot UI** to the Meeting Memory demo frontend, powered by CopilotKit. The chatbot lets the user ask natural-language questions about all stored memories. The backend (LangGraph agent with memory tools) is defined in [dev-backend-chatbot-plan.md](./dev-backend-chatbot-plan.md).

This plan covers **frontend-only changes** to the existing Next.js app defined in [dev-frontend-plan.md](./dev-frontend-plan.md).

---

## UI Placement: Three Options

The existing layout is a 55/45 split (TranscriptPanel left, MemoryExplorerPanel right) on a dark `--midnight` background. The chatbot needs a home. Three options:

### Option A: CopilotSidebar (Right Edge Overlay) -- Recommended

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  DemoPage                                                                         │
│                                                                                   │
│  ┌────────────────────────────┐  ┌──────────────────────────┐  ┌──────────────┐  │
│  │  TranscriptPanel           │  │  MemoryExplorerPanel      │  │  CopilotKit  │  │
│  │  55%                       │  │  45%                      │  │  Sidebar     │  │
│  │                            │  │                           │  │  ~350px      │  │
│  │  (unchanged)               │  │  (unchanged)              │  │  (overlay)   │  │
│  │                            │  │                           │  │              │  │
│  │                            │  │  Working Memory           │  │  [Chat UI]   │  │
│  │  [Toolbar]                 │  │  Long-Term Memory         │  │  Ask about   │  │
│  │  [Transcript Feed]         │  │  Summary Views            │  │  memories... │  │
│  │  [Playback Controls]       │  │  Redis Metrics            │  │              │  │
│  │                            │  │                           │  │  [Messages]  │  │
│  │                            │  │                           │  │  [Input]     │  │
│  └────────────────────────────┘  └──────────────────────────┘  └──────────────┘  │
│                                                                                   │
│  [Toggle Chat Button -- bottom-right FAB when sidebar is closed]                 │
└──────────────────────────────────────────────────────────────────────────────────┘
```

**How it works:** CopilotKit's `CopilotSidebar` component wraps the page content. It renders a slide-in panel from the right edge (~350px wide). When open, it overlays the right portion of MemoryExplorerPanel. When closed, the existing 55/45 layout is completely untouched.

**Pros:**

- Zero layout changes to the existing two panels
- Standard CopilotKit pattern -- well-tested, built-in open/close toggle
- Dedicated chat space with full message history and input
- Can be toggled by the presenter during the demo ("Now let me ask the AI...")
- The overlay means the existing panels don't get compressed

**Cons:**

- When open, partially covers MemoryExplorerPanel (acceptable -- user can close it to see full explorer)
- Requires CSS overrides to match the Redis dark theme

### Option B: Chat Tab in MemoryExplorerPanel

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ┌──────────────────────────┐  ┌────────────────────────────────────────────┐│
│  │  TranscriptPanel (55%)   │  │  MemoryExplorerPanel (45%)                 ││
│  │                          │  │                                            ││
│  │                          │  │  [Working Memory] [LT Memory] [Summary]   ││
│  │                          │  │  [Redis Metrics] [Chat]  <-- NEW TAB      ││
│  │                          │  │                                            ││
│  │                          │  │  (tab content: chat messages + input)      ││
│  └──────────────────────────┘  └────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────────┘
```

**Pros:** Integrates seamlessly into existing layout. No overlays. No layout changes.

**Cons:** Competes with other tabs for attention. Chat history is lost when switching tabs (unless we keep state). Smaller chat area. Doesn't feel like a dedicated "conversation" -- more like a search box. CopilotKit's built-in `CopilotSidebar`/`CopilotChat` components can't be easily embedded as a tab -- we'd need `CopilotChat` (headless) with custom rendering.

### Option C: Three-Panel Layout

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ┌──────────────────┐  ┌──────────────────────┐  ┌────────────────────────┐ │
│  │  TranscriptPanel  │  │  MemoryExplorerPanel  │  │  ChatPanel             │ │
│  │  40%              │  │  35%                  │  │  25%                   │ │
│  │                   │  │                       │  │                        │ │
│  └──────────────────┘  └──────────────────────┘  └────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Pros:** All three views visible simultaneously. No overlays.

**Cons:** Compresses existing panels significantly. Requires layout restructuring. May look crowded. Existing panels were designed for 55% and 45% -- squeezing them hurts readability.

### Decision: **Option A (CopilotSidebar)**

Best for a demo: the chatbot is a "reveal" moment. The presenter shows the transcript playback and memory exploration first, then opens the sidebar with "Now let me ask the AI about these memories..." The overlay is a feature, not a bug -- it focuses attention on the chat conversation.

## ok go with Option A

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Next.js App (App Router)                                                     │
│                                                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │  layout.tsx                                                            │   │
│  │  ┌─ CopilotKit Provider (runtimeUrl) ─────────────────────────────┐   │   │
│  │  │                                                                 │   │   │
│  │  │  ┌──────────────────────────────────────────────────────────┐   │   │   │
│  │  │  │  DemoPage (page.tsx)                                     │   │   │   │
│  │  │  │                                                          │   │   │   │
│  │  │  │  useCopilotReadable (sessionId, userId, namespace)       │   │   │   │
│  │  │  │                                                          │   │   │   │
│  │  │  │  ┌─ CopilotSidebar ──────────────────────────────────┐  │   │   │   │
│  │  │  │  │                                                    │  │   │   │   │
│  │  │  │  │  ┌──────────────────┐  ┌────────────────────────┐ │  │   │   │   │
│  │  │  │  │  │ TranscriptPanel  │  │ MemoryExplorerPanel     │ │  │   │   │   │
│  │  │  │  │  │ (unchanged)      │  │ (unchanged)             │ │  │   │   │   │
│  │  │  │  │  └──────────────────┘  └────────────────────────┘ │  │   │   │   │
│  │  │  │  │                                                    │  │   │   │   │
│  │  │  │  └────────────────────────────────────────────────────┘  │   │   │   │
│  │  │  └──────────────────────────────────────────────────────────┘   │   │   │
│  │  └─────────────────────────────────────────────────────────────────┘   │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                               │
│  CopilotKit talks to: POST /copilotkit (backend, port 3001)                  │
│  Existing API calls:  POST /api/* (backend, port 3001, unchanged)            │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Key points:**

- `CopilotKit` provider wraps the entire app in `layout.tsx` -- it provides the runtime connection to the backend's `/copilotkit` endpoint
- `CopilotSidebar` wraps the existing `<main>` content in `page.tsx` -- it renders the sidebar panel alongside the existing two-panel layout
- `useCopilotReadable` is called in `DemoPage` to pass `sessionId`, `userId`, and `namespace` as context to the backend agent (the agent uses these for session routing)
- TranscriptPanel and MemoryExplorerPanel are **completely unchanged** -- zero modifications to existing business components
- The sidebar's labels and instructions come from `dataset.config.json` (config-driven, like everything else)

---

## Project Structure (Changes Only)

```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx                            # MODIFIED: wrap with CopilotKit provider
│   │   ├── page.tsx                              # MODIFIED: wrap content with CopilotSidebar,
│   │   │                                         #   add useCopilotReadable, add chatbot config
│   │   ├── page.css                              # MODIFIED: minor adjustments for sidebar
│   │   └── globals.css                           # MODIFIED: add CopilotKit theme overrides
│   │
│   ├── components/
│   │   ├── core/                                 # UNCHANGED
│   │   └── business/
│   │       ├── transcript-panel/                 # UNCHANGED
│   │       └── memory-explorer-panel/            # UNCHANGED
│   │
│   ├── hooks/
│   │   └── use-dataset-config.ts                 # UNCHANGED
│   │
│   ├── constants/
│   │   └── app.constants.ts                      # MODIFIED: add COPILOTKIT_RUNTIME_URL, chatbot constants
│   │
│   ├── styles/
│   │   ├── variables.css                         # UNCHANGED
│   │   └── copilotkit-theme.css                  # NEW: CopilotKit CSS overrides for Redis dark theme
│   │
│   ├── services/
│   │   └── api.service.ts                        # UNCHANGED
│   │
│   └── types/
│       ├── dataset-config.types.ts               # MODIFIED: add chatbot config fields
│       └── ...                                   # UNCHANGED
│
├── package.json                                  # MODIFIED: add CopilotKit deps
└── ...
```

**What's NOT changed:** Both business components (`transcript-panel/`, `memory-explorer-panel/`), all core components, all hooks, all services, all existing types. The chatbot is purely additive.

---

## Prerequisites (Additional)

| Dependency               | Version | Purpose                                     |
| ------------------------ | ------- | ------------------------------------------- |
| `@copilotkit/react-core` | latest  | CopilotKit React provider + hooks           |
| `@copilotkit/react-ui`   | latest  | CopilotSidebar, built-in chat UI components |

---

## Package Dependencies Changes (`package.json`)

```json
{
  "dependencies": {
    "next": "^15.3.0",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "@mui/material": "^6.6.0",
    "@mui/icons-material": "^6.6.0",
    "@emotion/react": "^11.14.0",
    "@emotion/styled": "^11.14.0",
    "@copilotkit/react-core": "latest",
    "@copilotkit/react-ui": "latest"
  }
}
```

---

## Constants Changes (`app.constants.ts`)

```typescript
// NEW
const COPILOTKIT_RUNTIME_URL =
  process.env.NEXT_PUBLIC_COPILOTKIT_RUNTIME_URL ??
  "http://localhost:3001/copilotkit";
```

---

## Dataset Config Changes (`dataset.config.json`)

Add a `chatbot` section to the dataset config. All chatbot labels and instructions come from here (config-driven, like everything else in the demo).

```json
{
  "chatbot": {
    "title": "Memory Assistant",
    "initialMessage": "Ask me anything about the stored memories for this client. I can search across all meetings or focus on a specific session.",
    "placeholder": "Ask about memories...",
    "instructions": "You are a Memory Assistant that helps explore memories stored in Redis Agent Memory Server for this wealth advisor demo."
  }
}
```

These values are read from `datasetConfig.chatbot` and passed to `CopilotSidebar` as labels and instructions.

**Type change** in `dataset-config.types.ts`:

```typescript
type ChatbotConfig = {
  title: string;
  initialMessage: string;
  placeholder: string;
  instructions: string;
};

type DatasetConfig = {
  // ... existing fields unchanged ...
  chatbot: ChatbotConfig;
};
```

---

## Implementation Details

### 1. CopilotKit Provider (`layout.tsx`)

The `CopilotKit` provider wraps the entire app. It connects to the backend's `/copilotkit` endpoint.

```typescript
"use client";

import "./globals.css";
import type { ReactNode } from "react";
import { CopilotKit } from "@copilotkit/react-core";
import { Space_Grotesk, Space_Mono } from "next/font/google";

import { COPILOTKIT_RUNTIME_URL } from "../constants/app.constants";

// ... existing font setup ...

const RootLayout = ({ children }: { children: ReactNode }) => (
  <html lang="en" className={`${spaceGrotesk.variable} ${spaceMono.variable}`}>
    <body>
      <CopilotKit runtimeUrl={COPILOTKIT_RUNTIME_URL} showDevConsole={false}>
        {children}
      </CopilotKit>
    </body>
  </html>
);

export default RootLayout;
```

**Note on `"use client"`:** The layout already needs to be a client component because of `CopilotKit`. This is consistent with the existing app design (all components are client components, no SSR).

### 2. CopilotSidebar + Context Passing (`page.tsx`)

The DemoPage wraps its content with `CopilotSidebar` and uses `useCopilotReadable` to pass context to the backend agent.

```typescript
"use client";

import type { ComponentProps } from "react";
import { CopilotSidebar } from "@copilotkit/react-ui";
import { useCopilotReadable } from "@copilotkit/react-core";
import "@copilotkit/react-ui/styles.css";

import "./page.css";
import "../styles/copilotkit-theme.css";
import { useDatasetConfig } from "../hooks/use-dataset-config";
import { TranscriptPanel } from "../components/business/transcript-panel";
import { MemoryExplorerPanel } from "../components/business/memory-explorer-panel";

const DemoPage = () => {
  const { config, isLoading, error } = useDatasetConfig();
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Pass context to the backend chatbot agent via CopilotKit
  useCopilotReadable({
    description: "Active session ID for the current meeting playback",
    value: sessionId ?? "none",
  });

  useCopilotReadable({
    description: "User ID for memory scoping",
    value: config?.userId ?? "",
  });

  useCopilotReadable({
    description: "Namespace for memory scoping",
    value: config?.namespace ?? "",
  });

  // ... existing loading/error handling ...

  const sidebarProps: ComponentProps<typeof CopilotSidebar> = {
    defaultOpen: false,
    instructions: config?.chatbot?.instructions ?? "",
    labels: {
      title: config?.chatbot?.title ?? "Memory Assistant",
      initial: config?.chatbot?.initialMessage ?? "Ask about memories...",
      placeholder: config?.chatbot?.placeholder ?? "Ask about memories...",
    },
  };

  return (
    <CopilotSidebar {...sidebarProps}>
      <main className="demo-page">
        <TranscriptPanel
          datasetConfig={config!}
          onSessionCreated={setSessionId}
          onReset={handleReset}
        />
        <MemoryExplorerPanel
          userId={config!.userId}
          namespace={config!.namespace}
          sessionId={sessionId}
          datasetConfig={config!}
        />
      </main>
    </CopilotSidebar>
  );
};

export default DemoPage;
```

**Key details:**

- `CopilotSidebar` wraps the `<main>` element. The sidebar renders as an overlay on the right.
- `defaultOpen: false` -- the sidebar starts closed. The presenter opens it when ready to demo the chatbot.
- Three `useCopilotReadable` calls pass `sessionId`, `userId`, and `namespace` to the backend agent. The agent uses `sessionId` for session routing (see "Session vs All-Data Routing" in the backend plan).
- The `labels` object controls the sidebar's title, initial message, and placeholder text -- all from `dataset.config.json`.
- `instructions` is the system-level instruction sent to CopilotKit (the backend agent's system prompt also includes routing rules, so this is supplementary).

### 3. `useCopilotReadable` -- Session Context Passing

This is how the frontend tells the backend agent about the currently active session. The agent uses this to decide whether to search the current session or all data.

```typescript
// When no session is active:
useCopilotReadable({
  description: "Active session ID for the current meeting playback",
  value: "none",
});

// When a session is playing or completed:
useCopilotReadable({
  description: "Active session ID for the current meeting playback",
  value: "playback-2026-02-26-google-meet-1773247345966",
});
```

CopilotKit delivers these readables to the LangGraph graph via `state.copilotkit.context` (NOT as system messages in `state.messages`). The backend's `buildReadableMessages` helper in `graph.ts` extracts them and converts them to `SystemMessage` instances, so the LLM sees:

```
SystemMessage ("Active session ID for the current meeting playback: playback-2026-02-26-google-meet-...")
SystemMessage ("User ID for memory scoping: sarah-chen")
SystemMessage ("Namespace for memory scoping: wealth-advisor")
HumanMessage  ("What happened in this meeting?")
```

The backend system prompt tells the LLM to read the active session ID from these injected messages and use it for session-scoped tool calls. No `getActiveContext` tool or backend-side message parsing is needed -- the LLM reads the values directly from its conversation context.

The value updates reactively -- when `sessionId` changes (play starts, session loaded, reset), the agent's context updates automatically on the next message.

### 4. CopilotKit Theme Overrides (`styles/copilotkit-theme.css`)

CopilotKit ships with a default light theme. We override it to match the Redis dark theme using CSS custom properties. CopilotKit's components read from `--copilot-kit-*` CSS variables.

```css
:root {
  /* CopilotKit theme overrides for Redis dark theme */
  --copilot-kit-background-color: var(--dusk-09);
  --copilot-kit-secondary-color: var(--dusk);
  --copilot-kit-separator-color: var(--border);
  --copilot-kit-primary-color: var(--hyper-07);
  --copilot-kit-contrast-color: var(--base-white);
  --copilot-kit-secondary-contrast-color: var(--fg-body);
  --copilot-kit-response-button-background-color: var(--dusk-90);
  --copilot-kit-response-button-color: var(--fg-default);
  --copilot-kit-muted-color: var(--fg-muted);
}

.copilotKitSidebar {
  font-family: var(--primary-font);

  & .copilotKitHeader {
    background: var(--dusk-09);
    border-bottom: 1px solid var(--border);
    color: var(--fg-default);
    font-weight: var(--font-weight-medium);
  }

  & .copilotKitMessages {
    background: var(--bg-default);
  }

  & .copilotKitMessage {
    font-size: var(--font-size-rg);
    line-height: 1.6;
  }

  & .copilotKitUserMessage {
    background: var(--dusk-90);
    color: var(--fg-default);
    border-radius: var(--border-radius);
  }

  & .copilotKitAssistantMessage {
    background: var(--dusk);
    color: var(--fg-body);
    border-radius: var(--border-radius);
  }

  & .copilotKitInput {
    background: var(--dusk-09);
    border-top: 1px solid var(--border);

    & textarea {
      background: var(--dusk);
      color: var(--fg-default);
      border: 1px solid var(--border);
      border-radius: var(--border-radius);
      font-family: var(--primary-font);
      font-size: var(--font-size-rg);

      &::placeholder {
        color: var(--fg-muted);
      }
    }
  }

  & .copilotKitButton {
    background: var(--btn-primary-bg);
    border: 1px solid var(--btn-primary-border);
    color: var(--btn-primary-text);

    &:hover {
      background: var(--btn-primary-hover-bg);
    }
  }
}
```

**Note:** CopilotKit's exact class names may vary by version. The pattern above uses the documented CSS custom properties (`--copilot-kit-*`) as the primary theming mechanism, with class-based overrides as fallback. Check the installed version's CSS at implementation time and adjust selectors as needed. The key goal: dark background (`--dusk-09`), light text (`--fg-default`), Redis Red accent (`--hyper-07`), Space Grotesk font.

---

## Data Flow: User Opens Chatbot and Asks a Question

```
User                    DemoPage              CopilotSidebar          Backend (/copilotkit)
  │                        │                       │                        │
  │ (demo page loaded,     │                       │                        │
  │  transcript played,    │                       │                        │
  │  memories visible)     │                       │                        │
  │                        │                       │                        │
  │ clicks sidebar toggle  │                       │                        │
  │───────────────────────>│                       │                        │
  │                        │  sidebar opens        │                        │
  │                        │  (defaultOpen: false   │                        │
  │                        │   -> now open)         │                        │
  │                        │                       │                        │
  │                        │  useCopilotReadable    │                        │
  │                        │  (sessionId, userId,   │                        │
  │                        │   namespace already    │                        │
  │                        │   set from playback)   │                        │
  │                        │                       │                        │
  │ types: "What happened  │                       │                        │
  │  in this meeting?"     │                       │                        │
  │───────────────────────────────────────────────>│                        │
  │                        │                       │ POST /copilotkit       │
  │                        │                       │ (includes message +    │
  │                        │                       │  CopilotKit readables) │
  │                        │                       │───────────────────────>│
  │                        │                       │                        │
  │                        │                       │  streamed response     │
  │                        │                       │<───────────────────────│
  │                        │                       │                        │
  │  sees streaming reply  │                       │                        │
  │  "From the Feb 26      │                       │                        │
  │   Google Meet session  │                       │                        │
  │   (8 memories): ..."   │                       │                        │
  │<───────────────────────────────────────────────│                        │
```

---

## Demo Presenter Flow

1. **Run the demo as usual** -- select transcript, play, watch memories appear in MemoryExplorerPanel
2. **Open the chatbot** -- click the sidebar toggle (bottom-right area). The sidebar slides in from the right.
3. **Ask a question** -- "What do we know about James Morrison?" or "What happened in this meeting?"
4. **Watch the streamed response** -- the agent searches memories and streams back a formatted answer with scope stated ("From all stored memories..." or "From the Feb 26 session...")
5. **Ask follow-up questions** -- the chat maintains conversation context
6. **Close sidebar** -- click toggle again to return to full MemoryExplorerPanel view
7. **Reset** -- "Clear All Memories & Restart" also clears the chat (sidebar closes, context resets)

---

## Layout Adjustments (`page.css`)

Minimal changes. The existing 55/45 split is untouched. The sidebar overlays on top.

```css
.demo-page {
  /* existing layout unchanged */
  display: flex;
  gap: var(--panel-gap);
  height: 100vh;
  padding: var(--space-3xs);
}

/* When CopilotKit sidebar is open, the main content area is still full width.
   The sidebar overlays from the right. No width adjustments needed. */
```

CopilotKit's `CopilotSidebar` manages its own positioning (fixed/absolute from the right edge). The `<main>` content does not need to shrink -- the sidebar overlays on top.

---

## Reset Behavior

When the user clicks "Clear All Memories & Restart":

1. TranscriptPanel calls `POST /api/resetLifecycle` and emits `onReset()`
2. DemoPage clears `sessionId` -> `useCopilotReadable` updates to `"none"`
3. MemoryExplorerPanel reacts to `sessionId=null`, clears internal state
4. The CopilotSidebar **stays open** but the conversation history remains (CopilotKit manages its own message state). The next question the user asks will have updated context (`sessionId: "none"`).

If a full chat reset is desired on demo reset, we can call CopilotKit's `useCopilotChat().reset()` hook in the `handleReset` callback. This clears the conversation history in the sidebar.

---

## Implementation Priority (Build Order)

| Phase | What                                                                         | Why                          |
| ----- | ---------------------------------------------------------------------------- | ---------------------------- |
| 1     | Add `@copilotkit/react-core` and `@copilotkit/react-ui` to `package.json`    | Dependencies                 |
| 2     | Add `chatbot` section to `dataset.config.json` + update `DatasetConfig` type | Config-driven labels         |
| 3     | Add `COPILOTKIT_RUNTIME_URL` to `app.constants.ts`                           | Runtime URL constant         |
| 4     | Wrap app with `CopilotKit` provider in `layout.tsx`                          | CopilotKit foundation        |
| 5     | Add `CopilotSidebar` + `useCopilotReadable` in `page.tsx`                    | Chatbot UI + context passing |
| 6     | Create `copilotkit-theme.css` with Redis dark theme overrides                | Visual consistency           |
| 7     | Import `copilotkit-theme.css` in `page.tsx` or `globals.css`                 | Apply theme                  |
| 8     | Test end-to-end with backend (main server + LangGraph server running)        | Integration                  |
| 9     | Polish: adjust sidebar width, font sizes, animations, responsive overlay     | Demo readiness               |

---

## Environment Variables

| Variable                             | Default                            | Description                     |
| ------------------------------------ | ---------------------------------- | ------------------------------- |
| `NEXT_PUBLIC_COPILOTKIT_RUNTIME_URL` | `http://localhost:3001/copilotkit` | Backend CopilotKit endpoint URL |

This is baked into the static bundle at build time (Next.js static export).

---

## Notes

- **Zero changes to existing business components.** TranscriptPanel and MemoryExplorerPanel are untouched. The chatbot is purely additive -- `CopilotKit` provider in layout, `CopilotSidebar` wrapper + `useCopilotReadable` hooks in page.
- **Config-driven labels.** The sidebar title, initial message, and placeholder text come from `dataset.config.json` (`chatbot` section). Switching datasets automatically updates the chatbot's display text.
- **Session context is reactive.** `useCopilotReadable` updates whenever `sessionId` changes. If the user plays a transcript (session created), the agent immediately knows the active session. If the user resets, the agent knows there's no active session. No manual sync needed.
- **CopilotKit manages its own message state.** The sidebar's conversation history is internal to CopilotKit. DemoPage does not need to manage chat messages. The only bridge is `useCopilotReadable` for context passing.
- **CSS theming follows existing conventions.** CopilotKit overrides are in a dedicated `copilotkit-theme.css` file using CSS custom properties from `variables.css`. No inline styles, no Tailwind. Consistent with the project's CSS rules (one file per concern, CSS variables for all values).
- **Static export compatible.** CopilotKit works client-side only. The `CopilotKit` provider connects to the backend URL at runtime via fetch. No server components or API routes needed.
- **The sidebar starts closed (`defaultOpen: false`).** The presenter reveals the chatbot at the right moment during the demo. This keeps the initial view focused on the transcript + memory exploration experience.
- The frontend follows the same code style as the rest of the app: arrow functions, consolidated exports, separate type imports, kebab-case files, PascalCase components, no emojis.
