# Chatbot Agent

## Overview

The chatbot is a LangGraph ReAct agent that enables users to query stored memories conversationally via a CopilotKit sidebar. It runs as a separate LangGraph server process and is connected to the main backend via a CopilotKit proxy.

## Architecture

```
Frontend (CopilotSidebar)
  │
  │ WebSocket / HTTP (CopilotKit protocol)
  ▼
Backend (/copilotkit endpoint)
  │
  │ copilotRuntimeNodeHttpEndpoint → LangGraphAgent
  ▼
LangGraph Server (port 2024)
  │
  │ StateGraph → reactNode (createReactAgent)
  ▼
ChatOpenAI (gpt-4o-mini)
  │
  │ Tool calls
  ▼
cau-ram (RedisAgentMemory singleton)
  → Cloud RAM API
```

## Two-Process Communication

The chatbot runs in a **separate LangGraph process** (port 2024). The main backend proxies:

1. **Backend side** (`copilotkit-langgraph.ts`): Creates a `CopilotRuntime` with a `LangGraphAgent` pointing to the LangGraph deployment URL. The `/copilotkit` Express route forwards all requests.
2. **LangGraph side** (`graph.ts`): Defines and compiles the state graph. Since it's a separate process, it independently initializes `RedisAgentMemory` and `AppState` on first invocation.

## Graph Structure (`graph.ts`)

```
START → reactNode → END
```

Single-node graph where `reactNode` wraps a prebuilt `createReactAgent`:

1. Loads dataset config, initializes RAM (if not already done)
2. Creates `ChatOpenAI` LLM instance (temperature: 0)
3. Builds tools via `createMemoryTools()`
4. On each invocation:
   - Builds system prompt from dataset config
   - Extracts CopilotKit readables from state (session ID, user ID)
   - Prepends system + readable messages to conversation
   - Invokes the ReAct agent
   - Returns only new messages (slices off input)

### State Annotation

```typescript
const StateAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  copilotkit: Annotation<CopilotKitState>({
    reducer: (_, next) => next,
    default: () => ({}),
  }),
});
```

The `copilotkit` field carries CopilotKit context (readables, actions) injected by the frontend.

## CopilotKit Integration

### Frontend Side

```typescript
useCopilotReadable({ description: "Active session ID for the current meeting playback", value: sessionId ?? "none" });
useCopilotReadable({ description: "User ID for memory scoping", value: config?.userId ?? "" });
```

These values flow through the CopilotKit protocol into `state.copilotkit.context`.

### Backend Proxy (`copilotkit-langgraph.ts`)

```typescript
const runtime = new CopilotRuntime({
  agents: {
    default: new LangGraphAgent({
      deploymentUrl: ENV.LANGGRAPH_DEPLOYMENT_URL,
      graphId: "memoryAgent",
      langsmithApiKey: ENV.LANGSMITH_API_KEY,
    }),
  },
});
```

Uses `ExperimentalEmptyAdapter` (LLM calls happen in LangGraph, not in the runtime).

## System Prompt (`system-prompt.ts`)

Dynamically built from `DatasetConfig`. Key sections:

1. **Context**: Dataset name, user ID, participants list
2. **Active Session Context**: Explains how CopilotKit readables appear as system messages
3. **Capabilities**: Lists what the agent can access (LTMs, session memory)
4. **Session vs All-Data Routing**: Decision tree for which tool to use:
   - Overview of current session → `getMemoryContext`
   - Specific search within session → `searchMemoriesBySession`
   - Cross-session question → `searchMemories`
   - Find a specific meeting → `listSessions` → then use other tools
5. **Response Rules**: Formatting guidelines (cite scope, be concise, use structure)

## Tools (`tools.ts`)

Five tools available to the ReAct agent:

### `searchMemories`
- **Purpose**: Semantic search across all LTMs
- **When**: Broad cross-session questions about facts/preferences/events
- **Params**: `query` (required), `memoryType?`, `topics?`, `limit?` (default: 50)
- **Scoping**: Always filters by `ownerId: userId`

### `searchMemoriesBySession`
- **Purpose**: Search LTMs linked to a specific session
- **When**: Questions about a particular meeting
- **Params**: `sessionId` (required), `query?`
- **Scoping**: Filters by `sessionId`

### `getMemoryContext`
- **Purpose**: Full hydrated memory prompt (session + LTM combined)
- **When**: Primary tool for session-scoped questions, overview questions
- **Params**: `query` (required), `sessionId?`, `includeAllLongTermMemories?` (default: true)
- **Calls**: `ram.buildMemoryPrompt()` internally

### `listSessions`
- **Purpose**: Lists all available session IDs
- **When**: User references a specific meeting by date/name
- **Params**: `limit?` (default: 100)

### `getSessionState`
- **Purpose**: Get session metadata (event count, owner)
- **When**: User asks about session details
- **Params**: `sessionId` (required)

## LangGraph Registration (`langgraph.json`)

```json
{
  "graphs": {
    "memoryAgent": "./src/chatbot-agent/graph.ts:compiledGraph"
  }
}
```

The LangGraph CLI dev server picks up this graph and serves it at `http://localhost:2024`.

## Docker Deployment

```yaml
demo-langgraph:
  command: npx @langchain/langgraph-cli@1.1.17 dev --port 2024 --host 0.0.0.0
  environment:
    - OPENAI_API_KEY
    - RAM_ENDPOINT
    - RAM_API_KEY
    - RAM_STORE_ID
    - MEETING_MEMORY_CHATBOT_MODEL
    - LANGSMITH_API_KEY
    - MEETING_MEMORY_ACTIVE_DATASET
```

The CLI version is pinned to `1.1.17` to avoid breaking changes in newer versions.

## Message Flow (End-to-End)

1. User types in CopilotKit sidebar
2. CopilotKit sends message + readables to backend `/copilotkit`
3. Backend forwards to LangGraph server
4. LangGraph builds state with `copilotkit` context + messages
5. System prompt + readable messages prepended
6. ReAct agent reasons and calls tools (e.g., `searchMemories`)
7. Tools query cloud RAM via `cau-ram`
8. Agent formulates response
9. Response streams back through CopilotKit to sidebar

## Configuration Dependencies

| Variable | Used For |
|----------|----------|
| `OPENAI_API_KEY` | ChatOpenAI LLM in ReAct agent |
| `MEETING_MEMORY_CHATBOT_MODEL` | Chatbot agent + LangCache query normalizer model (default: `gpt-4o-mini`) |
| `RAM_ENDPOINT` / `RAM_API_KEY` / `RAM_STORE_ID` | Cloud RAM access (tools) |
| `LANGGRAPH_DEPLOYMENT_URL` | Backend proxy target (default: `http://localhost:2024`) |
| `LANGSMITH_API_KEY` | Optional tracing for debugging |
| `MEETING_MEMORY_ACTIVE_DATASET` | Which dataset config to load |
