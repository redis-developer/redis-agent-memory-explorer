# cau-redis-agent-memory

Typed singleton wrapper for the Redis Agent Memory Server REST API (working memory, long-term memory, summary views, memory prompt, lifecycle).

## Prerequisites

- **Redis Agent Memory Server** running at `http://localhost:8000`
- **Node.js** >= 18

### Start Redis and Agent Memory Server

```bash
# 1. Start Redis Stack (Redis + RediSearch)
docker run -d --name redis-stack -p 6379:6379 redis/redis-stack:latest

# 2. Clone and run the Agent Memory Server (Python)
git clone https://github.com/redis/agent-memory-server.git
cd agent-memory-server
uv sync

# 3. Create .env for development
cat > .env << EOF
DISABLE_AUTH=true
REDIS_URL=redis://localhost:6379
LONG_TERM_MEMORY=true
FAST_MODEL=gpt-4o-mini
OPENAI_API_KEY=key
EOF

# 4. Start the API server
uv run agent-memory api --task-backend=asyncio
```

The server runs at `http://localhost:8000`. Swagger docs: `http://localhost:8000/docs`.

## Install

From the monorepo root:

```bash
npm install
```

Or from the package directory:

```bash
cd packages/cau-redis-agent-memory
npm install
npm run build
```

## Quick Start

```typescript
import { AgentMemory } from "cau-redis-agent-memory";

const mem = AgentMemory.create({ baseUrl: "http://localhost:8000" });

const { memory } = await mem.getOrCreateWorkingMemory("session-1");
await mem.putWorkingMemory("session-1", {
  messages: [{ role: "user", content: "Hello" }],
});

const results = await mem.searchLongTermMemory({ text: "user preferences" });
await mem.close();
```

## Singleton Pattern

`AgentMemory` is a singleton. Use `create()` once, then `getInstance()` elsewhere.

```typescript
// Bootstrap (e.g. in app startup)
const mem = AgentMemory.create({ baseUrl: process.env.AGENT_MEMORY_BASE_URL });

// In request handlers or other modules
const mem = AgentMemory.getInstance();
// ... use mem

// Shutdown (e.g. on process exit)
await mem.close();
```

- `create(config?)`: Create and register the singleton. Use `config` or rely on env vars.
- `getInstance()`: Return the singleton. Throws if `create()` was never called.
- `close()`: Release the client and clear the singleton instance.

## Full API

### Health

| Method        | Signature                     | Description         | Return            |
| ------------- | ----------------------------- | ------------------- | ----------------- |
| `healthCheck` | `() => Promise<HealthResult>` | Check server health | `{ now: number }` |

### Working Memory

| Method                     | Signature                                                                                                            | Description                         | Return                                  |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | --------------------------------------- |
| `listSessions`             | `(options?: SessionListOptions) => Promise<SessionListResult>`                                                       | List sessions with optional filters | `{ sessions: string[]; total: number }` |
| `getWorkingMemory`         | `(sessionId: string, options?: WorkingMemoryOptions) => Promise<WorkingMemoryResult \| null>`                        | Get working memory for a session    | `WorkingMemoryResult` or `null`         |
| `putWorkingMemory`         | `(sessionId: string, payload: WorkingMemoryPayload, options?: WorkingMemoryOptions) => Promise<WorkingMemoryResult>` | Replace working memory (full PUT)   | `WorkingMemoryResult`                   |
| `getOrCreateWorkingMemory` | `(sessionId: string, options?: WorkingMemoryOptions) => Promise<{ created: boolean; memory: WorkingMemoryResult }>`  | Get or create empty working memory  | `{ created, memory }`                   |
| `deleteWorkingMemory`      | `(sessionId: string, options?: { namespace?: string }) => Promise<AckResult>`                                        | Delete working memory for a session | `{ status: string }`                    |

### Long-Term Memory

| Method                   | Signature                                                                                | Description                  | Return                            |
| ------------------------ | ---------------------------------------------------------------------------------------- | ---------------------------- | --------------------------------- |
| `createLongTermMemories` | `(memories: MemoryRecordInput[], options?: CreateMemoriesOptions) => Promise<AckResult>` | Create long-term memories    | `{ status: string }`              |
| `searchLongTermMemory`   | `(options: MemorySearchOptions) => Promise<MemorySearchResult>`                          | Semantic search with filters | `{ memories, total, nextOffset }` |
| `getLongTermMemory`      | `(memoryId: string) => Promise<MemoryRecordResult \| null>`                              | Get a single memory by ID    | `MemoryRecordResult` or `null`    |
| `editLongTermMemory`     | `(memoryId: string, updates: MemoryEditInput) => Promise<MemoryRecordResult>`            | Update a memory              | `MemoryRecordResult`              |
| `deleteLongTermMemories` | `(memoryIds: string[]) => Promise<AckResult>`                                            | Delete memories by ID        | `{ status: string }`              |

### Memory Prompt

| Method         | Signature                                                       | Description                                                             | Return                                   |
| -------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------- |
| `memoryPrompt` | `(request: MemoryPromptRequest) => Promise<MemoryPromptResult>` | Hydrate query with working memory context + relevant long-term memories | `{ messages: Array<{ role, content }> }` |

### Forget / Lifecycle

| Method                   | Signature                                                                  | Description                                 | Return                              |
| ------------------------ | -------------------------------------------------------------------------- | ------------------------------------------- | ----------------------------------- |
| `forgetLongTermMemories` | `(policy: ForgetPolicy, options?: ForgetOptions) => Promise<ForgetResult>` | Delete memories by age or inactivity policy | `{ deleted, scanned, deletedIds? }` |

### Summary Views

| Method                      | Signature                                                                               | Description                                    | Return                        |
| --------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------- | ----------------------------- |
| `createSummaryView`         | `(request: CreateSummaryViewInput) => Promise<SummaryViewResult>`                       | Create a summary view                          | `SummaryViewResult`           |
| `listSummaryViews`          | `() => Promise<SummaryViewResult[]>`                                                    | List all summary views                         | `SummaryViewResult[]`         |
| `getSummaryView`            | `(viewId: string) => Promise<SummaryViewResult \| null>`                                | Get a single view                              | `SummaryViewResult` or `null` |
| `deleteSummaryView`         | `(viewId: string) => Promise<AckResult>`                                                | Delete a summary view                          | `{ status: string }`          |
| `runSummaryViewPartition`   | `(viewId: string, group: Record<string, string>) => Promise<SummaryPartitionResult>`    | Sync: compute summary for one partition        | `SummaryPartitionResult`      |
| `listSummaryViewPartitions` | `(viewId: string, filters?: PartitionListFilters) => Promise<SummaryPartitionResult[]>` | List materialized partitions                   | `SummaryPartitionResult[]`    |
| `runSummaryView`            | `(viewId: string, options?: { force?: boolean }) => Promise<TaskResult>`                | Async: trigger full recompute (returns a Task) | `TaskResult`                  |

### Tasks

| Method    | Signature                                         | Description     | Return                 |
| --------- | ------------------------------------------------- | --------------- | ---------------------- |
| `getTask` | `(taskId: string) => Promise<TaskResult \| null>` | Get task status | `TaskResult` or `null` |

## Config Reference

### AgentMemoryConfig

| Field                     | Type     | Default                                  | Description                                    |
| ------------------------- | -------- | ---------------------------------------- | ---------------------------------------------- |
| `baseUrl`                 | `string` | `ENV.AGENT_MEMORY_BASE_URL`              | Server base URL (e.g. `http://localhost:8000`) |
| `timeout`                 | `number` | `ENV.AGENT_MEMORY_TIMEOUT_MS` or `30000` | Request timeout in ms                          |
| `apiKey`                  | `string` | `ENV.AGENT_MEMORY_API_KEY`               | Optional API key auth                          |
| `bearerToken`             | `string` | `ENV.AGENT_MEMORY_BEARER_TOKEN`          | Optional JWT bearer token                      |
| `defaultNamespace`        | `string` | `ENV.AGENT_MEMORY_DEFAULT_NAMESPACE`     | Default namespace for ops                      |
| `defaultModelName`        | `string` | `undefined`                              | Model name for context window sizing           |
| `defaultContextWindowMax` | `number` | `undefined`                              | Override context window size                   |

### Environment Variables

| Variable                         | Default                 | Description           |
| -------------------------------- | ----------------------- | --------------------- |
| `AGENT_MEMORY_BASE_URL`          | `http://localhost:8000` | Server base URL       |
| `AGENT_MEMORY_API_KEY`           | `""`                    | API key auth          |
| `AGENT_MEMORY_BEARER_TOKEN`      | `""`                    | JWT bearer token      |
| `AGENT_MEMORY_DEFAULT_NAMESPACE` | `""`                    | Default namespace     |
| `AGENT_MEMORY_TIMEOUT_MS`        | `30000`                 | Request timeout in ms |

## Search Filters

### TagFilter

For tag-like fields: `sessionId`, `namespace`, `userId`, `memoryType`, `topics`, `entities`.

```typescript
type TagFilter = {
  eq?: string; // exact match
  ne?: string; // not equal
  any?: string[]; // match any of (topics/entities)
  all?: string[]; // match all of (topics/entities)
  in?: string[]; // value in list
  notIn?: string[]; // value not in list
};
```

Example: `userId: { eq: "alice" }` or `topics: { any: ["food", "travel"] }`.

### DateFilter

For date fields: `createdAt`, `lastAccessed`, `eventDate`.

```typescript
type DateFilter = {
  gte?: Date | string; // greater than or equal
  lte?: Date | string; // less than or equal
  eq?: Date | string; // exact date
};
```

Example: `createdAt: { gte: "2024-01-01", lte: "2024-12-31" }`.

### MemorySearchOptions

```typescript
type MemorySearchOptions = {
  text?: string; // semantic search query
  sessionId?: TagFilter;
  namespace?: TagFilter;
  userId?: TagFilter;
  topics?: TagFilter;
  entities?: TagFilter;
  memoryType?: TagFilter;
  createdAt?: DateFilter;
  lastAccessed?: DateFilter;
  eventDate?: DateFilter;
  distanceThreshold?: number;
  limit?: number;
  offset?: number;
  recencyBoost?: boolean;
  optimizeQuery?: boolean;
};
```

Example:

```typescript
await mem.searchLongTermMemory({
  text: "user food preferences",
  userId: { eq: "alice" },
  memoryType: { eq: MemoryType.SEMANTIC },
  limit: 10,
  recencyBoost: true,
});
```

## Memory Types

Use the `MemoryType` constant:

| Constant              | Value        | Use case                      |
| --------------------- | ------------ | ----------------------------- |
| `MemoryType.SEMANTIC` | `"semantic"` | Facts, preferences, knowledge |
| `MemoryType.EPISODIC` | `"episodic"` | Events with dates             |
| `MemoryType.MESSAGE`  | `"message"`  | Conversation records          |

```typescript
import { MemoryType } from "cau-redis-agent-memory";

await mem.createLongTermMemories([
  { text: "User prefers morning meetings", memoryType: MemoryType.SEMANTIC },
]);
```

## Summary Views

Summary views aggregate memories into summaries grouped by fields like `user_id`, `topics`, `namespace`.

### CreateSummaryViewInput

| Field            | Type                      | Description                                                    |
| ---------------- | ------------------------- | -------------------------------------------------------------- |
| `name`           | `string?`                 | Human-readable name                                            |
| `source`         | `SummaryViewSource`       | `"long_term"` or `"working_memory"`                            |
| `groupBy`        | `string[]`                | Partition fields (e.g. `["user_id"]`, `["user_id", "topics"]`) |
| `filters`        | `Record<string, unknown>` | Static filters applied to every run                            |
| `timeWindowDays` | `number?`                 | Only include memories from last N days                         |
| `continuous`     | `boolean`                 | If true, background workers auto-refresh                       |
| `prompt`         | `string?`                 | Custom summarization instructions                              |
| `modelName`      | `string?`                 | Model override for summarization                               |

### Partition Operations

- **Sync**: `runSummaryViewPartition(viewId, group)` — compute summary for one partition (e.g. `{ user_id: "alice", topics: "travel" }`).
- **Async**: `runSummaryView(viewId)` — trigger full recompute; returns a `TaskResult` for polling via `getTask(taskId)`.
- **List**: `listSummaryViewPartitions(viewId, filters?)` — list materialized partition summaries.

```typescript
import { AgentMemory, SummaryViewSource } from "cau-redis-agent-memory";

const mem = AgentMemory.getInstance();
const view = await mem.createSummaryView({
  name: "User Topic Summaries",
  source: SummaryViewSource.LONG_TERM,
  groupBy: ["user_id", "topics"],
  filters: { memory_type: { eq: "semantic" } },
  timeWindowDays: 30,
});

const partition = await mem.runSummaryViewPartition(view.id, {
  user_id: "alice",
  topics: "travel",
});
```

## Test Setup

### 1. Start Redis and Agent Memory Server

```bash
docker run -d --name redis-stack -p 6379:6379 redis/redis-stack:latest
# Clone agent-memory-server, uv sync, create .env, then:
uv run agent-memory api --task-backend=asyncio
```

### 2. Configure test.env

Create or override `packages/cau-redis-agent-memory/test.env`:

```env
AGENT_MEMORY_BASE_URL=http://localhost:8000
AGENT_MEMORY_DEFAULT_NAMESPACE=test
```

### 3. Run Tests

```bash
cd packages/cau-redis-agent-memory
npm run build
npm test
```

Tests use real execution; no mocks. Each suite uses unique namespaces and session IDs to avoid collisions.
