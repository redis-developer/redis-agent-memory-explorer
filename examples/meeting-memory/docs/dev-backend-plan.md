# Meeting Memory Demo -- Backend Development Plan (V1)

## Goal

Build a TypeScript/Node.js backend that powers the **Memory Exploration Demo** for the Redis Released flagship event. V1 focuses on two experiences derived from Screen 5 (Transcript History) and Screen 6 (Memory Explorer) of the [full UX plan](./plan.md):

1. **Transcript Data** -- serve pre-recorded meeting transcript JSON files so the frontend can load them in full, then display chunks at intervals client-side.
2. **Memory API** -- expose every memory operation from the Redis Agent Memory Server (working memory, long-term memories, summary views, forget/lifecycle) so the frontend can write transcript chunks and read back all memory types.

The backend is a **pure stateless REST API** -- no SSE, no WebSockets, no server-side playback state. The frontend drives the entire playback experience; the backend is a thin pass-through to `cau-redis-agent-memory`.

**Powered by monorepo packages:**

| Package                  | Role                                                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `cau-api-server`         | HTTP server -- POST-only routes, CORS, rate limiting, health endpoint, request IDs, graceful shutdown, `{ data, error }` response envelope |
| `cau-logger`             | Structured logging -- pino-based, child loggers per request (auto-injected by `cau-api-server`)                                            |
| `cau-redis-agent-memory` | Agent Memory Server client -- working memory, long-term memory, summary views, lifecycle                                                   |

Also check examples in `examples/redis-agent-memory/` for `cau-redis-agent-memory` usage patterns.

**Multi-dataset support:** The app is driven by a `dataset.config.json` file inside each dataset folder (e.g., `data/wealth-advisor/dataset.config.json`). All labels, participant names, namespace, userId, and UI text come from this config. Switching datasets is a single env var change (`ACTIVE_DATASET=sdr-advisor`). See [data/wealth-advisor/dataset.config.json](../data/wealth-advisor/dataset.config.json) for the full schema.

**All APIs are POST-only** -- this is a `cau-api-server` convention. Route paths use suffix-notation for namespacing (e.g., `POST /api/getDataset`, `POST /api/appendWorkingMemory`). Request parameters always go in the JSON body. The server auto-wraps all responses in `{ data, error }`.

---

## Data Directory Convention

```
examples/meeting-memory/data/
├── wealth-advisor/                  # One folder per dataset
│   ├── dataset.config.json          # All labels, branding, namespace, userId, roles
│   └── transcripts/
│       ├── 2025-09-14-phone.json
│       ├── 2025-10-28-phone.json
│       ├── 2025-12-02-google-meet.json
│       ├── 2026-01-15-phone.json
│       └── 2026-02-26-google-meet.json
├── sdr-advisor/                     # Future dataset
│   ├── dataset.config.json
│   └── transcripts/
│       └── ...
└── personal-assistant/              # Future dataset
    ├── dataset.config.json
    └── transcripts/
        └── ...
```

Each `dataset.config.json` defines:

- `id`, `name`, `description` -- dataset identity
- `namespace`, `userId` -- used for all `AgentMemory` operations (isolates data per dataset)
- `branding` -- title, subtitle, footer text, accent color
- `roles` -- what "rm" and "client" mean in this domain (e.g., "Relationship Manager" vs "SDR")
- `participants` -- speaker names, titles, organizations
- `memoryLabels` -- how to label each memory type tab and section in the UI
- `transcriptPanel`, `toolbar`, `statusLabels` -- all UI text
- `playbackDefaults` -- default interval and speed options

The backend reads this config at startup and serves it to the frontend via `POST /api/getDataset`.

---

## Architecture Overview

```
┌───────────────────────────────────┐
│  Next.js Frontend                 │
│  (POST-only REST calls)           │
│                                   │
│  0. POST /api/getDataset         │  ← fetch labels, branding, namespace
│  1. POST /api/getTranscript     │  ← fetch full transcript JSON
│  2. setInterval (client-side)     │  ← display chunks at intervals
│  3. POST /api/appendWorkingMemory      │  ← push each chunk to backend
│  4. POST /api/searchLongTermMemory    │  ← read extracted memories
│  5. POST /api/getComputedSummaries       │  ← fetch pre-created summary
│  6. POST /api/resetLifecycle     │  ← clear all & restart
└───────────┬───────────────────────┘
            │ HTTP (POST only, { data, error } envelope)
┌───────────▼───────────────────────┐
│  cau-api-server                   │
│  (POST-only routes, auto-envelope │
│   CORS, helmet, rate-limit,       │
│   request IDs, graceful shutdown) │
│                                   │
│  cau-logger                       │
│  (structured logging, child       │
│   loggers per request)            │
│                                   │
│  ┌─────────────────────────────┐  │
│  │ dataset handlers            │  │  ← serves dataset.config.json
│  ├─────────────────────────────┤  │
│  │ transcript handlers         │  │  ← reads JSON fixtures from disk
│  ├─────────────────────────────┤  │
│  │ working-memory handlers     │  │  ← create/append/get/delete sessions
│  ├─────────────────────────────┤  │
│  │ long-term-memory handlers   │  │  ← search all, search by session
│  ├─────────────────────────────┤  │
│  │ summary-views handlers      │  │  ← pre-seeded views, compute + fetch summaries
│  ├─────────────────────────────┤  │
│  │ lifecycle handlers          │  │  ← forget, reset
│  └──────────┬──────────────────┘  │
              │                     │
┌─────────────▼─────────────────────┐
│  cau-redis-agent-memory           │
│  (AgentMemory singleton)          │
└─────────────┬─────────────────────┘
              │ HTTP (REST)
┌─────────────▼─────────────────────┐
│  Redis Agent Memory Server        │
│  http://localhost:8000            │
│  (Python, agent-memory-server)    │
└─────────────┬─────────────────────┘
              │
┌─────────────▼─────────────────────┐
│  Redis Stack                      │
│  (Redis + RediSearch)             │
└───────────────────────────────────┘
```

**Key simplification:** The frontend fetches the full transcript in one POST call, displays chunks at timed intervals purely client-side, and POSTs each chunk to the backend's working memory append endpoint. The backend never manages playback state, timers, or streaming connections. Every request is independent and stateless.

**`cau-api-server` gives us for free:** CORS, helmet security headers, gzip compression, JSON body parsing, rate limiting, `X-Request-Id` header, `GET /health` endpoint, `{ data, error }` response envelope, graceful shutdown on SIGTERM/SIGINT, child logger per request. No manual Express setup needed.

---

## Project Structure

```
examples/meeting-memory/backend/
├── src/
│   ├── index.ts                        # ApiServer.create(), Logger.create(), AgentMemory.create()
│   ├── config.ts                       # ENV constants (ports, URLs, datasets)
│   ├── types.ts                        # Request/response types for all handlers
│   ├── routes.ts                       # Aggregates all route definitions into a single array
│   ├── handlers/
│   │   ├── dataset.handlers.ts         # getDataset, listDatasets
│   │   ├── transcript.handlers.ts      # listTranscripts, getTranscript
│   │   ├── working-memory.handlers.ts  # createWorkingMemory, appendWorkingMemory, getWorkingMemory, deleteWorkingMemory, listWorkingMemorySessions
│   │   ├── long-term-memory.handlers.ts # searchLongTermMemory, searchLongTermMemoryBySession
│   │   ├── summary-views.handlers.ts   # createSummaryView, listSummaryViews, getSummaryView, computeSummary, getComputedSummaries, deleteSummaryView
│   │   ├── lifecycle.handlers.ts       # resetLifecycle, forget
│   │
│   └── services/
│       ├── dataset-loader.service.ts      # Read and validate dataset.config.json
│       └── transcript-loader.service.ts   # Read transcript JSON fixtures from disk
├── .env
├── package.json
└── tsconfig.json
```

Key structural differences from a raw Express setup:

- No `routes/` folder with Express Router files -- route definitions are `{ path, handler }` objects
- No manual CORS, helmet, body-parser, rate-limiter setup -- `cau-api-server` handles all middleware
- No health route file -- `GET /health` is built-in; `POST /api/checkHealth` extends it with agent memory status
- No error handler middleware -- `cau-api-server` catches errors and wraps in `{ data: null, error }` automatically
- `handlers/` folder contains pure async functions that receive `(input, { logger, requestId })` -- no `req`/`res`

---

## Prerequisites

| Dependency               | Version   | Purpose                                                                     |
| ------------------------ | --------- | --------------------------------------------------------------------------- |
| Redis Stack              | latest    | `docker run -d --name redis-stack -p 6379:6379 redis/redis-stack:latest`    |
| Agent Memory Server      | latest    | `uv run agent-memory api --task-backend=asyncio` at `http://localhost:8000` |
| Node.js                  | >= 18     | Runtime                                                                     |
| `cau-api-server`         | workspace | Link via `"cau-api-server": "*"` in package.json                            |
| `cau-logger`             | workspace | Link via `"cau-logger": "*"` in package.json                                |
| `cau-redis-agent-memory` | workspace | Link via `"cau-redis-agent-memory": "*"` in package.json                    |

---

## Config (`config.ts`)

| Constant                | Env Variable                     | Default                     | Description                                                              |
| ----------------------- | -------------------------------- | --------------------------- | ------------------------------------------------------------------------ |
| `PORT`                  | `MEETING_MEMORY_PORT`            | `3001`                      | Server port (passed to `cau-api-server` `ServerConfig.PORT`)             |
| `AGENT_MEMORY_BASE_URL` | `AGENT_MEMORY_BASE_URL`          | `http://localhost:8000`     | Agent memory server URL                                                  |
| `DATA_DIR`              | `MEETING_MEMORY_DATA_DIR`        | `../data`                   | Root data directory containing dataset folders                           |
| `ACTIVE_DATASET`        | `MEETING_MEMORY_ACTIVE_DATASET`  | `wealth-advisor`            | Which dataset folder to use (folder name under `DATA_DIR`)               |
| `ALLOWED_ORIGINS`       | `MEETING_MEMORY_ALLOWED_ORIGINS` | `["http://localhost:3000"]` | CORS origins (passed to `cau-api-server` `ServerConfig.ALLOWED_ORIGINS`) |
| `MODEL_NAME`            | `MEETING_MEMORY_MODEL_NAME`      | `gpt-4o-mini`               | Model name for context window sizing                                     |

**Derived at startup from `dataset.config.json`:**

- `NAMESPACE` -- from `datasetConfig.namespace` (e.g., `"wealth-advisor"`)
- `USER_ID` -- from `datasetConfig.userId` (e.g., `"sarah-chen"`)
- `TRANSCRIPT_DIR` -- resolved as `{DATA_DIR}/{ACTIVE_DATASET}/transcripts`

To switch datasets, change one env var: `MEETING_MEMORY_ACTIVE_DATASET=sdr-advisor` and restart.

---

## Package Dependencies (`package.json`)

```json
{
  "name": "meeting-memory-backend",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "npx tsx --watch src/index.ts",
    "start": "npx tsx src/index.ts"
  },
  "dependencies": {
    "cau-api-server": "*",
    "cau-logger": "*",
    "cau-redis-agent-memory": "*"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "typescript": "^5.9.3"
  }
}
```

No direct `express`, `cors`, `helmet`, `dotenv`, `compression`, or `express-rate-limit` dependencies -- all provided by `cau-api-server`.

---

## Route Handler Pattern

Every handler follows the `cau-api-server` `RouteHandler` signature:

```typescript
const handler: RouteHandler = async (input, { logger, requestId }) => {
  // input = parsed req.body (typed per route)
  // logger = child logger with requestId bound
  // return value is auto-wrapped: { data: <return>, error: null }
  // thrown errors are auto-caught: { data: null, error: <message> }
  logger.info("Processing request", { input });
  const result = await someOperation(input);
  return result;
};
```

Route definitions aggregate in `routes.ts`:

```typescript
import type { RouteDefinition } from "cau-api-server";

import {
  getDatasetHandler,
  listDatasetsHandler,
} from "./handlers/dataset.handlers";
import {
  listTranscriptsHandler,
  getTranscriptHandler,
} from "./handlers/transcript.handlers";
// ... other imports

const routes: RouteDefinition[] = [
  { path: "/getDataset", handler: getDatasetHandler },
  { path: "/listDatasets", handler: listDatasetsHandler },
  { path: "/listTranscripts", handler: listTranscriptsHandler },
  { path: "/getTranscript", handler: getTranscriptHandler },
  // ... all routes
];

export { routes };
```

All routes are POST-only. Full path = `{API_PREFIX}{path}` → `POST /api/getDataset`, etc.

---

## Complete API Reference

All endpoints are `POST /api/{route}`. Request and response bodies are JSON. Responses are wrapped in `{ data, error }` by `cau-api-server`.

### 1. Health -- `health.handlers.ts`

**Built-in:** `GET /health` (provided by `cau-api-server`, no code needed)

### 2. Dataset -- `dataset.handlers.ts`

**`POST /api/getDataset`**

Serves the active dataset's configuration to the frontend. This is the **first call the frontend makes on load** -- every label, title, and display string in the UI comes from this response.

Request: `{}` (empty body)

Response `data`: the full `dataset.config.json` for the active dataset.

```json
{
  "id": "wealth-advisor",
  "name": "Intelligent Wealth Advisor",
  "namespace": "wealth-advisor",
  "userId": "sarah-chen",
  "branding": { ... },
  "roles": { ... },
  "participants": { ... },
  "memoryLabels": { ... },
  "toolbar": { ... },
  "statusLabels": { ... },
  "playbackDefaults": { ... }
}
```

Key fields the frontend uses:

- `branding.title` -- page title (e.g., "Wealth Advisor Memory Explorer")
- `roles` -- how to label speakers in transcript bubbles
- `participants` -- speaker names, titles
- `memoryLabels` -- all tab titles, section headers, descriptions (including `memoryLabels.summaryViews.views` -- the pre-seeded summary view definitions)
- `toolbar` -- button labels, dropdown labels
- `statusLabels` -- status chip text for each playback phase
- `playbackDefaults` -- default speed and speed options
- `namespace`, `userId` -- passed to all memory API calls

**`POST /api/listDatasets`**

Lists all available datasets (scans `DATA_DIR` for folders containing `dataset.config.json`).

Request: `{}` (empty body)

Response `data`:

```json
{
  "datasets": [
    { "id": "wealth-advisor", "name": "Intelligent Wealth Advisor" },
    { "id": "sdr-advisor", "name": "SDR Sales Advisor" }
  ],
  "active": "wealth-advisor"
}
```

---

### 3. Transcripts -- `transcript.handlers.ts`

**`POST /api/listTranscripts`**

Returns a list of available transcript files for the active dataset.

Request: `{}` (empty body)

Response `data`:

```json
{
  "transcripts": [
    {
      "id": "2026-02-26-google-meet",
      "date": "2026-02-26",
      "type": "google-meet",
      "durationMinutes": 22,
      "chunkCount": 56,
      "participants": { "rm": "Sarah Chen", "client": "James Morrison" }
    }
  ]
}
```

**`POST /api/getTranscript`**

Returns the full transcript JSON (meeting metadata + all chunks). The frontend loads this once, then iterates through `chunks[]` client-side at intervals.

Request:

```json
{ "transcriptId": "2026-02-26-google-meet" }
```

Response `data`: the raw transcript JSON file (same shape as `data/wealth-advisor/transcripts/*.json`).

---

### 4. Working Memory -- `working-memory.handlers.ts`

The central API group. The frontend calls these to create sessions, push transcript chunks, and read back memory state.

**`POST /api/createWorkingMemory`**

Creates a new working memory session. Called once when playback starts.

Request:

```json
{ "transcriptId": "2026-02-26-google-meet" }
```

`userId` and `namespace` are derived from the dataset config -- not sent by the frontend.

Response `data`:

```json
{
  "sessionId": "playback-2026-02-26-google-meet-1711234567890",
  "created": true,
  "memory": { ... }
}
```

Implementation:

1. Generate session ID: `playback-{transcriptId}-{Date.now()}`
2. Call `AgentMemory.getInstance().getOrCreateWorkingMemory(sessionId, { userId: USER_ID, namespace: NAMESPACE })`
3. Return session ID + initial memory state

**`POST /api/appendWorkingMemory`**

The core endpoint called by the frontend on each playback tick. Appends a transcript chunk to working memory.

Request:

```json
{
  "sessionId": "playback-2026-02-26-google-meet-1711234567890",
  "chunk": {
    "timestamp": "00:12:15",
    "speaker": "James Morrison",
    "role": "client",
    "text": "...and Maya's been talking about retiring early, maybe next year."
  },
  "isLastChunk": false
}
```

Response `data`:

```json
{
  "messageCount": 24,
  "tokens": 2150,
  "context": null,
  "contextPercentageTotalUsed": 16,
  "contextPercentageUntilSummarization": 84,
  "latencyMs": 42
}
```

Implementation:

1. Read current working memory: `getWorkingMemory(sessionId, { userId: USER_ID, namespace: NAMESPACE })`
2. Format chunk as message: `{ role: "user", content: "[{timestamp}] {speaker}: {text}" }`
3. Append to existing messages
4. Build the `putWorkingMemory` payload:
   - If `isLastChunk` is true, add `longTermMemoryStrategy: { strategy: ExtractionStrategy.DISCRETE }` to trigger background extraction
   - Always include `userId: USER_ID`, `namespace: NAMESPACE`
5. Call `putWorkingMemory(sessionId, payload, { namespace: NAMESPACE, modelName: MODEL_NAME })`
6. Return working memory stats from the response

This is the only endpoint that performs a **write** per playback tick. It's fast (single Redis operation under the hood) and the latency is returned to the frontend for the metrics display.

**`POST /api/getWorkingMemory`**

Returns the full `WorkingMemoryResult` for a session.

Request:

```json
{ "sessionId": "playback-2026-02-26-google-meet-1711234567890" }
```

Response `data`:

```json
{
  "sessionId": "playback-...",
  "messages": [...],
  "memories": [...],
  "data": null,
  "context": "Summary of the conversation so far...",
  "userId": "sarah-chen",
  "namespace": "wealth-advisor",
  "tokens": 4250,
  "ttlSeconds": null,
  "lastAccessed": "2026-02-26T10:14:00Z",
  "createdAt": "2026-02-26T10:00:00Z",
  "updatedAt": "2026-02-26T10:14:00Z",
  "contextPercentageTotalUsed": 32,
  "contextPercentageUntilSummarization": 68
}
```

Key fields the frontend will display:

- `messages` -- the conversation/transcript messages stored in working memory
- `context` -- the auto-generated context summary (working memory summary)
- `tokens` -- token count of the working memory
- `contextPercentageTotalUsed` / `contextPercentageUntilSummarization` -- context window usage
- `memories` -- any memories attached to the working memory session

**`POST /api/deleteWorkingMemory`**

Request:

```json
{ "sessionId": "playback-..." }
```

Deletes working memory for the session. Calls `deleteWorkingMemory(sessionId, { namespace: NAMESPACE, userId: USER_ID })`.

**`POST /api/listWorkingMemorySessions`**

Request:

```json
{ "limit": 20, "offset": 0 }
```

Response `data`: `{ sessions: string[], total: number }`

Lists all active sessions. Calls `AgentMemory.getInstance().listSessions({ namespace: NAMESPACE, userId: USER_ID, limit, offset })`.

This endpoint is used by the frontend's **"Load Existing Session"** dropdown. On page load, the frontend calls `listWorkingMemorySessions` to discover existing sessions from previous runs. Session IDs follow the format `playback-{transcriptId}-{timestamp}`, allowing the frontend to parse the `transcriptId` and load the corresponding transcript for display.

---

### 5. Long-Term Memory -- `long-term-memory.handlers.ts`

**`POST /api/searchLongTermMemory`**

Request:

```json
{
  "text": "retirement planning",
  "memoryType": "semantic",
  "topics": ["retirement", "planning"],
  "entities": ["Maya Morrison"],
  "limit": 20,
  "offset": 0
}
```

All filter fields are optional. `namespace` and `userId` are auto-injected from the dataset config.

Response `data`:

```json
{
  "memories": [
    {
      "id": "mem-abc123",
      "text": "Maya Morrison considering early retirement in 2027",
      "memoryType": "semantic",
      "topics": ["retirement", "spouse", "planning"],
      "entities": ["Maya Morrison"],
      "userId": "sarah-chen",
      "sessionId": "playback-...",
      "namespace": "wealth-advisor",
      "eventDate": null,
      "createdAt": "2026-02-26T10:15:00Z",
      "updatedAt": "2026-02-26T10:15:00Z",
      "lastAccessed": "2026-02-26T10:15:00Z",
      "persistedAt": "2026-02-26T10:15:00Z",
      "pinned": false,
      "accessCount": 1,
      "memoryHash": "...",
      "dist": 0.23
    }
  ],
  "total": 8,
  "nextOffset": null
}
```

Implementation:

```typescript
AgentMemory.getInstance().searchLongTermMemory({
  text: input.text ?? "",
  userId: { eq: USER_ID },
  namespace: { eq: NAMESPACE },
  memoryType: input.memoryType ? { eq: input.memoryType } : undefined,
  topics: input.topics ? { any: input.topics } : undefined,
  entities: input.entities ? { any: input.entities } : undefined,
  limit: input.limit ?? 20,
  offset: input.offset ?? 0,
});
```

**`POST /api/searchLongTermMemoryBySession`**

Returns long-term memories extracted from a specific playback session. This is the primary way the frontend reads memories after a transcript completes -- it scopes results to the session that just played, rather than returning all memories across all sessions for the user.

Request:

```json
{ "sessionId": "playback-2026-02-26-google-meet-1711234567890" }
```

Implementation:

```typescript
searchLongTermMemory({
  text: "",
  sessionId: { eq: input.sessionId },
  namespace: { eq: NAMESPACE },
  limit: 50,
});
```

---

### 6. Summary Views -- `summary-views.handlers.ts`

**Concept: Summary View vs Computed Summary**

The Agent Memory Server uses two distinct concepts for summarisation:

- **Summary View** = a **definition** (template/recipe). It describes *how* to summarize long-term memories: which source (`long_term`), how to group them (`groupBy: ["user_id"]`), and optionally a time window. Creating a view does **not** produce any text -- it just stores the recipe.
- **Computed Summary** (internally called a "partition") = the **actual LLM-generated narrative** for one group within a view. When you call `computeSummary({ viewId, group: { user_id: "sarah-chen" } })`, the Agent Memory Server gathers all matching long-term memories, sends them to the LLM, and returns the generated text (e.g., "James Morrison is a moderate-risk HNW client targeting $3M by retirement in 2031..."). This is the materialised result -- the cooked dish.

In short: **View = recipe, Computed Summary = the cooked dish.**

Our demo API names reflect this: `createSummaryView` / `listSummaryViews` / `getSummaryView` / `deleteSummaryView` manage the recipe, while `computeSummary` and `getComputedSummaries` deal with the actual generated text.

**Strategy: pre-seeded views from dataset config + on-the-fly flexibility + namespace scoping**

Summary views are defined in the dataset config (`memoryLabels.summaryViews.views` array). At startup, the backend creates all of them, giving the demo multiple ready-to-use views out of the box.

**Namespace scoping:** The Agent Memory Server's summary view CRUD operations (`listSummaryViews`, `getSummaryView`, `createSummaryView`, `deleteSummaryView`) are **server-global** -- they have no built-in namespace parameter. To support multiple datasets sharing the same AMS instance, the backend applies namespace scoping at two levels:

- **View creation**: Every view is created with `filters: { namespace, user_id }` auto-injected from the active dataset config. The `filters` field is stored on the view definition and both (a) tells the AMS which memories to include when computing summaries and (b) serves as a namespace tag for client-side filtering.
- **View listing**: After calling `listSummaryViews()`, the result is filtered to `view.filters.namespace === activeNamespace`. This ensures each dataset only sees its own views.
- **Partition listing**: No additional namespace/userId filter is needed. Partitions inherit the view's scope -- since only namespace-scoped views are returned by view listing, all partitions within those views are inherently within the correct namespace.
- **Lifecycle reset**: Only views whose `filters.namespace` matches the active dataset are deleted during reset. Other datasets' views are untouched.

The `dataset.config.json` does **not** contain explicit `namespace`/`userId` in each view entry -- those values are already at the config's top level (`config.namespace`, `config.userId`) and are auto-injected by the backend code at view creation time.

1. **Pre-seeded views** -- At startup (`onAppStart`), the backend iterates `config.memoryLabels.summaryViews.views` and creates each one via `AgentMemory.createSummaryView()` with `filters: { namespace, user_id }` auto-injected. If a view with the same name already exists for this namespace (matched by `view.filters.namespace`), it is skipped. The frontend calls `listSummaryViews` to discover all available views and renders them uniformly -- no special "default" concept.

2. **On-the-fly creation** -- The `createSummaryView` API remains available so the presenter can demonstrate flexibility: "We can also create custom views grouped by topic, by session, or by time window." The handler auto-injects `filters: { namespace, user_id }` from the active dataset config.

3. **Compute summaries** -- Summaries are **NOT auto-computed**. After long-term memories are extracted, the frontend explicitly triggers `computeSummary` (the "Compute Summary" button). This generates the AI narrative by calling the Agent Memory Server's LLM-powered summarisation. The same API is used for first compute and recompute (e.g., after a second transcript session adds more memories).

4. **Fetch computed summaries** -- `getComputedSummaries` is the key API the frontend calls to **read** previously generated summary text. It passes `{ namespace, userId }` to `listSummaryViewPartitions` to ensure only the active dataset's partitions are returned.

**Dataset config view definitions:**

```json
"summaryViews": {
  "title": "Summary Views",
  "description": "AI-generated narrative summaries condensed from extracted memories.",
  "views": [
    { "name": "Client Memory Summary", "source": "long_term", "groupBy": ["user_id"] },
    { "name": "Session Recap", "source": "long_term", "groupBy": ["session_id"], "prompt": "Summarize the key discussion points..." }
  ]
}
```

Each view entry supports all `CreateSummaryViewInput` fields: `name`, `source`, `groupBy`, `filters`, `timeWindowDays`, `continuous`, `prompt`.

**Startup pre-creation (in `onAppStart`):**

```typescript
const viewConfigs = datasetConfig.memoryLabels.summaryViews.views;
const existingViews = await AgentMemory.getInstance().listSummaryViews();
const ownViews = existingViews.filter((v) => v.filters?.namespace === namespace);

for (const config of viewConfigs) {
  const alreadyExists = ownViews.find((v) => v.name === config.name);
  if (!alreadyExists) {
    const scopedFilters = { ...config.filters, namespace, user_id: userId };
    await AgentMemory.getInstance().createSummaryView({
      name: config.name,
      source: config.source,
      groupBy: config.groupBy,
      filters: scopedFilters,
      timeWindowDays: config.timeWindowDays,
      continuous: config.continuous,
      prompt: config.prompt,
    });
  }
}
```

**`POST /api/createSummaryView`**

Creates a new summary view on demand -- for showing flexibility during the demo.

Request:

```json
{
  "name": "Topic-Based Summary",
  "source": "long_term",
  "groupBy": ["topics"],
  "timeWindowDays": 30
}
```

Response `data`:

```json
{
  "viewId": "view-xyz789",
  "name": "Topic-Based Summary",
  "source": "long_term",
  "groupBy": ["topics"],
  "createdAt": "2026-02-26T10:20:00Z"
}
```

**`POST /api/listSummaryViews`**

Lists all summary views (both pre-seeded and on-the-fly).

Request: `{}` (empty body)

Response `data`:

```json
{
  "views": [
    {
      "viewId": "view-abc123",
      "name": "Client Memory Summary",
      "source": "long_term",
      "groupBy": ["user_id"]
    },
    {
      "viewId": "view-def456",
      "name": "Session Recap",
      "source": "long_term",
      "groupBy": ["session_id"]
    }
  ]
}
```

**`POST /api/getSummaryView`**

Gets a single summary view by ID.

Request:

```json
{ "viewId": "view-abc123" }
```

**`POST /api/computeSummary`**

Computes (or recomputes) the summary for a specific group within a view. This is the "Compute Summary" button action. It is **not automatic** -- the frontend must explicitly trigger it after long-term memories have been extracted. Uses the Agent Memory Server's LLM to generate the AI narrative from the matching long-term memories.

Request:

```json
{
  "viewId": "view-abc123",
  "group": { "user_id": "sarah-chen" }
}
```

Response `data`:

```json
{
  "viewId": "view-abc123",
  "group": { "user_id": "sarah-chen" },
  "summary": "James Morrison is a moderate-risk HNW client targeting $3M by retirement in 2031...",
  "memoryCount": 8,
  "computedAt": "2026-02-26T10:20:00Z"
}
```

**`POST /api/getComputedSummaries`**

Fetches all computed summaries for a view. This is how the frontend **reads** previously generated summary text.

Request:

```json
{ "viewId": "view-abc123" }
```

Response `data`:

```json
{
  "summaries": [
    {
      "group": { "user_id": "sarah-chen" },
      "summary": "James Morrison is a moderate-risk HNW client targeting $3M by retirement in 2031...",
      "memoryCount": 8,
      "computedAt": "2026-02-26T10:20:00Z"
    }
  ]
}
```

Implementation: maps to `listSummaryViewPartitions(viewId)` on the `AgentMemory` client (internal terminology: "partitions"). No additional namespace/userId filter is needed because partitions inherit the view's scope (views are already namespace-filtered by `listSummaryViewsHandler`).

**`POST /api/deleteSummaryView`**

Deletes a summary view and its computed summaries.

Request:

```json
{ "viewId": "view-xyz789" }
```

**`POST /api/getTask`**

Polls task status (for async operations like full recomputes).

Request:

```json
{ "taskId": "task-abc" }
```

---

### 7. Lifecycle -- `lifecycle.handlers.ts`

**`POST /api/forgetLifecycle`**

Runs a forget policy against long-term memories.

Request:

```json
{
  "policy": { "maxAgeDays": 30, "maxInactiveDays": 14 },
  "dryRun": true
}
```

`namespace` and `userId` auto-injected from dataset config.

Response `data`:

```json
{
  "deleted": 0,
  "scanned": 8,
  "deletedIds": []
}
```

**`POST /api/resetLifecycle`**

Full demo reset. Deletes all working memory sessions, long-term memories, and summary views for the active dataset's namespace. Then re-creates all pre-seeded summary views from the dataset config.

Request: `{}` (empty body)

Steps:

1. List all sessions in namespace via `listSessions({ namespace: NAMESPACE })`
2. Delete each session via `deleteWorkingMemory(sessionId, { namespace: NAMESPACE, userId: USER_ID })`
3. Search all long-term memories in namespace via `searchLongTermMemory({ namespace: { eq: NAMESPACE }, limit: 100 })`
4. Delete all found memories via `deleteLongTermMemories(ids)`
5. Delete summary views **scoped to this namespace only** via `listSummaryViews()`, filter by `view.filters.namespace === NAMESPACE`, then `deleteSummaryView(viewId)` for each. Other datasets' views are untouched.
6. **Re-create all pre-seeded summary views** from `config.memoryLabels.summaryViews.views` with `filters: { namespace, user_id }` auto-injected (same as `onAppStart`) so they're ready for the next run

Response `data`:

```json
{
  "sessionsDeleted": 1,
  "memoriesDeleted": 8,
  "viewsDeleted": 2,
  "viewsCreated": 2
}
```

---

### 8. Memory Prompt -- (optional, V1.1)

**`POST /api/hydrateMemoryPrompt`**

Hydrates a query with full memory context. Useful for showing how the agent memory server combines working memory + long-term search into a prompt.

Request:

```json
{
  "query": "What are the key concerns for this client?",
  "sessionId": "playback-..."
}
```

Returns `MemoryPromptResult` -- the fully hydrated messages array.

---

## Services

### DatasetLoaderService (`dataset-loader.service.ts`)

Reads and validates `dataset.config.json` for the active dataset. Initialized at startup.

| Method              | Signature                              | Description                                                  |
| ------------------- | -------------------------------------- | ------------------------------------------------------------ |
| `loadDatasetConfig` | `(datasetId: string) => DatasetConfig` | Load and parse `data/{datasetId}/dataset.config.json`        |
| `listDatasets`      | `() => DatasetSummary[]`               | Scan `DATA_DIR` for folders containing `dataset.config.json` |
| `getActiveConfig`   | `() => DatasetConfig`                  | Return the currently loaded config                           |

The loaded `DatasetConfig` is used by:

- `config.ts` to derive `NAMESPACE` and `USER_ID`
- `dataset.handlers.ts` to serve to the frontend
- `transcript-loader.service.ts` to resolve the transcript directory path
- `index.ts` and `lifecycle.handlers.ts` for pre-seeded summary view creation at startup and on reset

### TranscriptLoaderService (`transcript-loader.service.ts`)

Reads transcript JSON files from the active dataset's `transcripts/` directory.

| Method            | Signature                        | Description                                    |
| ----------------- | -------------------------------- | ---------------------------------------------- |
| `listTranscripts` | `() => TranscriptSummary[]`      | Scan directory, return metadata for each file  |
| `loadTranscript`  | `(id: string) => TranscriptData` | Load and parse a specific transcript JSON file |

Types:

```typescript
type TranscriptChunk = {
  timestamp: string; // "00:12:15"
  speaker: string; // "James Morrison"
  role: string; // "client" | "rm"
  text: string;
};

type TranscriptMeeting = {
  id: string;
  date: string;
  type: string;
  durationMinutes: number;
  participants: { rm: string; client: string };
  summary: {
    topics: string[];
    sentiment: string;
    keyDecisions: string[];
    followUps: string[];
  };
};

type TranscriptData = {
  meeting: TranscriptMeeting;
  chunks: TranscriptChunk[];
};
```

---

## Bootstrap Flow (`index.ts`)

```typescript
import { ApiServer } from "cau-api-server";
import { Logger } from "cau-logger";
import { AgentMemory } from "cau-redis-agent-memory";

import { routes } from "./routes";
import {
  PORT,
  ALLOWED_ORIGINS,
  AGENT_MEMORY_BASE_URL,
  ACTIVE_DATASET,
} from "./config";
import { DatasetLoaderService } from "./services/dataset-loader.service";
import { TranscriptLoaderService } from "./services/transcript-loader.service";

const logger = Logger.create({
  level: "info",
  context: "MeetingMemory",
  transports: [{ type: "console", format: "pretty" }],
});

const server = ApiServer.create({
  config: {
    PORT,
    ALLOWED_ORIGINS,
  },
  logger,
  routes,
  onAppStart: async () => {
    // 1. Load dataset config
    const datasetConfig =
      DatasetLoaderService.loadDatasetConfig(ACTIVE_DATASET);
    const { namespace, userId } = datasetConfig;

    // 2. Initialize AgentMemory
    AgentMemory.create({
      baseUrl: AGENT_MEMORY_BASE_URL,
      defaultNamespace: namespace,
    });
    await AgentMemory.getInstance().healthCheck();

    // 3. Initialize TranscriptLoaderService
    TranscriptLoaderService.init(ACTIVE_DATASET);

    // 4. Pre-create all summary views from dataset config
    await ensureSummaryViews(datasetConfig.memoryLabels.summaryViews.views);

    logger.info("Backend ready", {
      dataset: ACTIVE_DATASET,
      namespace,
      userId,
    });
  },
  onAppStop: async () => {
    await AgentMemory.getInstance().close();
    logger.info("Backend stopped");
  },
});

server.start();
```

Summary of the bootstrap:

```
1. Logger.create() -- structured logging with pretty format
2. ApiServer.create() -- registers all routes, configures CORS, helmet, rate-limit
3. onAppStart:
   a. Load dataset config from disk
   b. Derive NAMESPACE + USER_ID
   c. AgentMemory.create() + healthCheck()
   d. TranscriptLoaderService.init()
   e. Pre-create all summary views from dataset config
   f. Log "Backend ready" with dataset info
4. server.start() -- starts listening
5. onAppStop (on SIGTERM/SIGINT):
   a. AgentMemory.close()
   b. Logger flush (handled by cau-api-server)
```

---

## Frontend-Driven Playback (How It Works End-to-End)

The backend is completely passive. All calls are `POST /api/*`.

```
Frontend                                Backend                     Agent Memory Server
  │                                       │                              │
  │ POST /api/getDataset {}              │                              │
  │──────────────────────────────────────>│ (reads dataset.config.json)  │
  │       { data: { id, branding, ... } }  │                              │
  │<──────────────────────────────────────│                              │
  │                                       │                              │
  │ (frontend stores config, renders      │                              │
  │  all labels/titles from config)       │                              │
  │                                       │                              │
  │ POST /api/getTranscript             │                              │
  │   { transcriptId }                    │                              │
  │──────────────────────────────────────>│                              │
  │       { data: { meeting, chunks[] } } │                              │
  │<──────────────────────────────────────│                              │
  │                                       │                              │
  │ POST /api/createWorkingMemory                     │                              │
  │   { transcriptId }    │                              │
  │──────────────────────────────────────>│ getOrCreateWorkingMemory()   │
  │                                       │─────────────────────────────>│
  │       { data: { sessionId } }         │                              │
  │<──────────────────────────────────────│                              │
  │                                       │                              │
  │ ┌─── setInterval (2000ms) ───┐        │                              │
  │ │                            │        │                              │
  │ │ Display chunk[i] in UI     │        │                              │
  │ │                            │        │                              │
  │ │ POST /api/appendWorkingMemory   │        │                              │
  │ │   { sessionId,     │        │                              │
  │ │     chunk, isLastChunk }   │        │                              │
  │ │───────────────────────────>│ get + put WorkingMemory()             │
  │ │                            │─────────────────────────────>         │
  │ │ { data: { tokens, ... } }  │                              │
  │ │<───────────────────────────│                              │
  │ │                            │                              │
  │ │ (if last chunk)            │                              │
  │ │ POST /api/appendWorkingMemory { isLast }    │ putWorkingMemory() with      │
  │ │───────────────────────────>│ longTermMemoryStrategy       │
  │ │                            │─────────────────────────────>│
  │ │                            │     triggers extraction       │
  │ └────────────────────────────┘                              │
  │                                       │                              │
  │ (wait ~15s for extraction)            │                              │
  │                                       │                              │
  │ POST /api/searchLongTermMemory     │                              │
  │   {}                                  │                              │
  │──────────────────────────────────────>│ searchLongTermMemory()       │
  │                                       │─────────────────────────────>│
  │       { data: { memories[] } }        │                              │
  │<──────────────────────────────────────│                              │
  │                                       │                              │
  │ POST /api/computeSummary              │                              │
      │                              │
  │   { viewId: "<any-view-id>",           │ computeSummary()             │
  │     group: { user_id: "sarah-chen" } }│                              │
  │──────────────────────────────────────>│─────────────────────────────>│
  │       { data: { summary } }           │                              │
  │<──────────────────────────────────────│                              │
  │                                       │                              │
  │ POST /api/getComputedSummaries         │                              │
  │                                       │ listSummaryViewPartitions()  │
  │   { viewId: "<any-view-id>" }         │                              │
  │──────────────────────────────────────>│─────────────────────────────>│
  │       { data: { summaries[] } }       │                              │
  │<──────────────────────────────────────│                              │
```

---

## Demo Workflow (What the Presenter Does)

### Flow A: Live Playback Experience

1. **Page load** -- Frontend calls `POST /api/getDataset` to get all labels, config, namespace, userId. Also calls `POST /api/listWorkingMemorySessions` to check for existing sessions from previous runs.
2. **Select transcript** -- Frontend calls `POST /api/getTranscript { transcriptId }` (full JSON in one call). Alternatively, if sessions exist, the presenter can select an existing session from the "Load Existing Session" dropdown to instantly load all data without replaying.
3. **Click Play** -- Frontend calls `POST /api/createWorkingMemory { transcriptId }` to create a session
4. **Watch** -- Frontend's `setInterval` displays chunks one at a time AND calls `POST /api/appendWorkingMemory` for each
5. **Observe** -- Each append response returns working memory stats (tokens, context, etc.) displayed in real-time
6. **Complete** -- Last chunk sent with `isLastChunk: true`, triggers background extraction
7. **Wait ~15s** -- Frontend polls `POST /api/searchLongTermMemory` until memories appear
8. **Compute Summaries** -- Frontend calls `POST /api/listSummaryViews` to discover all pre-seeded views. Each view has a "Compute Summary" button. Clicking it calls `POST /api/computeSummary { viewId, group }` to trigger the LLM narrative.
9. **Read Summary** -- Computed summaries are displayed inline. Can be recomputed any time via the "Recompute" button.
10. **Explore** -- Frontend displays long-term memories, multiple summary views side by side, working memory context
11. **Show Flexibility** (optional) -- Create a custom view via `POST /api/createSummaryView`, compute a different summary
12. **Click "Clear All Memories & Restart"** -- Frontend calls `POST /api/resetLifecycle`, then resets its own state. Backend re-creates all pre-seeded summary views, ready for a fresh run.

---

## Memory Types Showcased

| Memory Type                                                                         | Source                                                          | What It Shows                                                         |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------- |
| **Working Memory** (`getWorkingMemory`)                                             | Transcript chunks pushed via `appendWorkingMemory`              | Live session state: messages array, token count, context window usage |
| **Working Memory Context** (`context` field)                                        | Auto-generated by agent memory server when context window fills | Condensed summary of the conversation so far                          |
| **Long-Term Memory (Semantic)** (`searchLongTermMemory`, type=`semantic`)           | Background extraction from working memory                       | Durable facts: "Maya Morrison considering early retirement 2027"      |
| **Long-Term Memory (Episodic)** (`searchLongTermMemory`, type=`episodic`)           | Background extraction                                           | Events with dates: "Meeting on Feb 26 to discuss REIT rebalancing"    |
| **Computed Summaries** (`computeSummary`, `getComputedSummaries`)       | Pre-seeded views from dataset config or on-demand custom views  | AI-generated summary grouped by user/session/topic (LLM-computed, not auto) |
| **Forget / Lifecycle** (`forgetLifecycle`)                                          | Manual trigger                                                  | Demonstrates memory cleanup policies                                  |

---

## Error Handling

`cau-api-server` provides automatic error handling. All unhandled exceptions in route handlers are caught and returned as:

```json
{
  "data": null,
  "error": "Agent memory server unavailable"
}
```

with HTTP 500. For domain-specific errors, handlers can throw with `HTTP_STATUS_CODES` for different status codes, or return structured error information.

The child `logger` (auto-injected per request with `requestId` bound) logs errors with full stack traces via `cau-logger`.

---

## Environment File (`.env`)

```env
MEETING_MEMORY_PORT=3001
AGENT_MEMORY_BASE_URL=http://localhost:8000
MEETING_MEMORY_ACTIVE_DATASET=wealth-advisor
MEETING_MEMORY_DATA_DIR=../data
MEETING_MEMORY_ALLOWED_ORIGINS=http://localhost:3000
MEETING_MEMORY_MODEL_NAME=gpt-4o-mini
OPENAI_API_KEY=<required-for-extraction-and-summaries>
```

To run with a different dataset: `MEETING_MEMORY_ACTIVE_DATASET=sdr-advisor npm run dev`

---

## Complete Route Map (Quick Reference)

| Route Path                             | Handler                             | Description                                    |
| -------------------------------------- | ----------------------------------- | ---------------------------------------------- |
| `GET /health`                          | (built-in)                          | Server health + uptime                         |
| `POST /api/getDataset`                 | `getDatasetHandler`                 | Active dataset config                          |
| `POST /api/listDatasets`               | `listDatasetsHandler`               | All available datasets                         |
| `POST /api/listTranscripts`            | `listTranscriptsHandler`            | Available transcript files                     |
| `POST /api/getTranscript`              | `getTranscriptHandler`              | Full transcript JSON                           |
| `POST /api/createWorkingMemory`        | `createWorkingMemoryHandler`        | Create working memory session for a transcript |
| `POST /api/appendWorkingMemory`        | `appendWorkingMemoryHandler`        | Append transcript chunk to working memory      |
| `POST /api/getWorkingMemory`           | `getWorkingMemoryHandler`           | Get full working memory state                  |
| `POST /api/deleteWorkingMemory`        | `deleteWorkingMemoryHandler`        | Delete working memory session                  |
| `POST /api/listWorkingMemorySessions`  | `listWorkingMemorySessionsHandler`  | List all sessions                              |
| `POST /api/searchLongTermMemory`       | `searchLongTermMemoryHandler`       | Search all long-term memories (user+namespace) |
| `POST /api/searchLongTermMemoryBySession` | `searchLongTermMemoryBySessionHandler` | Search long-term memories scoped to a session   |
| `POST /api/createSummaryView`          | `createSummaryViewHandler`          | Create summary view (on-the-fly)               |
| `POST /api/listSummaryViews`           | `listSummaryViewsHandler`           | List all summary views                         |
| `POST /api/getSummaryView`             | `getSummaryViewHandler`             | Get single summary view definition             |
| `POST /api/computeSummary`           | `computeSummaryHandler`           | Compute/recompute a summary for a view (LLM)    |
| `POST /api/getComputedSummaries`     | `getComputedSummariesHandler`     | Read previously computed summaries for a view    |
| `POST /api/deleteSummaryView`          | `deleteSummaryViewHandler`          | Delete a summary view                          |
| `POST /api/getTask`                    | `getTaskHandler`                    | Poll async task status                         |
| `POST /api/resetLifecycle`             | `resetLifecycleHandler`             | Full demo reset + re-create pre-seeded views   |
| `POST /api/forgetLifecycle`            | `forgetLifecycleHandler`            | Run forget policy                              |
| `POST /api/hydrateMemoryPrompt`        | `hydrateMemoryPromptHandler`        | (V1.1) Hydrate query with memory context       |

---

## Implementation Priority (Build Order)

| Phase | What                                                                                                                     | Why                                               |
| ----- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| 1     | `config.ts`, `types.ts`, `index.ts` (bootstrap with `ApiServer.create`, `Logger.create`, `AgentMemory.create`)           | Foundation -- server runs, health works           |
| 2     | `dataset-loader.service.ts` + `dataset.handlers.ts`                                                                      | Dataset config loading, frontend can fetch labels |
| 3     | `transcript-loader.service.ts` + `transcript.handlers.ts`                                                                | Serve transcript data                             |
| 4     | `working-memory.handlers.ts` (create-session, append, get, delete, list-sessions)                                        | Core: frontend writes chunks, reads state         |
| 5     | `long-term-memory.handlers.ts` (search, get-by-session)                                                                  | Show extracted memories after playback            |
| 6     | `summary-views.handlers.ts` (pre-seed views in onAppStart, create, list, get, compute, get-computed, delete)                 | Summary views -- pre-seeded from config + on-the-fly  |
| 7     | `lifecycle.handlers.ts` (reset, forget)                                                                                  | Demo reset (the "Clear All" button backend)       |

---

## Notes

- The backend is **fully stateless**. No in-memory maps, no timers, no connection tracking. Every request is independent. All durable state lives in Redis via the Agent Memory Server.
- **Multi-dataset by design.** Every label, namespace, and user ID comes from `dataset.config.json`. Zero hardcoded display strings. To add a new dataset: create a folder under `data/`, add `dataset.config.json` + `transcripts/`, set `ACTIVE_DATASET` env var.
- **Powered by `cau-api-server`** -- no manual Express setup. The server provides CORS, helmet, compression, rate limiting, request IDs, `{ data, error }` envelope, health endpoint, and graceful shutdown out of the box.
- **Structured logging via `cau-logger`** -- every request gets a child logger with `requestId` bound. All handler log calls include the request context automatically.
- **All APIs are POST-only** with dot-notation paths. No URL params (`:id`), no query strings. All parameters go in the JSON request body.
- **`userId` and `namespace` are never sent by the frontend** -- they are derived from the active dataset config on every request. This prevents data leakage across datasets.
- **Summary views are namespace-scoped.** The AMS summary view CRUD is server-global (no built-in namespace parameter), so the backend applies scoping at two levels: (1) all views are created with `filters: { namespace, user_id }` auto-injected from the dataset config, and (2) all view listing calls filter by `view.filters.namespace`. Partitions inherit the view's scope, so no additional namespace filter is needed when listing partitions. The `dataset.config.json` does **not** contain redundant namespace/userId in each view entry -- those are auto-injected from the top-level `config.namespace` and `config.userId`.
- **Summary views are pre-seeded from the dataset config at startup** so the demo has multiple views ready to compute summaries without any creation step. On-the-fly creation via the API is also supported for showing flexibility.
- No LLM calls are made directly by the backend. The Agent Memory Server handles extraction (via `longTermMemoryStrategy`) and summarization (via summary views) using its own configured model (`FAST_MODEL` env var on the Python server).
- The `appendWorkingMemory` handler is the only "smart" handler -- it reads current working memory, appends, and writes back. Everything else is a direct pass-through to `AgentMemory`.
- The `resetLifecycle` handler only deletes summary views whose `filters.namespace` matches the active dataset (not all views on the server), then re-creates all pre-seeded views with namespace-scoped filters, so the next demo run is ready immediately.
- Metrics (operation counts, latencies) are tracked client-side. Each API response includes timing info the frontend can aggregate.
- The backend follows the same code style as the monorepo packages: arrow functions, consolidated exports, separate type imports, kebab-case files, no emojis.

---

## Related Plans

- [Backend Chatbot Plan](./dev-backend-chatbot-plan.md) -- adds a LangGraph agent with memory tools + CopilotKit `/copilotkit` endpoint (purely additive, zero changes to existing routes or handlers)
- [Frontend Chatbot Plan](./dev-frontend-chatbot-plan.md) -- CopilotKit sidebar UI for the chatbot
- [Live Suggestions Plan](./dev-live-suggestions-brainstorm.md) -- push-based AI copilot with suggestion endpoint + in-memory store (new `generateSuggestion` + `listSuggestions` routes)
