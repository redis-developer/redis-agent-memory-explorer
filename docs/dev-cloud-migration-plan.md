# Migration Plan: OSS Agent Memory Server → Redis Agent Memory Cloud

## Overview

This document describes the migration path from the **open-source Agent Memory Server** (self-hosted, `agent-memory-client` npm SDK, Docker image `redislabs/agent-memory-server`) to the **Redis Agent Memory** cloud product (`@redis-ai/agent-memory` TypeScript SDK v0.0.1).

The cloud product is being built by the core engineering team as a managed service. It will eventually deprecate the open-source version. Its APIs are different, and it currently lacks some features that the OSS version provides (summary views, memory prompt, extraction strategies, forget policies).

### Strategy: New Package (`cau-ram`)

Create a **new package** `cau-ram` (Redis Agent Memory) that fully replaces `cau-redis-agent-memory`:

- Wraps the `@redis-ai/agent-memory` cloud SDK with ergonomic types
- Uses **cloud-native terminology** (session memory, events, actorId) -- not old OSS naming
- **Builds custom logic** for features the cloud doesn't have (extraction, memoryPrompt, summary views) using session data + LTM + OpenAI
- Backend imports **only** from `cau-ram` (no toggle, no dual-mode)
- The old `cau-redis-agent-memory` package is left in place but unused

**Why custom logic works**: The cloud SDK gives us full access to session events (short-term) and long-term memories. The OSS server's "smart" features were just LLM calls over that same data. We build them ourselves with full control over prompts, models, and behavior.

---

## Cloud SDK Reference

- **Package**: `@redis-ai/agent-memory` (v0.0.1, Speakeasy-generated)
- **Location**: `packages/agent-memory-ts-sdk/` (vendored into monorepo -- NOT on npm, DO NOT MODIFY)
- **Install**: Referenced as workspace dependency: `"@redis-ai/agent-memory": "workspace:*"`
- **Auth**: HTTP Bearer token via `apiKey`
- **Routing**: All routes scoped under `/v1/stores/{storeId}/...`
- **Config env vars**: `RAM_ENDPOINT` (serverURL), `RAM_API_KEY` (apiKey), `RAM_STORE_ID` (storeId)

### Cloud SDK API Surface

| Method                                   | HTTP   | Path                                                               | Purpose                                  |
| ---------------------------------------- | ------ | ------------------------------------------------------------------ | ---------------------------------------- |
| `health()`                               | GET    | `/health`                                                          | Service health                           |
| `listSessions(limit?, offset?)`          | GET    | `/v1/stores/{storeId}/session-memory`                              | Paginated session IDs                    |
| `addSessionEvent(request)`               | POST   | `/v1/stores/{storeId}/session-memory/events`                       | Append event; creates session implicitly |
| `getSessionMemory(sessionId)`            | GET    | `/v1/stores/{storeId}/session-memory/{sessionId}`                  | Full session + events                    |
| `deleteSessionMemory(sessionId)`         | DELETE | `/v1/stores/{storeId}/session-memory/{sessionId}`                  | Delete whole session                     |
| `getSessionEvent(sessionId, eventId)`    | GET    | `/v1/stores/{storeId}/session-memory/{sessionId}/events/{eventId}` | Get one event                            |
| `deleteSessionEvent(sessionId, eventId)` | DELETE | `/v1/stores/{storeId}/session-memory/{sessionId}/events/{eventId}` | Delete one event                         |
| `bulkCreateLongTermMemories(request)`    | POST   | `/v1/stores/{storeId}/long-term-memory`                            | Bulk create LTM                          |
| `bulkDeleteLongTermMemories(request)`    | DELETE | `/v1/stores/{storeId}/long-term-memory`                            | Bulk delete by IDs                       |
| `searchLongTermMemory(request?)`         | POST   | `/v1/stores/{storeId}/long-term-memory/search`                     | Semantic search + filters                |
| `getLongTermMemory(memoryId)`            | GET    | `/v1/stores/{storeId}/long-term-memory/{memoryId}`                 | Get one LTM                              |
| `updateLongTermMemory(memoryId, body?)`  | PATCH  | `/v1/stores/{storeId}/long-term-memory/{memoryId}`                 | Partial update LTM                       |

### Cloud SDK Key Types

```typescript
// Client configuration
type SDKOptions = {
  apiKey?: string | (() => Promise<string>);
  storeId?: string;
  serverURL: string;
  retryConfig?: RetryConfig;
  timeoutMs?: number;
};

// Session events (replaces "working memory messages")
type AddSessionEventRequestContent = {
  sessionId?: string; // optional; server generates if omitted
  actorId: string; // maps to userId concept
  role: MessageRole; // "user" | "assistant" | "system"
  content: Array<Content>; // [{ text: string }]
  createdAt: number; // unix ms
  metadata?: any; // max 15 key-value pairs
};

type SessionEvent = {
  eventId: string;
  actorId: string;
  sessionId: string;
  role: MessageRole;
  content: Array<Content>;
  createdAt: number;
  metadata?: any;
};

type GetSessionMemoryResponseContent = {
  sessionId: string;
  ownerId: string; // from first event's actorId
  events: Array<SessionEvent>;
};

// Long-term memory
type CreateMemoryRecord = {
  id: string; // client-generated, for idempotency
  text: string;
  memoryType?: MemoryType; // "semantic" | "episodic" | "message"
  sessionId?: string;
  ownerId?: string;
  namespace?: string;
  topics?: string[];
};

type MemoryRecord = {
  id: string;
  text: string;
  memoryType?: MemoryType;
  sessionId?: string;
  ownerId?: string;
  namespace?: string;
  topics?: string[];
  createdAt: number; // unix ms
  updatedAt: number; // unix ms
};

// Search filters use TagFilter and NumericFilter
type LongTermMemoryFilter = {
  sessionId?: TagFilter;
  ownerId?: TagFilter;
  namespace?: TagFilter;
  topics?: TagFilter;
  memoryType?: TagFilter;
  createdAt?: NumericFilter;
};

type TagFilter = { eq?: string; ne?: string; in?: string[]; all?: string[] };
type NumericFilter = {
  gt?: number;
  lt?: number;
  gte?: number;
  lte?: number;
  eq?: number;
};
type FilterConjunction = "all" | "any";

// Content is text-only for now
type Content = { text: string };
type MessageRole = "user" | "assistant" | "system";
```

---

## What the Cloud Product Actually Is (and Isn't)

### What it provides: Storage + Retrieval

The Redis Agent Memory cloud product is a **data store with semantic search**. It provides two storage tiers:

1. **Session Memory** -- an append-only event log per session
   - You add events one at a time (`addSessionEvent`)
   - You can retrieve all events for a session (`getSessionMemory`)
   - Sessions are created implicitly on first event
   - No windowing, no summarization, no processing

2. **Long-Term Memory** -- a searchable document store with vector embeddings
   - You manually create records (`bulkCreateLongTermMemories`)
   - You can semantic search (`searchLongTermMemory`)
   - You can update/delete records
   - The cloud handles embedding and indexing

### Background Extraction (Discovered via Testing)

The cloud product **does** have background extraction with built-in intelligence. When session events are inserted, the platform automatically extracts long-term memories after a delay of ~5-7 minutes. Observed behavior:

- Extracted memories have `memoryType: "episodic"`
- They reference the source `sessionId` and `ownerId`
- They include a `text_vector` (embedding is handled server-side)
- No `namespace` or `topics` are populated by the auto-extraction
- The extraction is not instant -- it runs asynchronously with a multi-minute delay
- There is no API to trigger or configure this extraction

**Deduplication & Contradiction Resolution (Confirmed via Testing):**

The cloud handles both deduplication and contradictions intelligently:

- **Deduplication**: Re-inserting identical session messages does NOT create duplicate LTMs. The count stays the same.
- **Contradiction resolution**: When new messages contradict earlier facts, existing LTM records are **updated in-place** (same `id`, same `createdAt`, new `updatedAt`). Examples observed:
  - "favorite language is TypeScript" → updated to "favorite programming language is Python"
  - "prefer dark mode" → updated to "prefers light mode"
  - "team uses LangGraph" → updated to "team uses CrewAI"
  - "meeting with VP tomorrow at 3pm" → updated to "meeting...was cancelled"
- Total LTM count remained at 8 despite 16 session events (8 original + 8 contradictions).
- The cloud understands negation, preference changes, and cancellation semantics.

**What the cloud extraction does NOT do:**

- No `topics` or `namespace` tagging on extracted memories
- No control over extraction granularity or prompt
- No session compaction (events accumulate until TTL)
- No way to trigger extraction on-demand

**Implication**: The cloud's extraction is significantly more capable than initially assumed. For this demo, we can likely **rely on cloud extraction for basic fact management** and only supplement with client-side logic for:
- Adding `topics`/`namespace` metadata to memories
- Providing immediate extraction (vs. waiting 5-7 min)
- Building memory prompts and summary views
- Managing session compaction

### What it does NOT provide: Intelligence APIs

The cloud product has **no intelligence APIs**. There is:

- **No summarization** -- there's no server-side summarization of sessions or memories. No summary views, no computed summaries.
- **No memory prompt** -- there's no endpoint that combines session + LTM into an LLM-ready prompt. You get raw data back; you format it yourself.
- **No context windowing** -- the server doesn't manage token budgets or trim old messages. It stores everything you send and returns everything you ask for.
- **No extraction configuration** -- extraction happens automatically with dedup/contradiction resolution, but there's no control over granularity, topic tagging, or what gets extracted.
- **No forget policies** -- no age-based, budget-based, or inactivity-based cleanup. You delete memories manually.
- **No task polling** -- no way to check extraction status or trigger it on-demand.

### Implication for this demo

In the OSS version, the Agent Memory Server was a **smart middleware** -- it stored data AND processed it (extraction, summarization, prompt building). The cloud version is **mostly storage** -- it stores, retrieves, and does basic background extraction (~5-7 min delay), but provides no APIs for summarization, prompt building, or extraction control.

This means **all intelligence must live in our code**:

| Responsibility                        | OSS: Who did it               | Cloud: Who does it                 |
| ------------------------------------- | ----------------------------- | ---------------------------------- |
| Store session messages                | AMS server                    | Cloud service                      |
| Store long-term memories              | AMS server                    | Cloud service                      |
| Semantic search                       | AMS server                    | Cloud service                      |
| Extract facts from conversation → LTM | AMS server (LLM call)         | Cloud (auto, ~5-7 min delay, with dedup + contradiction resolution) |
| Build LLM-ready prompt from memory    | AMS server (`/memory/prompt`) | **Our code** (fetch data + format) |
| Summarize memories into views         | AMS server (background task)  | **Our code** (OpenAI call)         |
| Manage context window / token budget  | AMS server                    | **Our code** (local counting)      |
| Deduplicate memories                  | AMS server (content hash)     | **Our code** (hash before create)  |
| Forget old/stale memories             | AMS server (policy engine)    | **Our code** (search + delete)     |

---

## Missing Features: What We Must Build

These features existed in the OSS Agent Memory Server but are **completely absent** from the cloud product. We must build custom logic for each one.

### 1. Memory Extraction (Critical -- core demo feature)

**What it is**: Automatically extract discrete facts/preferences/decisions from a conversation and persist them as long-term memories.

**Why it's critical**: Without this, long-term memory stays empty. The entire "memory gets smarter over time" narrative breaks.

**Our implementation**:

- Trigger: after last transcript chunk (or periodically during long conversations)
- Input: all session events for the current session
- Process: OpenAI call with extraction prompt
- Output: array of `{ text, topics, memoryType }` records
- Persist: `bulkCreateLongTermMemories`

### 2. Memory Prompt (Critical -- chatbot depends on it)

**What it is**: Combine relevant short-term context (session events) + long-term memories into a system prompt that an LLM can use to answer questions with full context.

**Why it's critical**: The chatbot uses `memoryPrompt` to get context before responding. Without it, the chatbot has no memory awareness.

**Our implementation**:

- Input: query string + session ID
- Process: fetch session events + search LTM for query + format into structured system message
- Output: `{ messages: [{ role: "system", content: "..." }] }`

### 3. Summary Views (Important -- demo panel feature)

**What it is**: Compute human-readable summaries of memories, grouped by session/user/topic.

**Why it's important**: The demo has a "Summaries" panel showing computed summaries per session and per user.

**Our implementation**:

- Store view definitions in Redis (JSON)
- On compute: search LTM with view filters → group → OpenAI summarize each group
- Cache results in Redis with TTL

### 4. Context Window Management (Moderate -- UI feature)

**What it is**: Track how much of the model's context window is used, trigger summarization when threshold reached.

**Why it matters**: Frontend shows a "context utilization" bar. OSS server returned `tokens`, `contextPercentageTotalUsed`, `contextPercentageUntilSummarization`.

**Our implementation**:

- Count tokens locally (character estimation: ~4 chars/token, or use `tiktoken`)
- Return computed values in `WorkingMemoryResult`

### 5. Forget Policies (Minor -- lifecycle/reset feature)

**What it is**: Delete memories matching criteria (age > N days, budget exceeded, etc.)

**Our implementation**:

- Search LTM with date filters
- Bulk delete matches
- Simple and straightforward

---

## Feature Gap Analysis (Detailed)

| Current Feature (OSS)                                                    | Cloud SDK Equivalent                                         | Gap Severity |
| ------------------------------------------------------------------------ | ------------------------------------------------------------ | ------------ |
| `putWorkingMemory` (full messages array + context + extraction strategy) | `addSessionEvent` (single event append)                      | **Critical** |
| `getWorkingMemory` (messages, context, tokens, contextPercentage)        | `getSessionMemory` (events array only)                       | **Moderate** |
| `getOrCreateWorkingMemory`                                               | `addSessionEvent` auto-creates; `getSessionMemory` for check | Minor        |
| `deleteWorkingMemory`                                                    | `deleteSessionMemory`                                        | Direct match |
| `listSessions` (namespace + userId scoping)                              | `listSessions` (storeId-scoped, limit/offset only)           | Moderate     |
| `memoryPrompt` (server-side LLM prompt from WM + LTM)                    | **MISSING**                                                  | **Critical** |
| `createLongTermMemories`                                                 | `bulkCreateLongTermMemories` (requires client `id`)          | Minor        |
| `searchLongTermMemory`                                                   | `searchLongTermMemory` (different filter syntax)             | Minor        |
| `searchAllLongTermMemories` (batched loop)                               | Paginate via `nextPageToken`                                 | Minor        |
| `getLongTermMemory`                                                      | `getLongTermMemory`                                          | Direct match |
| `editLongTermMemory`                                                     | `updateLongTermMemory`                                       | Direct match |
| `deleteLongTermMemories`                                                 | `bulkDeleteLongTermMemories`                                 | Direct match |
| `forgetLongTermMemories` (age/inactivity/budget policies)                | **MISSING**                                                  | Moderate     |
| Summary Views (CRUD + partitions + async run + tasks)                    | **MISSING**                                                  | **Critical** |
| `longTermMemoryStrategy` (DISCRETE extraction on PUT)                    | **MISSING**                                                  | **Critical** |

---

## Architecture Strategy

### Current Architecture (OSS mode -- being replaced)

```
Frontend (Next.js static)
  └─> Backend API (Express via cau-api-server)
        ├─> cau-redis-agent-memory (OSS client wrapper)
        │     └─> agent-memory-client SDK
        │           └─> Agent Memory Server (Docker, Python)
        │                 └─> Redis Stack
        └─> cau-redis (copilot stores, partition cleanup)
              └─> Redis (same instance or separate)
```

### Target Architecture

```
Frontend (Next.js static)
  └─> Backend API (Express via cau-api-server)
        ├─> cau-ram (NEW PACKAGE -- sole memory layer)
        │     ├─> @redis-ai/agent-memory SDK (cloud operations)
        │     │     └─> Redis Agent Memory Cloud (RAM_ENDPOINT)
        │     └─> Custom Logic (local LLM)
        │           └─> OpenAI API (extraction, memoryPrompt, summaries)
        └─> cau-redis (copilot stores, local state)
              └─> Redis (REDIS_URL -- still needed for app state)
```

### Key Design Decisions

1. **Cloud-only.** No dual-mode, no toggle, no fallback to OSS. The backend imports exclusively from `cau-ram`.

2. **Match cloud terminology.** Method names, types, and concepts align with the cloud SDK's language (session memory, events, actorId, storeId) -- not the old OSS naming. Less cognitive gap when reading cloud docs or debugging.

3. **Custom logic for "smart" features.** The cloud stores data; we add intelligence. Extraction, memoryPrompt, and summaries are built as custom operations that combine cloud data + OpenAI calls.

4. **Old package left for reference.** `cau-redis-agent-memory` stays in the repo but is no longer imported.

### Public Interface: `RedisAgentMemory` Class

```typescript
import { RedisAgentMemory } from "cau-ram";

// Initialize
RedisAgentMemory.create({
  endpoint: "https://gcp-us-east4.memory.redis.io",
  apiKey: "mem1_...",
  storeId: "store-abc",
  llm: {
    provider: "openai", // "openai" | "anthropic" | "google" | "azure" | etc.
    model: "gpt-4o-mini",
    apiKey: "sk-...",
  },
});

const ram = RedisAgentMemory.getInstance();

// ─── Cloud SDK Direct (Phase A) ───────────────────────────────
// Session memory
await ram.addSessionEvent({ sessionId, actorId, role, content, createdAt });
await ram.getSessionMemory(sessionId);
await ram.deleteSessionMemory(sessionId);
await ram.listSessions({ limit, offset });

// Long-term memory
await ram.createLongTermMemories(records);
await ram.searchLongTermMemory({ text, filter, limit });
await ram.getLongTermMemory(memoryId);
await ram.updateLongTermMemory(memoryId, updates);
await ram.deleteLongTermMemories(memoryIds);

// Health
await ram.health();

// ─── Custom Logic (Phase B) ──────────────────────────────────
// Extraction: session events → LTM via LLM
await ram.extractMemories(sessionId, { namespace, ownerId, topics });

// Memory prompt: combine session + LTM into LLM-ready messages
await ram.buildMemoryPrompt({ query, sessionId, longTermSearch });

// Summaries: compute summaries from LTM grouped by criteria
await ram.computeSummary({ viewId, group, filters });
await ram.listSummaryViews();

// Forget: search + bulk delete by policy
await ram.forgetMemories({ policy, filters });
```

### Package Structure

```
packages/
  cau-redis-agent-memory/          # EXISTING - deprecated, left for reference

  cau-ram/                         # NEW - Redis Agent Memory client
    package.json                   # @redis-ai/agent-memory, openai
    tsconfig.json
    vitest.config.ts
    src/
      index.ts                     # public exports
      redis-agent-memory.ts        # RedisAgentMemory singleton class
      config.ts                    # RAM_ENDPOINT, RAM_API_KEY, RAM_STORE_ID, OPENAI_API_KEY
      types.ts                     # all public types (fresh, cloud-native naming)
      constants.ts                 # enums (MemoryType, MessageRole, etc.)

      operations/                  # Direct cloud SDK wraps (Phase A)
        session-memory.ts          # addEvent, getSession, deleteSession, listSessions
        long-term-memory.ts        # create, search, get, update, delete

      custom/                      # Custom logic built on top (Phase B)
        extract-memories.ts        # session events → LLM → LTM records
        build-memory-prompt.ts     # session + LTM → formatted system prompt
        compute-summary.ts         # LTM → LLM → summary text
        forget-memories.ts         # policy → search → bulk delete

      helpers/
        map-records.util.ts        # cloud SDK types <-> package types
        build-filters.util.ts      # convert to TagFilter/NumericFilter
        token-counter.util.ts      # local token estimation
        llm.util.ts                # shared OpenAI call wrapper
```

---

## Terminology Mapping

| OSS Concept                      | Cloud Concept                                 | Notes                                                                                                     |
| -------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Working Memory                   | Session Memory                                | Entire paradigm shift: monolithic state vs event log                                                      |
| Working Memory messages          | Session Events                                | Messages were `{ role, content: string }`, events are `{ actorId, role, content: [{ text }], createdAt }` |
| `session_id`                     | `sessionId`                                   | Same concept, different casing in API                                                                     |
| `user_id` / `userId`             | `actorId` / `ownerId`                         | `ownerId` auto-set from first event's `actorId`                                                           |
| `namespace`                      | `namespace` (on LTM) / `storeId` (on routing) | Store provides tenant isolation; namespace is within-store grouping                                       |
| Memory extraction strategy       | N/A                                           | Must be emulated client-side                                                                              |
| Summary Views                    | N/A                                           | Must be emulated or disabled                                                                              |
| Memory Prompt                    | N/A                                           | Must be emulated client-side                                                                              |
| `context_window_max`             | N/A                                           | Cloud does no server-side windowing                                                                       |
| `model_name` (for summarization) | N/A                                           | Cloud does no server-side LLM calls for WM                                                                |

---

## Environment Variables

### Current (OSS mode)

```env
# App
MEETING_MEMORY_PORT=3001
MEETING_MEMORY_ACTIVE_DATASET=wealth-advisor
MEETING_MEMORY_MODEL_NAME=gpt-4o-mini
MEETING_MEMORY_CONTEXT_WINDOW_MAX=1500

# AMS connection (used by cau-redis-agent-memory)
AGENT_MEMORY_BASE_URL=http://localhost:8000
AGENT_MEMORY_API_KEY=            # optional
AGENT_MEMORY_BEARER_TOKEN=       # optional
AGENT_MEMORY_TIMEOUT_MS=30000

# Redis (for app's own stores + AMS container)
REDIS_URL=redis://localhost:6379

# AMS server config (passed to Docker container)
OPENAI_API_KEY=...
LONG_TERM_MEMORY=true
GENERATION_MODEL=gpt-4o-mini
```

### New (Cloud -- replaces OSS vars)

```env
# ── Required ──
OPENAI_API_KEY=sk-...

# ── App (backend) ──
MEETING_MEMORY_PORT=3001
MEETING_MEMORY_ACTIVE_DATASET=wealth-advisor
MEETING_MEMORY_CHATBOT_MODEL=gpt-4o-mini

# ── Redis Agent Memory Cloud ──
RAM_ENDPOINT=https://gcp-us-east4.memory.redis.io
RAM_API_KEY=mem1_...
RAM_STORE_ID=<store-id>

# ── LLM for summarization (uses OPENAI_API_KEY defined above) ──
SUMMARY_MODEL=gpt-4o-mini       # OpenAI model used for session summarization

# ── Redis (for app's copilot stores, topic stores, chunk stores) ──
REDIS_URL=redis://default:...@geese-crown-supersteady-16768.db.redis.io:18074

# ── LangSmith (optional) ──
LANGSMITH_API_KEY=lsv2_...
LANGSMITH_TRACING=true
```

**Removed** (no longer needed -- these were for the self-hosted AMS container):

- `AGENT_MEMORY_BASE_URL`
- `AGENT_MEMORY_API_KEY`
- `AGENT_MEMORY_BEARER_TOKEN`
- `AGENT_MEMORY_TIMEOUT_MS`
- `LONG_TERM_MEMORY`
- `GENERATION_MODEL`
- `FAST_MODEL`
- `EMBEDDING_MODEL`
- `LOG_LEVEL`
- `DISABLE_AUTH`

---

## Phased Implementation Plan

The plan is split into three stages -- demo code is NOT touched until Phase C:

- **Phase A (Core Package)**: Build `cau-ram` package wrapping cloud SDK features. Unit tests against real cloud endpoint. Zero demo code changes.
- **Phase B (Custom Logic)**: Build intelligence layer (extraction, memoryPrompt, summaries, forget) in the same package. Unit tests against real endpoint + LLM. Zero demo code changes.
- **Phase C (Backend Integration)**: Wire `cau-ram` into the demo backend, rewrite handlers, update config, cleanup Docker. All demo code changes happen here.

This ensures the package is fully developed and tested in isolation before touching any working demo code.

---

## PHASE A: Core Package (Cloud SDK Wraps)

> **No demo code changes in this phase.** All work is inside `packages/cau-ram/`.

### A1. Scaffold `cau-ram` Package

**Goal**: Package exists, builds, exports `RedisAgentMemory` class, connects to cloud.

**Create**: `packages/cau-ram/`

**Dependencies** (`package.json`):

- `@redis-ai/agent-memory` (cloud SDK, workspace)
- `@langchain/core` (base types + model abstraction)
- `@langchain/openai` (default provider -- others added as needed)
- `dotenv`

**Files to create**:

- `package.json` (name: `cau-ram`)
- `tsconfig.json`
- `vitest.config.ts`
- `src/index.ts` -- public exports
- `src/redis-agent-memory.ts` -- singleton class with stubs
- `src/config.ts` -- ENV: `RAM_ENDPOINT`, `RAM_API_KEY`, `RAM_STORE_ID`, `OPENAI_API_KEY`, `SUMMARY_MODEL`
- `src/types.ts` -- fresh types (cloud-native naming)
- `src/constants.ts` -- `MessageRole`, `MemoryType` enums
- `src/helpers/llm.util.ts` -- creates LangChain ChatModel from config

**Acceptance**: `RedisAgentMemory.create({ endpoint, apiKey, storeId })` connects and `ram.health()` returns `{ status: "ok" }` against the real cloud endpoint.

---

### A2. Session Memory Operations

**Goal**: Wrap cloud session memory APIs with ergonomic types.

**Methods on `RedisAgentMemory`**:

| Method                           | Cloud SDK call                          | Notes                                 |
| -------------------------------- | --------------------------------------- | ------------------------------------- |
| `addSessionEvent(params)`        | `client.addSessionEvent(request)`       | Wrap `content: string` → `[{ text }]` |
| `getSessionMemory(sessionId)`    | `client.getSessionMemory(sessionId)`    | Unwrap `[{ text }]` → `string`        |
| `deleteSessionMemory(sessionId)` | `client.deleteSessionMemory(sessionId)` | Direct                                |
| `listSessions(options?)`         | `client.listSessions(limit, offset)`    | Direct                                |

**Types** (fresh, cloud-native):

```typescript
type SessionEventInput = {
  sessionId: string;
  actorId: string;
  role: MessageRole; // "user" | "assistant" | "system"
  content: string; // we wrap into [{ text }] internally
  createdAt?: number; // defaults to Date.now()
  metadata?: Record<string, unknown>;
};

type SessionEvent = {
  eventId: string;
  sessionId: string;
  actorId: string;
  role: MessageRole;
  content: string; // unwrapped from [{ text }]
  createdAt: number;
  metadata?: Record<string, unknown>;
};

type SessionMemory = {
  sessionId: string;
  ownerId: string;
  events: SessionEvent[];
};

type SessionListResult = {
  sessions: string[];
  total: number;
};
```

**File**: `packages/cau-ram/src/operations/session-memory.ts`

**Test**: `addSessionEvent` → `getSessionMemory` → verify event appears → `deleteSessionMemory` → verify gone.

---

### A3. Long-Term Memory Operations

**Goal**: Wrap cloud LTM APIs with ergonomic filter syntax.

**Methods on `RedisAgentMemory`**:

| Method                                    | Cloud SDK call                                | Notes                                          |
| ----------------------------------------- | --------------------------------------------- | ---------------------------------------------- |
| `createLongTermMemories(records)`         | `client.bulkCreateLongTermMemories(...)`      | Auto-generates `id` (UUID) per record          |
| `searchLongTermMemory(options)`           | `client.searchLongTermMemory(request)`        | Maps our `MemoryFilter` to `TagFilter` objects |
| `searchAllLongTermMemory(options)`        | Loop with `nextPageToken`                     | Fetches all pages into flat array              |
| `getLongTermMemory(memoryId)`             | `client.getLongTermMemory(memoryId)`          | Direct                                         |
| `updateLongTermMemory(memoryId, updates)` | `client.updateLongTermMemory(memoryId, body)` | Direct                                         |
| `deleteLongTermMemories(memoryIds)`       | `client.bulkDeleteLongTermMemories(...)`      | Direct                                         |

**Types**:

```typescript
type CreateMemoryInput = {
  text: string;
  memoryType?: MemoryType; // "semantic" | "episodic" | "message"
  sessionId?: string;
  ownerId?: string;
  namespace?: string;
  topics?: string[];
};

type MemoryRecord = {
  id: string;
  text: string;
  memoryType?: MemoryType;
  sessionId?: string;
  ownerId?: string;
  namespace?: string;
  topics?: string[];
  createdAt: number;
  updatedAt: number;
};

type MemorySearchOptions = {
  text?: string;
  filter?: MemoryFilter;
  filterOp?: "all" | "any";
  limit?: number;
  pageToken?: string;
  similarityThreshold?: number;
};

// Ergonomic filter -- we convert to TagFilter/NumericFilter internally
type MemoryFilter = {
  sessionId?: string; // shorthand → { eq: value }
  ownerId?: string;
  namespace?: string;
  topics?: string[]; // shorthand → { all: values }
  memoryType?: MemoryType;
  createdAfter?: number; // unix ms → { gt: value }
  createdBefore?: number; // unix ms → { lt: value }
};

type MemorySearchResult = {
  memories: MemoryRecord[];
  nextPageToken?: string;
};
```

**Helper**: `build-filters.util.ts` converts `MemoryFilter` → cloud `LongTermMemoryFilter`:

```
filter.sessionId = "abc"     → { sessionId: { eq: "abc" } }
filter.ownerId = "user1"     → { ownerId: { eq: "user1" } }
filter.topics = ["a", "b"]   → { topics: { all: ["a", "b"] } }
filter.namespace = "ns"      → { namespace: { eq: "ns" } }
filter.createdAfter = 123    → { createdAt: { gt: 123 } }
```

**File**: `packages/cau-ram/src/operations/long-term-memory.ts`

**Test**: `createLongTermMemories` → `searchLongTermMemory` → verify found → `deleteLongTermMemories` → verify gone.

---

### A4. Unit Tests (Core Operations)

**Goal**: Comprehensive tests proving all Phase A operations work against the real Redis Agent Memory cloud.

**Test file**: `packages/cau-ram/src/operations/__tests__/session-memory.test.ts`

```typescript
describe("session memory operations", () => {
  it("should add event and retrieve session");
  it("should list sessions after creation");
  it("should delete session");
  it("should handle non-existent session gracefully");
});
```

**Test file**: `packages/cau-ram/src/operations/__tests__/long-term-memory.test.ts`

```typescript
describe("long-term memory operations", () => {
  it("should create memories and return records with IDs");
  it("should search by text and find relevant memories");
  it("should search with filters (namespace, ownerId, sessionId)");
  it("should paginate with searchAll");
  it("should get single memory by ID");
  it("should update memory text/topics");
  it("should delete memories by IDs");
});
```

**Test config**: Tests use real env vars (`RAM_ENDPOINT`, `RAM_API_KEY`, `RAM_STORE_ID`) from `.env` or test env. Each test cleans up after itself.

**Acceptance**: All tests pass against real cloud. Package core is production-ready.

---

## PHASE B: Custom Logic (Intelligence Layer)

All Phase B operations are implemented inside `packages/cau-ram/`. They use data from Phase A (session events + LTM) combined with LLM calls. **No demo code changes in this phase.**

**Dependencies already in place** from Phase A1: `@langchain/core`, `@langchain/openai` (or other provider package).

---

### B1. Memory Extraction

**Goal**: Extract facts from session conversations into long-term memory.

**Trigger** (in Phase C): Called by the backend after the last transcript chunk (replaces OSS `longTermMemoryStrategy`).

**Method**: `ram.extractMemories(sessionId, options)`

**Implementation** (`packages/cau-ram/src/custom/extract-memories.ts`):

```typescript
type ExtractionOptions = {
  namespace?: string;
  ownerId?: string;
  topics?: string[]; // seed topics from transcript metadata
};

type ExtractionResult = {
  created: MemoryRecord[];
  count: number;
};

// Uses LangChain's withStructuredOutput for reliable JSON extraction
const extractMemories = async (
  sessionId,
  options,
): Promise<ExtractionResult> => {
  // 1. Get all session events
  const session = await ram.getSessionMemory(sessionId);
  const transcript = formatEventsAsTranscript(session.events);

  // 2. Call LLM with structured output (works with any LangChain provider)
  const extractionSchema = z.object({
    facts: z.array(
      z.object({
        text: z.string(),
        topics: z.array(z.string()),
      }),
    ),
  });

  const structuredLlm = llm.withStructuredOutput(extractionSchema);
  const result = await structuredLlm.invoke([
    { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
    { role: "user", content: transcript },
  ]);

  // 3. Store in LTM
  const records = result.facts.map((f) => ({
    text: f.text,
    topics: f.topics ?? options.topics,
    sessionId,
    ownerId: options.ownerId,
    namespace: options.namespace,
    memoryType: "semantic",
  }));

  return await ram.createLongTermMemories(records);
};
```

**Phase C usage**: `appendWorkingMemoryHandler` calls `ram.extractMemories(sessionId, ...)` when `isLastChunk === true`.

**Unit test**: Create a session with events → call `extractMemories` → verify LTM records appear with extracted facts and topics.

---

### B2. Build Memory Prompt

**Goal**: Combine session context + relevant LTM into a system prompt for the chatbot.

**Method**: `ram.buildMemoryPrompt(request)`

**Implementation** (`packages/cau-ram/src/custom/build-memory-prompt.ts`):

```typescript
type MemoryPromptRequest = {
  query: string;
  sessionId?: string;
  longTermSearch?: MemoryFilter | boolean;
};

type MemoryPromptResult = {
  messages: Array<{ role: string; content: string }>;
};

const buildMemoryPrompt = async (request): Promise<MemoryPromptResult> => {
  // 1. Get session context (short-term)
  let conversationContext = "";
  if (request.sessionId) {
    const session = await ram.getSessionMemory(request.sessionId);
    conversationContext = formatEventsAsDialogue(session.events);
  }

  // 2. Search long-term memory
  let longTermContext = "";
  if (request.longTermSearch) {
    const filter =
      request.longTermSearch === true ? {} : request.longTermSearch;
    const results = await ram.searchLongTermMemory({
      text: request.query,
      filter,
      limit: 10,
    });
    longTermContext = formatMemoriesAsBullets(results.memories);
  }

  // 3. Compose system prompt
  const systemContent = MEMORY_PROMPT_TEMPLATE.replace(
    "{{conversation}}",
    conversationContext,
  )
    .replace("{{longTermMemory}}", longTermContext)
    .replace("{{query}}", request.query);

  return { messages: [{ role: "system", content: systemContent }] };
};
```

**Phase C usage**: Chatbot's `getMemoryContext` tool calls `ram.buildMemoryPrompt(...)`.

**Unit test**: Populate session + LTM → call `buildMemoryPrompt` → verify system message contains both conversation context and LTM facts.

---

### B3. Summary Views

**Goal**: Compute summaries from LTM grouped by session/user/topic.

**Methods**:

- `ram.createSummaryView(definition)` -- store view definition
- `ram.listSummaryViews()` -- list stored definitions
- `ram.getSummaryView(viewId)` -- get one definition
- `ram.deleteSummaryView(viewId)` -- remove definition
- `ram.computeSummary(viewId, group)` -- compute summary for one group
- `ram.listSummaryPartitions(viewId)` -- get cached summaries

**Implementation** (`packages/cau-ram/src/custom/compute-summary.ts`):

- View definitions stored in Redis as JSON (`summary-view:{viewId}`)
- On `computeSummary`: search LTM → group by view fields → OpenAI summarize → cache in Redis
- Partition results cached in Redis (`summary-partition:{viewId}:{groupKey}`)
- Compute on-demand (no background tasks needed for demo)

**Note**: This feature requires `cau-redis` (Redis access) as a peer dependency.

**Unit test**: Create view → populate LTM → compute summary → verify summary text is coherent and cached.

---

### B4. Forget Memories

**Goal**: Delete memories matching policy criteria.

**Method**: `ram.forgetMemories(policy, filters?)`

**Implementation** (`packages/cau-ram/src/custom/forget-memories.ts`):

```typescript
type ForgetPolicy = {
  age?: { days: number };
  budget?: { maxMemories: number };
};

type ForgetResult = {
  deleted: number;
  scanned: number;
};

const forgetMemories = async (policy, filters?): Promise<ForgetResult> => {
  let searchFilter: MemoryFilter = { ...filters };

  if (policy.age) {
    const cutoff = Date.now() - policy.age.days * 24 * 60 * 60 * 1000;
    searchFilter.createdBefore = cutoff;
  }

  const all = await ram.searchAllLongTermMemory({ filter: searchFilter });
  let toDelete = all.memories;

  if (policy.budget) {
    // Keep most recent N, delete the rest
    toDelete = all.memories
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(0, Math.max(0, all.memories.length - policy.budget.maxMemories));
  }

  if (toDelete.length > 0) {
    await ram.deleteLongTermMemories(toDelete.map((m) => m.id));
  }

  return { deleted: toDelete.length, scanned: all.memories.length };
};
```

**Unit test**: Create old memories → call `forgetMemories` with age policy → verify deleted. Test budget policy keeps N most recent.

---

### B5. Unit Tests (Custom Logic)

**Goal**: Comprehensive tests for all custom intelligence features against real cloud + LLM.

**Test file**: `packages/cau-ram/src/custom/__tests__/extract-memories.test.ts`

```typescript
describe("extractMemories", () => {
  it("should extract facts from session transcript into LTM");
  it("should tag extracted memories with topics");
  it("should handle empty session gracefully");
});
```

**Test file**: `packages/cau-ram/src/custom/__tests__/build-memory-prompt.test.ts`

```typescript
describe("buildMemoryPrompt", () => {
  it("should include session context in prompt");
  it("should include relevant LTM in prompt");
  it("should work with session-only (no LTM search)");
  it("should work with LTM-only (no session)");
});
```

**Test file**: `packages/cau-ram/src/custom/__tests__/forget-memories.test.ts`

```typescript
describe("forgetMemories", () => {
  it("should delete memories older than age policy");
  it("should keep N most recent with budget policy");
  it("should report deleted + scanned counts");
});
```

**Test file**: `packages/cau-ram/src/custom/__tests__/compute-summary.test.ts`

```typescript
describe("summaryViews", () => {
  it("should create and retrieve view definition");
  it("should compute summary from LTM records");
  it("should cache computed summary");
});
```

**Test config**: Tests use real env vars (`RAM_ENDPOINT`, `RAM_API_KEY`, `RAM_STORE_ID`, `OPENAI_API_KEY`, `SUMMARY_MODEL`). Each test cleans up created data.

**Acceptance**: All custom logic tests pass. Package is fully production-ready. Ready for demo integration.

---

## PHASE C: Backend Integration

**Prerequisite**: Phase A + B complete. `cau-ram` package is fully implemented and tested.

**Goal**: Wire `cau-ram` into the demo backend. This is the ONLY phase that changes demo code.

---

### C1. Backend Dependency Swap

1. **`backend/package.json`**: Add `cau-ram` as workspace dep, remove `cau-redis-agent-memory`
2. **`backend/src/config.ts`**: Add `RAM_ENDPOINT`, `RAM_API_KEY`, `RAM_STORE_ID`, `OPENAI_API_KEY`, `SUMMARY_MODEL`; remove `AGENT_MEMORY_*`
3. **`backend/src/index.ts`**: Initialize:
   ```typescript
   import { RedisAgentMemory } from "cau-ram";
   RedisAgentMemory.create({
     endpoint: ENV.RAM_ENDPOINT,
     apiKey: ENV.RAM_API_KEY,
     storeId: ENV.RAM_STORE_ID,
     llm: {
       model: ENV.SUMMARY_MODEL,
       apiKey: ENV.OPENAI_API_KEY,
     },
   });
   await RedisAgentMemory.getInstance().health();
   ```

---

### C2. Handler Rewrites

Method names change to match cloud (see Migration Reference table below):

- `working-memory.handlers.ts` → uses `addSessionEvent`, `getSessionMemory`, `deleteSessionMemory`, `listSessions`
- `long-term-memory.handlers.ts` → uses `searchLongTermMemory`, `searchAllLongTermMemory`
- `lifecycle.handlers.ts` → uses `deleteLongTermMemories`, `deleteSessionMemory`, `forgetMemories`
- `summary-views.handlers.ts` → uses `createSummaryView`, `computeSummary`, `listSummaryPartitions`

---

### C3. Chatbot Integration

- `chatbot-agent/tools.ts`: `getMemoryContext` tool calls `ram.buildMemoryPrompt(...)`
- `chatbot-agent/graph.ts`: Import from `cau-ram`
- On `isLastChunk`, call `ram.extractMemories(...)` instead of relying on `longTermMemoryStrategy`

---

### C4. Cleanup and Deployment

- Remove `agent-memory` service from `docker-compose.yml`
- Remove all AMS-related env vars
- Update `.env.example` with cloud vars
- Remove `ams-partition-cleanup.ts` usage
- Simpler stack: Node app + Redis (for copilot stores)

---

### C5. Full End-to-End Verification

Verify the full demo flow:

- Transcript playback → session events → extraction → LTM populated
- Memory explorer shows extracted LTM records
- Chatbot uses `buildMemoryPrompt` and answers with memory context
- Summary views compute and display
- Lifecycle reset clears sessions + LTM
- No OSS AMS dependency anywhere
- Update README with cloud setup instructions

---

## Backend Method Name Migration Reference

Old calls (OSS, `cau-redis-agent-memory`) → New calls (`cau-ram`):

| Old                                                    | New                                                         |
| ------------------------------------------------------ | ----------------------------------------------------------- |
| `import { AgentMemory } from "cau-redis-agent-memory"` | `import { RedisAgentMemory } from "cau-ram"`                |
| `AgentMemory.getInstance()`                            | `RedisAgentMemory.getInstance()`                            |
| `.getOrCreateWorkingMemory(sessionId, opts)`           | `.getSessionMemory(sessionId)` (returns null if not exists) |
| `.getWorkingMemory(sessionId, opts)`                   | `.getSessionMemory(sessionId)`                              |
| `.putWorkingMemory(sessionId, payload, opts)`          | `.addSessionEvent(eventInput)` (one per new message)        |
| `.deleteWorkingMemory(sessionId, opts)`                | `.deleteSessionMemory(sessionId)`                           |
| `.listSessions(opts)`                                  | `.listSessions(opts)`                                       |
| `.createLongTermMemories(records, opts)`               | `.createLongTermMemories(records)`                          |
| `.searchLongTermMemory(opts)`                          | `.searchLongTermMemory(opts)`                               |
| `.searchAllLongTermMemories(opts)`                     | `.searchAllLongTermMemory(opts)`                            |
| `.getLongTermMemory(id)`                               | `.getLongTermMemory(id)`                                    |
| `.editLongTermMemory(id, updates)`                     | `.updateLongTermMemory(id, updates)`                        |
| `.deleteLongTermMemories(ids)`                         | `.deleteLongTermMemories(ids)`                              |
| `.memoryPrompt(request)`                               | `.buildMemoryPrompt(request)`                               |
| `.forgetLongTermMemories(policy, opts)`                | `.forgetMemories(policy, filters)`                          |
| `.createSummaryView(...)`                              | `.createSummaryView(...)`                                   |
| `.listSummaryViews()`                                  | `.listSummaryViews()`                                       |
| `.runSummaryViewPartition(...)`                        | `.computeSummary(...)`                                      |
| `.listSummaryViewPartitions(...)`                      | `.listSummaryPartitions(...)`                               |

---

## File Change Summary

| Phase | Area                                            | Files Affected                              | Change Type     |
| ----- | ----------------------------------------------- | ------------------------------------------- | --------------- |
| A+B   | `packages/cau-ram/` (NEW)                       | ~20-25 files (ops, custom, tests, config)   | **New package** |
| --    | `packages/cau-redis-agent-memory/`              | **None** -- left untouched                  | No change       |
| C     | `backend/package.json`                          | Replace dep with `cau-ram`                  | Dependency swap |
| C     | `backend/src/config.ts`                         | Replace `AGENT_MEMORY_*` vars with `RAM_*`  | Rewrite config  |
| C     | `backend/src/index.ts`                          | `RedisAgentMemory.create(...)`              | Rewrite init    |
| C     | `backend/src/handlers/*.ts`                     | Import from `cau-ram`, use new method names | Rewrite         |
| C     | `backend/src/chatbot-agent/tools.ts`            | Import from `cau-ram`, use new method names | Rewrite         |
| C     | `backend/src/chatbot-agent/graph.ts`            | Import from `cau-ram`                       | Rewrite         |
| C     | `backend/src/services/ams-partition-cleanup.ts` | Remove                                      | Deletion        |
| C     | `.env` / `.env.example`                         | Replace AMS vars with cloud vars            | Rewrite         |
| C     | `docker-compose.yml`                            | Remove `agent-memory` service               | Simplification  |

---

## Risks and Open Questions

1. **Cloud SDK is beta (v0.0.1)** -- API surface may change. Pin exact version.

2. **`storeId` provisioning** -- How is a store created? Confirm with engineering team. Assume separate identifier for now.

3. **Context window estimation** -- Frontend shows utilization bar. We estimate tokens locally (~4 chars/token or `tiktoken`).

4. **Extraction quality** -- Custom prompt needs tuning. Advantage: iterate faster, customize per-dataset.

5. **Deduplication** -- Use client-generated `id` as content hash for idempotency on LTM create.

6. **Summary Views** -- Requires Redis for storage (via `cau-redis`). Meaningful effort but doable.

7. **Event-append latency** -- Sequential `addSessionEvent` calls. Consider `Promise.all` if API supports concurrent writes.

---

## Migration Checklist

### Phase A: Core Package (Cloud SDK Wraps) -- DONE

- [x] A1: Scaffold `packages/cau-ram/` (package.json, tsconfig, index.ts, config, singleton)
- [x] A1: `ram.health()` works against real cloud endpoint
- [x] A2: `addSessionEvent` / `getSessionMemory` / `getSessionEvent` / `deleteSessionEvent` / `deleteSessionMemory` / `listSessions`
- [x] A3: `createLongTermMemories` / `searchLongTermMemory` / `searchAllLongTermMemory`
- [x] A3: `getLongTermMemory` / `updateLongTermMemory` / `deleteLongTermMemories`
- [x] A4: All session memory unit tests pass against real cloud (9 tests)
- [x] A4: All long-term memory unit tests pass against real cloud (8 tests)

### Phase B: Custom Logic (Intelligence Layer)

- ~~B1: `extractMemories` -- LLM extraction + structured output + bulkCreate~~ **NOT NEEDED** -- cloud handles extraction automatically (with dedup + contradiction resolution, ~5-7 min delay)
- [x] B2: `buildMemoryPrompt` -- session + LTM search + token budgeting + LLM summarization (8 tests pass)
- ~~B3: Summary views -- create/list/compute/cache in Redis~~ **NOT NEEDED** -- will hide feature in UI; modern LLM context windows are large enough for demo
- [x] B4: `forgetMemories` -- search + bulk delete by policy
- [x] B5: All custom logic unit tests pass (prompt, forget)

### Phase C: Backend Integration

- [ ] C1: Backend dependency swap (`cau-ram` replaces `cau-redis-agent-memory`)
- [ ] C1: Config rewritten (RAM_* + LLM_* vars)
- [ ] C1: `RedisAgentMemory.create(...)` + health check on startup
- [ ] C2: All handlers rewritten to use `cau-ram` method names
- [ ] C3: Chatbot tools use `buildMemoryPrompt`
- [ ] C4: Docker cleaned, `.env.example` updated, `ams-partition-cleanup` removed
- [ ] C5: Full demo end-to-end verification
- [ ] C5: README updated with cloud setup instructions

---

## Architecture: `buildMemoryPrompt` (Phase B2)

### What it solves

The OSS Agent Memory Server had a `/v1/memory/prompt` endpoint that combined session history + long-term memories into an LLM-ready message list. The cloud RAM product has no equivalent — it only stores and retrieves data. `buildMemoryPrompt` replicates this intelligence locally in the `cau-ram` package.

### High-level flow

```mermaid
flowchart TD
    Caller["Chatbot / Suggestion Agent"] -->|"buildMemoryPrompt(options)"| BMP["buildMemoryPrompt"]
    BMP --> Parallel["Parallel fetch"]
    Parallel --> FetchSession["getSessionMemory(sessionId)"]
    Parallel --> SearchLTM["searchLongTermMemory(query, filters)"]
    FetchSession --> TokenBudget["Token budget engine"]
    SearchLTM --> TokenBudget
    TokenBudget --> Decision{Session over budget?}
    Decision -->|No| Assemble["Assemble context"]
    Decision -->|Yes| Summarize["Summarize old messages (LLM call)"]
    Summarize --> Assemble
    Assemble --> Result["MemoryPromptResult"]
    Result --> Caller
```

### Input

```typescript
buildMemoryPrompt({
  query: "What did we discuss about the roadmap?",
  sessionId: "session-abc",
  ownerId: "user-123",
  namespace: "work",
  modelName: "gpt-4o",
  contextWindowMax: 128000,
  longTermSearch: true,  // or MemorySearchOptions for custom filters
})
```

- `query` — the user's current question (used for LTM semantic search + included in output)
- `sessionId` — which session's messages to include
- `ownerId` — scopes LTM search to this user's memories
- `namespace` — scopes LTM search to a logical group (e.g., "work", "personal")
- `modelName` / `contextWindowMax` — determines token budget
- `longTermSearch` — `true` (auto-search with ownerId/namespace filters), custom `MemorySearchOptions`, or `false` (skip LTM)

### Output

```typescript
{
  context: string;          // full assembled text, ready to inject as system message
  sessionSummary?: string;  // LLM-generated summary (if compression was needed)
  recentSessionEvents: [...];  // session events that fit within budget
  longTermMemories: [...];  // LTM search results (never trimmed)
  tokenUsage: { budget: 128000, used: 45000 }
}
```

The `context` field is structured:

```
[Session Summary]
The user previously discussed TypeScript preferences, Redis demos, and a roadmap meeting...

[Recent Conversation]
user: What features should we showcase?
assistant: Session memory, LTM extraction, and semantic search.

[Relevant Memories]
- Prasan's favorite programming language is Python [episodic]
- Prasan works at Redis as a developer advocate [episodic]
- Prasan enjoys hiking on weekends [semantic, topics: hobbies, outdoor]

[Current Query]
What did we discuss about the roadmap?
```

### Token budget strategy

LTM results and query are **never trimmed** (caller controls LTM count via `limit`). Only session data is compressed:

1. Count tokens: query + LTM (fixed cost)
2. Remaining budget = `contextWindowMax` - fixed cost
3. If session fits → use all messages
4. If session exceeds → summarize oldest messages via LLM, keep recent
5. If still over → drop more recent messages until fits

```mermaid
flowchart LR
    Budget["Total Token Budget"] --> LTM_Block["LTM Results (fixed, never trimmed)"]
    Budget --> Query_Block["Query (fixed)"]
    Budget --> Session_Block["Session (compressible)"]
    Session_Block --> Summary["Old msgs → LLM summary"]
    Session_Block --> Recent["Recent msgs kept as-is"]
```

### Dependencies

- `js-tiktoken` — accurate token counting (cl100k_base encoding)
- `@langchain/core` + `@langchain/openai` — LLM calls for summarization
- LLM config from `RedisAgentMemoryConfig.llm` (provider, model, apiKey)

### How it's consumed in the demo

**Chatbot agent** (`tools.ts`): The `getMemoryContext` tool calls `buildMemoryPrompt` and returns `result.context` as tool output for the ReAct loop.

**Suggestion agent** (`generate-suggestion.ts`): Injects `result.context` as a system message before generating suggestions.

Both use cases get a single, token-safe string that fits within the model's context window.
