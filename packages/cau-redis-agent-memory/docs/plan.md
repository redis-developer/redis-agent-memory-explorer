# cau-redis-agent-memory — Implementation Plan

## Goal

Wrap the Redis Agent Memory Server REST API (v0.12.7) as a `cau-*` utility package so any
application can use working memory, long-term memory, summary views, memory prompt, and lifecycle
management through a clean, typed, singleton interface.

## Server Endpoints

- **REST API**: `http://localhost:8000`
- **MCP (SSE)**: `http://localhost:9050/sse`
- **Swagger UI**: `http://localhost:8000/docs`

---

## SDK Decision

Use the official **TypeScript SDK** (`agent-memory-client` v0.3.1+) as the underlying library.

**Rationale**:

- Already handles HTTP calls, serialization, pagination, validation, and error mapping
- Provides type-safe filter classes (`UserId`, `Topics`, `CreatedAt`, etc.)
- Maintained by Redis Inc. (MIT license, minimal dependency — just `ulid`)
- Our class wraps the SDK (not replaces it) to add: our config pattern, logging hooks,
  opinionated defaults, and higher-level convenience methods

---

## Package Structure

```
packages/cau-redis-agent-memory/
  docs/
    concept/                    # concept notes (already written)
    plan.md                     # this file
  src/
    helpers/
      build-search-filters.util.ts       # convert our filter type → SDK filter classes
      build-search-filters.util.test.ts
    operations/
      working-memory.ts                  # working memory operations group
      working-memory.test.ts
      long-term-memory.ts                # long-term memory operations group
      long-term-memory.test.ts
      memory-prompt.ts                   # memory prompt (context hydration)
      memory-prompt.test.ts
      summary-view.ts                    # summary views + tasks
      summary-view.test.ts
      forget.ts                          # forget/lifecycle operations
      forget.test.ts
    constants.ts
    config.ts
    types.ts
    agent-memory.ts                      # public interface class (singleton)
    agent-memory.test.ts
    index.ts                             # barrel
  test.env
  vitest.setup.ts
  vitest.config.ts
  tsconfig.json
  package.json
  SKILL.md
  README.md
```

---

## Public Interface Class: `AgentMemory`

Pattern: **Singleton + factory** (shared stateful resource — holds SDK client instance).

```typescript
class AgentMemory {
  static #instance: AgentMemory | null = null;
  #client: MemoryAPIClient;   // from agent-memory-client SDK

  private constructor(client: MemoryAPIClient) { ... }
  static create(config?: AgentMemoryConfig): AgentMemory { ... }
  static getInstance(): AgentMemory { ... }
  close = async (): Promise<void> => { ... };

  // --- Working Memory ---
  listSessions:           (options?) => Promise<SessionListResult>
  getWorkingMemory:       (sessionId, options?) => Promise<WorkingMemoryResult>
  putWorkingMemory:       (sessionId, payload, options?) => Promise<WorkingMemoryResult>
  getOrCreateWorkingMemory: (sessionId, options?) => Promise<{ created: boolean; memory: WorkingMemoryResult }>
  deleteWorkingMemory:    (sessionId, options?) => Promise<AckResult>

  // --- Long-Term Memory ---
  createLongTermMemories: (memories, options?) => Promise<AckResult>
  searchLongTermMemory:   (query, options?) => Promise<MemorySearchResult>
  getLongTermMemory:      (memoryId) => Promise<MemoryRecordResult | null>
  editLongTermMemory:     (memoryId, updates) => Promise<MemoryRecordResult>
  deleteLongTermMemories: (memoryIds) => Promise<AckResult>

  // --- Memory Prompt ---
  memoryPrompt:           (request) => Promise<MemoryPromptResult>

  // --- Forget / Lifecycle ---
  forgetLongTermMemories: (policy, options?) => Promise<ForgetResult>

  // --- Summary Views ---
  createSummaryView:          (request) => Promise<SummaryViewResult>
  listSummaryViews:           () => Promise<SummaryViewResult[]>
  getSummaryView:             (viewId) => Promise<SummaryViewResult>
  deleteSummaryView:          (viewId) => Promise<AckResult>
  runSummaryViewPartition:    (viewId, group) => Promise<SummaryPartitionResult>
  listSummaryViewPartitions:  (viewId, filters?) => Promise<SummaryPartitionResult[]>
  runSummaryView:             (viewId, options?) => Promise<TaskResult>

  // --- Tasks ---
  getTask:                    (taskId) => Promise<TaskResult>

  // --- Health ---
  healthCheck:                () => Promise<HealthResult>
}
```

---

## REST API → Method Mapping

### Health

| REST Endpoint    | HTTP | SDK Method | Our Method      |
| ---------------- | ---- | ---------- | --------------- |
| `GET /v1/health` | GET  | (manual)   | `healthCheck()` |

### Working Memory

| REST Endpoint                            | HTTP   | SDK Method                   | Our Method                   |
| ---------------------------------------- | ------ | ---------------------------- | ---------------------------- |
| `GET /v1/working-memory/`                | GET    | `listSessions()`             | `listSessions()`             |
| `GET /v1/working-memory/{session_id}`    | GET    | `getWorkingMemory()`         | `getWorkingMemory()`         |
| `PUT /v1/working-memory/{session_id}`    | PUT    | `putWorkingMemory()`         | `putWorkingMemory()`         |
| (composite)                              | GET    | `getOrCreateWorkingMemory()` | `getOrCreateWorkingMemory()` |
| `DELETE /v1/working-memory/{session_id}` | DELETE | `deleteWorkingMemory()`      | `deleteWorkingMemory()`      |

### Long-Term Memory

| REST Endpoint                            | HTTP   | SDK Method                 | Our Method                 |
| ---------------------------------------- | ------ | -------------------------- | -------------------------- |
| `POST /v1/long-term-memory/`             | POST   | `createLongTermMemory()`   | `createLongTermMemories()` |
| `POST /v1/long-term-memory/search`       | POST   | `searchLongTermMemory()`   | `searchLongTermMemory()`   |
| `GET /v1/long-term-memory/{memory_id}`   | GET    | `getLongTermMemory()`      | `getLongTermMemory()`      |
| `PATCH /v1/long-term-memory/{memory_id}` | PATCH  | `editLongTermMemory()`     | `editLongTermMemory()`     |
| `DELETE /v1/long-term-memory`            | DELETE | `deleteLongTermMemories()` | `deleteLongTermMemories()` |

### Memory Prompt

| REST Endpoint            | HTTP | SDK Method       | Our Method       |
| ------------------------ | ---- | ---------------- | ---------------- |
| `POST /v1/memory/prompt` | POST | `memoryPrompt()` | `memoryPrompt()` |

### Forget

| REST Endpoint                      | HTTP | SDK Method                 | Our Method                 |
| ---------------------------------- | ---- | -------------------------- | -------------------------- |
| `POST /v1/long-term-memory/forget` | POST | `forgetLongTermMemories()` | `forgetLongTermMemories()` |

### Summary Views

| REST Endpoint                                     | HTTP   | SDK Method                    | Our Method                    |
| ------------------------------------------------- | ------ | ----------------------------- | ----------------------------- |
| `GET /v1/summary-views`                           | GET    | `listSummaryViews()`          | `listSummaryViews()`          |
| `POST /v1/summary-views`                          | POST   | `createSummaryView()`         | `createSummaryView()`         |
| `GET /v1/summary-views/{view_id}`                 | GET    | (manual)                      | `getSummaryView()`            |
| `DELETE /v1/summary-views/{view_id}`              | DELETE | `deleteSummaryView()`         | `deleteSummaryView()`         |
| `POST /v1/summary-views/{view_id}/partitions/run` | POST   | `runSummaryViewPartition()`   | `runSummaryViewPartition()`   |
| `GET /v1/summary-views/{view_id}/partitions`      | GET    | `listSummaryViewPartitions()` | `listSummaryViewPartitions()` |
| `POST /v1/summary-views/{view_id}/run`            | POST   | `runSummaryView()`            | `runSummaryView()`            |

### Tasks

| REST Endpoint             | HTTP | SDK Method  | Our Method  |
| ------------------------- | ---- | ----------- | ----------- |
| `GET /v1/tasks/{task_id}` | GET  | `getTask()` | `getTask()` |

---

## Types to Define in `types.ts`

We define our own types that don't leak SDK internals. Consumers use our types; internally
we map to/from SDK types.

### Config

```typescript
type AgentMemoryConfig = {
  baseUrl: string; // e.g. "http://localhost:8000"
  timeout?: number; // ms, default 30000
  apiKey?: string; // optional API key auth
  bearerToken?: string; // optional JWT auth
  defaultNamespace?: string; // default namespace for all ops
  defaultModelName?: string; // for context window sizing
  defaultContextWindowMax?: number; // override context window
};
```

### Working Memory

```typescript
type MemoryMessage = {
  role: string;
  content: string;
  id?: string;
  createdAt?: string;
};

type MemoryExtractionStrategy = {
  strategy: "discrete" | "summary" | "preferences" | "custom";
  config?: Record<string, unknown>;
};

type WorkingMemoryPayload = {
  messages?: MemoryMessage[];
  memories?: MemoryRecordInput[];
  data?: Record<string, unknown>;
  context?: string;
  userId?: string;
  namespace?: string;
  ttlSeconds?: number;
  longTermMemoryStrategy?: MemoryExtractionStrategy;
};

type WorkingMemoryResult = {
  sessionId: string;
  messages: MemoryMessage[];
  memories: MemoryRecordResult[];
  data: Record<string, unknown> | null;
  context: string | null;
  userId: string | null;
  namespace: string | null;
  tokens: number;
  ttlSeconds: number | null;
  lastAccessed: string;
  createdAt: string;
  updatedAt: string;
  contextPercentageTotalUsed: number | null;
  contextPercentageUntilSummarization: number | null;
};

type WorkingMemoryOptions = {
  userId?: string;
  namespace?: string;
  modelName?: string;
  contextWindowMax?: number;
  recentMessagesLimit?: number;
};

type SessionListResult = {
  sessions: string[];
  total: number;
};

type SessionListOptions = {
  limit?: number;
  offset?: number;
  namespace?: string;
  userId?: string;
};
```

### Long-Term Memory

```typescript
type MemoryType = "semantic" | "episodic" | "message";

type MemoryRecordInput = {
  text: string;
  memoryType?: MemoryType;
  topics?: string[];
  entities?: string[];
  userId?: string;
  sessionId?: string;
  namespace?: string;
  eventDate?: string;
  id?: string;
  pinned?: boolean;
};

type MemoryRecordResult = {
  id: string;
  text: string;
  memoryType: MemoryType;
  topics: string[] | null;
  entities: string[] | null;
  userId: string | null;
  sessionId: string | null;
  namespace: string | null;
  eventDate: string | null;
  createdAt: string;
  updatedAt: string;
  lastAccessed: string;
  persistedAt: string | null;
  pinned: boolean;
  accessCount: number;
  memoryHash: string | null;
  dist: number | null; // vector distance (search results only)
};

type MemoryEditInput = {
  text?: string;
  topics?: string[];
  entities?: string[];
  memoryType?: MemoryType;
  eventDate?: string;
  namespace?: string;
  userId?: string;
  sessionId?: string;
};

type CreateMemoriesOptions = {
  deduplicate?: boolean;
};
```

### Search

```typescript
type TagFilter = {
  eq?: string;
  ne?: string;
  any?: string[];
  all?: string[];
  in?: string[];
  notIn?: string[];
};

type NumericFilter = {
  gt?: number;
  lt?: number;
  gte?: number;
  lte?: number;
  eq?: number;
  between?: [number, number];
};

type DateFilter = {
  gte?: Date | string;
  lte?: Date | string;
  eq?: Date | string;
};

type MemorySearchOptions = {
  text?: string;
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

type MemorySearchResult = {
  memories: MemoryRecordResult[];
  total: number;
  nextOffset: number | null;
};
```

### Memory Prompt

```typescript
type MemoryPromptRequest = {
  query: string;
  session?: {
    sessionId: string;
    userId?: string;
    modelName?: string;
    contextWindowMax?: number;
  };
  longTermSearch?: MemorySearchOptions | boolean;
};

type MemoryPromptResult = {
  messages: Array<{ role: string; content: string }>;
};
```

### Forget

```typescript
type ForgetPolicy = {
  maxAgeDays?: number;
  maxInactiveDays?: number;
  budget?: number;
  memoryTypeAllowlist?: MemoryType[];
};

type ForgetOptions = {
  namespace?: string;
  userId?: string;
  sessionId?: string;
  limit?: number;
  dryRun?: boolean;
  pinnedIds?: string[];
};

type ForgetResult = {
  deleted: number;
  scanned: number;
  deletedIds?: string[];
};
```

### Summary Views

```typescript
type SummaryViewSource = "long_term" | "working_memory";

type CreateSummaryViewInput = {
  name?: string;
  source: SummaryViewSource;
  groupBy?: string[];
  filters?: Record<string, unknown>;
  timeWindowDays?: number;
  continuous?: boolean;
  prompt?: string;
  modelName?: string;
};

type SummaryViewResult = {
  id: string;
  name: string | null;
  source: SummaryViewSource;
  groupBy: string[];
  filters: Record<string, unknown>;
  timeWindowDays: number | null;
  continuous: boolean;
  prompt: string | null;
  modelName: string | null;
};

type SummaryPartitionResult = {
  viewId: string;
  group: Record<string, string>;
  summary: string;
  memoryCount: number;
  computedAt: string;
};

type PartitionListFilters = {
  userId?: string;
  namespace?: string;
  sessionId?: string;
  memoryType?: string;
};
```

### Tasks

```typescript
type TaskStatus = "pending" | "running" | "completed" | "failed";

type TaskResult = {
  id: string;
  type: string;
  status: TaskStatus;
  viewId: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
};
```

### Common

```typescript
type AckResult = {
  status: string;
};

type HealthResult = {
  now: number;
};
```

---

## Constants (`constants.ts`)

```typescript
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_SEARCH_LIMIT = 10;
const DEFAULT_SESSION_LIST_LIMIT = 100;
```

---

## Config (`config.ts`)

```typescript
ENV = {
  NODE_ENV,
  AGENT_MEMORY_BASE_URL, // default: http://localhost:8000
  AGENT_MEMORY_API_KEY, // optional
  AGENT_MEMORY_BEARER_TOKEN, // optional
  AGENT_MEMORY_DEFAULT_NAMESPACE, // optional
  AGENT_MEMORY_TIMEOUT_MS, // default: DEFAULT_TIMEOUT_MS constant.ts
};
```

---

## Operations Modules

Each operation module exports arrow functions that take the SDK `MemoryAPIClient` as the
first argument, plus typed parameters. The `AgentMemory` class delegates to these functions.

### `operations/working-memory.ts`

- `listSessionsOp(client, options?) → SessionListResult`
- `getWorkingMemoryOp(client, sessionId, options?) → WorkingMemoryResult`
- `putWorkingMemoryOp(client, sessionId, payload, options?) → WorkingMemoryResult`
- `getOrCreateWorkingMemoryOp(client, sessionId, options?) → { created, memory }`
- `deleteWorkingMemoryOp(client, sessionId, options?) → AckResult`

### `operations/long-term-memory.ts`

- `createLongTermMemoriesOp(client, memories, options?) → AckResult`
- `searchLongTermMemoryOp(client, options) → MemorySearchResult`
- `getLongTermMemoryOp(client, memoryId) → MemoryRecordResult | null`
- `editLongTermMemoryOp(client, memoryId, updates) → MemoryRecordResult`
- `deleteLongTermMemoriesOp(client, memoryIds) → AckResult`

### `operations/memory-prompt.ts`

- `memoryPromptOp(client, request) → MemoryPromptResult`

### `operations/forget.ts`

- `forgetLongTermMemoriesOp(client, policy, options?) → ForgetResult`

### `operations/summary-view.ts`

- `createSummaryViewOp(client, request) → SummaryViewResult`
- `listSummaryViewsOp(client) → SummaryViewResult[]`
- `getSummaryViewOp(client, viewId) → SummaryViewResult`
- `deleteSummaryViewOp(client, viewId) → AckResult`
- `runSummaryViewPartitionOp(client, viewId, group) → SummaryPartitionResult`
- `listSummaryViewPartitionsOp(client, viewId, filters?) → SummaryPartitionResult[]`
- `runSummaryViewOp(client, viewId, options?) → TaskResult`
- `getTaskOp(client, taskId) → TaskResult`

---

## Helpers

### `helpers/build-search-filters.util.ts`

Converts our `MemorySearchOptions` (plain objects with `eq`, `any`, `gte` etc.) into SDK
filter class instances (`new UserId({ eq: "alice" })`, `new Topics({ any: [...] })`, etc.).

This is the main mapping layer between our types and the SDK's filter system.

---

## Implementation Order

| Phase | What                                                    | Files                                 |
| ----- | ------------------------------------------------------- | ------------------------------------- |
| 1     | Scaffold: package.json, tsconfig, vitest, config, types | config files + types.ts               |
| 2     | Constants + helpers                                     | constants.ts, helpers/                |
| 3     | Working memory operations + tests                       | operations/working-memory.\*          |
| 4     | Long-term memory operations + tests                     | operations/long-term-memory.\*        |
| 5     | Memory prompt operations + tests                        | operations/memory-prompt.\*           |
| 6     | Forget operations + tests                               | operations/forget.\*                  |
| 7     | Summary view + task operations + tests                  | operations/summary-view.\*            |
| 8     | AgentMemory class (singleton facade) + tests            | agent-memory.ts, agent-memory.test.ts |
| 9     | Barrel export + SKILL.md + README.md                    | index.ts, SKILL.md, README.md         |
| 10    | Register in PACKAGE_INDEX.md                            | .cursor/skills/...                    |

---

## Dependencies

### Production

| Package               | Version   | Purpose                           |
| --------------------- | --------- | --------------------------------- |
| `agent-memory-client` | `^0.3.1`  | Official TypeScript SDK           |
| `dotenv`              | `^16.4.5` | Env loading (monorepo convention) |

### Dev

| Package       | Version   | Purpose               |
| ------------- | --------- | --------------------- |
| `@types/node` | `^25.3.3` | Node type definitions |
| `typescript`  | `^5.9.3`  | TypeScript compiler   |
| `vitest`      | `^4.0.18` | Test runner           |

---

## Testing Strategy

Per `js-testing` skill: **zero mocking, real execution**.

- Tests require the **Agent Memory Server running** at `http://localhost:8000`
- Each test suite uses a unique `namespace` and `sessionId` to avoid collisions
- Cleanup: delete created sessions/memories in `afterAll` or `afterEach`
- Test flow: create → read → search → edit → delete → verify gone

### Test Environment

`test.env`:

```
AGENT_MEMORY_BASE_URL=http://localhost:8000
AGENT_MEMORY_DEFAULT_NAMESPACE=test
```

---

## Usage Examples

Five examples planned in `examples/` — all use our `AgentMemory` wrapper class with
LangChain/LangGraph JS (`@langchain/openai`, `@langchain/langgraph`) and OpenAI.

| #   | File                                     | Focus                                                           |
| --- | ---------------------------------------- | --------------------------------------------------------------- |
| 1   | `01-chatbot-working-memory.ts`           | Chatbot loop: `memoryPrompt` → LLM → fetch-append-put, auto-sum |
| 2   | `02-long-term-memory-crud.ts`            | Create, search, get, edit, delete long-term memories            |
| 3   | `03-langgraph-memory-agent.ts`           | LangGraph StateGraph agent with memory as bound tools           |
| 4   | `04-summary-views-flow.ts`               | Create views, run partitions, poll tasks                        |
| 5   | `05-background-extraction-and-forget.ts` | Auto-extraction from conversations + forget policies            |

Written after the package is built. Full details in
[`docs/concept/08-usage-examples-plan.md`](./concept/08-usage-examples-plan.md).

---

## Notes

- The SDK returns `null` for not-found rather than throwing (for `getLongTermMemory`)
- Filter classes in the SDK use `in_` (with underscore) instead of `in` to avoid JS reserved word
- `putWorkingMemory` replaces the entire working memory; it's not a partial update
- `context_percentage_*` fields are null unless `model_name` or `context_window_max` is provided
- `searchLongTermMemory` text field is optional — can search by filters alone
- The `memories[]` field in working memory accepts both `MemoryRecord` and `ClientMemoryRecord`
- Memories with `persisted_at=null` in working memory are auto-promoted to long-term storage
- Background extraction only runs if a task worker is active on the server
