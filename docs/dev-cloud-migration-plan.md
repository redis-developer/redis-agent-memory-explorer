# Migration Plan: OSS Agent Memory Server → Redis Agent Memory Cloud

## Overview

This document describes the migration path from the **open-source Agent Memory Server** (self-hosted, `agent-memory-client` npm SDK, Docker image `redislabs/agent-memory-server`) to the **Redis Agent Memory** cloud product (`@redis-ai/agent-memory` TypeScript SDK v0.0.1).

The cloud product is being built by the core engineering team as a managed service. It will eventually deprecate the open-source version. Its APIs are different, and it currently lacks some features that the OSS version provides (summary views, memory prompt, extraction strategies, forget policies).

### Strategy: New Package (`cau-redis-agent-memory-cloud`)

Create a **new package** `cau-redis-agent-memory-cloud` that fully replaces `cau-redis-agent-memory`:

- Wraps the `@redis-ai/agent-memory` cloud SDK
- **Builds custom logic** for features the cloud doesn't have (memoryPrompt, extraction, summary views) using the data we already have from the cloud + local LLM calls
- Backend imports **only** from this new package (no toggle, no dual-mode)
- The old `cau-redis-agent-memory` package is left in place but unused (can be removed later)

**Why custom logic works**: The cloud SDK gives us full access to session events (short-term) and long-term memories. The OSS server's "smart" features (memoryPrompt, extraction, summaries) were just LLM calls over that same data. We can replicate and even improve on them locally.

---

## Cloud SDK Reference

- **Package**: `@redis-ai/agent-memory` (v0.0.1, Speakeasy-generated)
- **Source**: `/Users/prasanrajpurohit/Downloads/agent-memory-ts-sdk`
- **Auth**: HTTP Bearer token via `apiKey`
- **Routing**: All routes scoped under `/v1/stores/{storeId}/...`
- **Config env vars**: `RAM_ENDPOINT` (serverURL), `RAM_API_KEY` (apiKey), `RAM_STORE_ID` (storeId)

### Cloud SDK API Surface

| Method | HTTP | Path | Purpose |
|--------|------|------|---------|
| `health()` | GET | `/health` | Service health |
| `listSessions(limit?, offset?)` | GET | `/v1/stores/{storeId}/session-memory` | Paginated session IDs |
| `addSessionEvent(request)` | POST | `/v1/stores/{storeId}/session-memory/events` | Append event; creates session implicitly |
| `getSessionMemory(sessionId)` | GET | `/v1/stores/{storeId}/session-memory/{sessionId}` | Full session + events |
| `deleteSessionMemory(sessionId)` | DELETE | `/v1/stores/{storeId}/session-memory/{sessionId}` | Delete whole session |
| `getSessionEvent(sessionId, eventId)` | GET | `/v1/stores/{storeId}/session-memory/{sessionId}/events/{eventId}` | Get one event |
| `deleteSessionEvent(sessionId, eventId)` | DELETE | `/v1/stores/{storeId}/session-memory/{sessionId}/events/{eventId}` | Delete one event |
| `bulkCreateLongTermMemories(request)` | POST | `/v1/stores/{storeId}/long-term-memory` | Bulk create LTM |
| `bulkDeleteLongTermMemories(request)` | DELETE | `/v1/stores/{storeId}/long-term-memory` | Bulk delete by IDs |
| `searchLongTermMemory(request?)` | POST | `/v1/stores/{storeId}/long-term-memory/search` | Semantic search + filters |
| `getLongTermMemory(memoryId)` | GET | `/v1/stores/{storeId}/long-term-memory/{memoryId}` | Get one LTM |
| `updateLongTermMemory(memoryId, body?)` | PATCH | `/v1/stores/{storeId}/long-term-memory/{memoryId}` | Partial update LTM |

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
  sessionId?: string;       // optional; server generates if omitted
  actorId: string;          // maps to userId concept
  role: MessageRole;        // "user" | "assistant" | "system"
  content: Array<Content>;  // [{ text: string }]
  createdAt: number;        // unix ms
  metadata?: any;           // max 15 key-value pairs
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
  ownerId: string;    // from first event's actorId
  events: Array<SessionEvent>;
};

// Long-term memory
type CreateMemoryRecord = {
  id: string;               // client-generated, for idempotency
  text: string;
  memoryType?: MemoryType;  // "semantic" | "episodic" | "message"
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
  createdAt: number;  // unix ms
  updatedAt: number;  // unix ms
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
type NumericFilter = { gt?: number; lt?: number; gte?: number; lte?: number; eq?: number };
type FilterConjunction = "all" | "any";

// Content is text-only for now
type Content = { text: string };
type MessageRole = "user" | "assistant" | "system";
```

---

## Feature Gap Analysis

| Current Feature (OSS) | Cloud SDK Equivalent | Gap Severity |
|---|---|---|
| `putWorkingMemory` (full messages array + context + extraction strategy) | `addSessionEvent` (single event append) | **Critical** |
| `getWorkingMemory` (messages, context, tokens, contextPercentage) | `getSessionMemory` (events array only) | **Moderate** |
| `getOrCreateWorkingMemory` | `addSessionEvent` auto-creates; `getSessionMemory` for check | Minor |
| `deleteWorkingMemory` | `deleteSessionMemory` | Direct match |
| `listSessions` (namespace + userId scoping) | `listSessions` (storeId-scoped, limit/offset only) | Moderate |
| `memoryPrompt` (server-side LLM prompt from WM + LTM) | **MISSING** | **Critical** |
| `createLongTermMemories` | `bulkCreateLongTermMemories` (requires client `id`) | Minor |
| `searchLongTermMemory` | `searchLongTermMemory` (different filter syntax) | Minor |
| `searchAllLongTermMemories` (batched loop) | Paginate via `nextPageToken` | Minor |
| `getLongTermMemory` | `getLongTermMemory` | Direct match |
| `editLongTermMemory` | `updateLongTermMemory` | Direct match |
| `deleteLongTermMemories` | `bulkDeleteLongTermMemories` | Direct match |
| `forgetLongTermMemories` (age/inactivity/budget policies) | **MISSING** | Moderate |
| Summary Views (CRUD + partitions + async run + tasks) | **MISSING** | **Critical** |
| `longTermMemoryStrategy` (DISCRETE extraction on PUT) | **MISSING** | **Critical** |

---

## Architecture Strategy

### Current Architecture (OSS mode)

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
        ├─> cau-redis-agent-memory-cloud (NEW PACKAGE -- sole memory layer)
        │     ├─> @redis-ai/agent-memory SDK
        │     │     └─> Redis Agent Memory Cloud (RAM_ENDPOINT)
        │     └─> Custom Logic Layer (local LLM)
        │           └─> OpenAI API (memoryPrompt, extraction, summaries)
        └─> cau-redis (copilot stores, local state)
              └─> Redis (REDIS_URL -- still needed for app state)
```

### Key Design Decisions

1. **Cloud-only.** No dual-mode, no toggle, no fallback to OSS. The backend imports exclusively from `cau-redis-agent-memory-cloud`.

2. **Custom logic for "smart" features.** Since the cloud SDK provides raw data access (session events + long-term memories), we build memoryPrompt, extraction, and summaries ourselves using OpenAI. This gives us full control and the ability to customize behavior beyond what OSS offered.

3. **Same public interface.** `cau-redis-agent-memory-cloud` exports an `AgentMemory` class with the same method signatures as the old package. Backend handler code requires minimal changes (just update import paths).

4. **Old package left in place.** `cau-redis-agent-memory` stays in the repo untouched (for reference / rollback if needed) but is no longer imported by the backend.

### Package Structure

```
packages/
  cau-redis-agent-memory/          # EXISTING - left untouched (deprecated, for reference)

  cau-redis-agent-memory-cloud/    # NEW - sole memory package
    src/
      index.ts                     # public exports
      agent-memory.ts              # AgentMemory singleton (cloud)
      config.ts                    # RAM_ENDPOINT, RAM_API_KEY, RAM_STORE_ID
      types.ts                     # public types (mirrored from old package)
      constants.ts                 # enums (MemoryType, ExtractionStrategy, etc.)
      operations/
        working-memory.ts          # session event operations
        long-term-memory.ts        # LTM CRUD + search
        memory-prompt.ts           # CUSTOM: build LLM prompt from session + LTM
        summary-view.ts            # CUSTOM: compute summaries from LTM
        forget.ts                  # CUSTOM: search + bulk delete by policy
        extraction.ts              # CUSTOM: extract facts from session into LTM
      helpers/
        map-records.util.ts        # cloud SDK types <-> package types
        build-search-filters.util.ts
        token-counter.util.ts      # local token estimation for context window
        llm.util.ts                # shared OpenAI call helper
    package.json                   # @redis-ai/agent-memory, openai
```

---

## Terminology Mapping

| OSS Concept | Cloud Concept | Notes |
|---|---|---|
| Working Memory | Session Memory | Entire paradigm shift: monolithic state vs event log |
| Working Memory messages | Session Events | Messages were `{ role, content: string }`, events are `{ actorId, role, content: [{ text }], createdAt }` |
| `session_id` | `sessionId` | Same concept, different casing in API |
| `user_id` / `userId` | `actorId` / `ownerId` | `ownerId` auto-set from first event's `actorId` |
| `namespace` | `namespace` (on LTM) / `storeId` (on routing) | Store provides tenant isolation; namespace is within-store grouping |
| Memory extraction strategy | N/A | Must be emulated client-side |
| Summary Views | N/A | Must be emulated or disabled |
| Memory Prompt | N/A | Must be emulated client-side |
| `context_window_max` | N/A | Cloud does no server-side windowing |
| `model_name` (for summarization) | N/A | Cloud does no server-side LLM calls for WM |

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
MEETING_MEMORY_MODEL_NAME=gpt-4o-mini
MEETING_MEMORY_CONTEXT_WINDOW_MAX=1500
MEETING_MEMORY_CHATBOT_MODEL=gpt-4o-mini

# ── Redis Agent Memory Cloud ──
RAM_ENDPOINT=https://gcp-us-east4.memory.redis.io
RAM_API_KEY=mem1_...
RAM_STORE_ID=<store-id>

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

### Phase 1: Scaffold `cau-redis-agent-memory-cloud` Package

**Goal**: Create the new package with its dependency tree and shared type contract.

**New folder**: `packages/cau-redis-agent-memory-cloud/`

**Structure**:
```
packages/cau-redis-agent-memory-cloud/
  package.json            # name: "cau-redis-agent-memory-cloud"
  tsconfig.json
  vitest.config.ts
  src/
    index.ts              # public exports (AgentMemory, types, constants)
    agent-memory.ts       # AgentMemory singleton class (cloud impl)
    config.ts             # RAM_ENDPOINT, RAM_API_KEY, RAM_STORE_ID, OPENAI_API_KEY
    types.ts              # re-export or mirror types from cau-redis-agent-memory
    constants.ts          # re-export or mirror constants
    operations/
      working-memory.ts
      long-term-memory.ts
      memory-prompt.ts
      summary-view.ts
      forget.ts
    emulation/
      memory-extraction.service.ts   # local LLM fact extraction
      memory-prompt.service.ts       # local memoryPrompt builder
      summary-view.service.ts        # local summary computation (optional)
    helpers/
      map-records.util.ts            # cloud SDK types <-> package types
      build-search-filters.util.ts   # convert to TagFilter/NumericFilter
      token-counter.util.ts          # local token estimation
```

**Dependencies** (`package.json`):
- `@redis-ai/agent-memory` (cloud SDK)
- `openai` (for emulation layer)
- `dotenv`

**Type contract**: The public `types.ts` and `constants.ts` must export identical shapes to `cau-redis-agent-memory` so the backend can swap imports without type errors. Options:
- Copy the types (simpler, no cross-package dependency)
- Extract shared types into a tiny `cau-redis-agent-memory-types` package (cleaner long-term)

**Recommendation**: Copy types initially (faster to ship), extract later if needed.

**Acceptance**: Package builds, exports `AgentMemory` class with all method stubs (throwing "not implemented").

---

### Phase 2: Working Memory → Session Memory Operations

**Goal**: Implement cloud working memory operations using the event-append model.

**The fundamental paradigm shift**:
- OSS: `putWorkingMemory(sessionId, { messages: [...allMessages], context, strategy })` -- send full state, server manages windowing/summarization/extraction
- Cloud: `addSessionEvent(event)` -- append one event at a time, no server-side intelligence

**Implementation approach**:

1. **`putWorkingMemory` adaptation**:
   - Fetch current session events via `getSessionMemory`
   - Diff against incoming messages to find new ones (compare by content/role/index)
   - Call `addSessionEvent` for each new message not already in the session
   - Return a synthesized `WorkingMemoryResult` with messages mapped from events
   - Token counting / context percentage computed locally (character-based estimation or `tiktoken`)
   - If `longTermMemoryStrategy` is set, trigger local extraction (Phase 4b) asynchronously

2. **`getWorkingMemory` adaptation**:
   - Call `getSessionMemory(sessionId)`
   - Map `SessionEvent[]` → `WorkingMemoryResult.messages` (unwrap `content[].text` to string)
   - Compute `tokens` / `context` locally

3. **`getOrCreateWorkingMemory` adaptation**:
   - Try `getSessionMemory(sessionId)` -- if 404, return `{ created: true, memory: emptyResult }`
   - Otherwise map to `WorkingMemoryResult` and return `{ created: false, memory }`

4. **`deleteWorkingMemory`**: Direct → `deleteSessionMemory(sessionId)`

5. **`listSessions`**: Direct → `listSessions(limit, offset)` (namespace/userId filtering not available -- storeId provides isolation)

**Files**:
- `packages/cau-redis-agent-memory-cloud/src/operations/working-memory.ts`
- `packages/cau-redis-agent-memory-cloud/src/helpers/map-records.util.ts`
- `packages/cau-redis-agent-memory-cloud/src/helpers/token-counter.util.ts`

---

### Phase 3: Long-Term Memory Operations

**Goal**: Implement LTM operations with the cloud SDK's filter/pagination model.

**Mappings**:
- `createLongTermMemories(records)` → `bulkCreateLongTermMemories({ memories: records.map(r => ({ id: crypto.randomUUID(), ...r })) })`
- `searchLongTermMemory(options)` → `searchLongTermMemory({ text, filter: { sessionId: { eq }, ownerId: { eq }, namespace: { eq }, topics: { all } }, limit })`
- `searchAllLongTermMemories(options)` → loop with `nextPageToken` until no more pages
- `getLongTermMemory(id)` → `getLongTermMemory(id)`
- `editLongTermMemory(id, updates)` → `updateLongTermMemory(id, { text?, topics? })`
- `deleteLongTermMemories(ids)` → `bulkDeleteLongTermMemories({ memoryIds: ids })`

**Filter syntax conversion** (old → new):
```
SessionId("abc")        → { sessionId: { eq: "abc" } }
UserId("user1")         → { ownerId: { eq: "user1" } }
Topics(["a", "b"])      → { topics: { all: ["a", "b"] } }
Namespace("ns")         → { namespace: { eq: "ns" } }
CreatedAt(">", date)    → { createdAt: { gt: dateMs } }
```

**Files**:
- `packages/cau-redis-agent-memory-cloud/src/operations/long-term-memory.ts`
- `packages/cau-redis-agent-memory-cloud/src/helpers/build-search-filters.util.ts`

---

### Phase 4: Custom Logic for "Smart" Features

The cloud SDK gives us raw data (session events + long-term memories). The OSS server's "smart" features were just LLM calls over that same data. We build them ourselves -- with full control over prompts, models, and behavior.

#### Phase 4a: Memory Prompt (Custom Logic)

**What it does**: Combines conversation context (short-term) + relevant long-term memories into a ready-to-use LLM prompt for the chatbot.

**How we build it**:
1. Fetch session events via `getSessionMemory(sessionId)` -- this is our short-term context
2. Run `searchLongTermMemory({ text: query })` -- this finds relevant long-term facts
3. Compose a system message that includes:
   - Recent conversation (last N events, formatted as dialogue)
   - Relevant long-term memories as structured context (bullet points)
   - Optional: user preferences / key facts section
4. Return `{ messages: [{ role: "system", content: composedPrompt }] }`

**Advantages over OSS**: We control the prompt template, can customize per-dataset, can add weighting/prioritization logic, and can tune the balance between short-term vs long-term context.

**File**: `packages/cau-redis-agent-memory-cloud/src/operations/memory-prompt.ts`

```typescript
// Pseudocode
const memoryPromptOp = async (client, request) => {
  const sessionEvents = await client.getSessionMemory(request.session.sessionId);
  const ltmResults = await client.searchLongTermMemory({ text: request.query, limit: 10 });

  const conversationContext = formatEventsAsDialogue(sessionEvents.events);
  const longTermContext = formatMemoriesAsBullets(ltmResults.memories);

  const systemPrompt = `
You are a helpful assistant with access to conversation history and long-term memory.

## Recent Conversation
${conversationContext}

## Relevant Knowledge (from long-term memory)
${longTermContext}

Use the above context to answer the user's question accurately.
`;

  return { messages: [{ role: "system", content: systemPrompt }] };
};
```

#### Phase 4b: Long-Term Memory Extraction (Custom Logic)

**What it does**: After a conversation (or on the last transcript chunk), extract discrete facts/preferences/decisions into long-term memory.

**How we build it**:
1. Triggered when `putWorkingMemory` is called with `longTermMemoryStrategy: { strategy: "discrete" }`
2. Gather all session events for this session
3. Call OpenAI with a structured extraction prompt
4. Parse response into individual memory records
5. Call `bulkCreateLongTermMemories` to persist them

**Extraction prompt approach**:
```
Given the following conversation transcript, extract key facts that should be
remembered long-term. Focus on:
- User preferences and constraints
- Decisions made
- Important facts mentioned
- Action items or commitments
- Personal details shared

Return as JSON array: [{ "text": "...", "topics": ["..."] }]
```

**Advantages over OSS**: We can customize extraction prompts per dataset/vertical (e.g., wealth-advisor extracts different things than a support agent), add confidence scoring, filter duplicates before storing.

**File**: `packages/cau-redis-agent-memory-cloud/src/operations/extraction.ts`

#### Phase 4c: Summary Views (Custom Logic)

**What it does**: Computes structured summaries of memories grouped by session/user/topic.

**How we build it**:
1. Store view definitions locally (in Redis via `cau-redis`, or in-memory for demo)
2. When a summary is requested:
   - Search LTM with the view's filters (session, user, namespace, topic)
   - Group results by the view's `groupBy` fields
   - For each group, call OpenAI to summarize the memories into a paragraph
3. Cache computed summaries in Redis (with TTL)

**Simplified approach for demo**:
- View definitions stored as JSON in Redis (key: `summary-view:{viewId}`)
- Partition results stored in Redis (key: `summary-partition:{viewId}:{group}`)
- Compute on-demand when requested (no background tasks needed for demo)

**File**: `packages/cau-redis-agent-memory-cloud/src/operations/summary-view.ts`

#### Phase 4d: Forget Policy (Custom Logic)

**What it does**: Deletes memories matching age/inactivity/budget criteria.

**How we build it**:
1. Parse the policy (e.g., `{ age: { days: 30 } }` or `{ budget: { maxMemories: 100 } }`)
2. Search LTM with appropriate date filters (`createdAt: { lt: cutoffMs }`)
3. Collect matching memory IDs
4. Call `bulkDeleteLongTermMemories({ memoryIds: [...] })`
5. Return `{ deleted: count, scanned: total }`

**File**: `packages/cau-redis-agent-memory-cloud/src/operations/forget.ts`

---

### Phase 5: AgentMemory Singleton (Cloud Version)

**Goal**: The cloud package's `AgentMemory` class provides the same interface as the old one.

**Pattern**:
```typescript
import { AgentMemory as CloudSDK } from "@redis-ai/agent-memory";
import OpenAI from "openai";
import { ENV } from "./config";

class AgentMemory {
  private static instance: AgentMemory;
  private client: CloudSDK;
  private openai: OpenAI;

  static create(config?: AgentMemoryConfig): AgentMemory {
    const client = new CloudSDK({
      serverURL: config?.baseUrl ?? ENV.RAM_ENDPOINT,
      apiKey: config?.apiKey ?? ENV.RAM_API_KEY,
      storeId: config?.storeId ?? ENV.RAM_STORE_ID,
      timeoutMs: config?.timeout ?? ENV.RAM_TIMEOUT_MS,
    });
    const openai = new OpenAI({ apiKey: ENV.OPENAI_API_KEY });
    // ... instantiate singleton
  }

  static getInstance(): AgentMemory { ... }

  // Cloud SDK direct calls
  async healthCheck() { return this.client.health(); }
  async getWorkingMemory(sessionId, options) { ... }
  async putWorkingMemory(sessionId, payload, options) { ... }
  async listSessions(options) { ... }
  async searchLongTermMemory(options) { ... }
  async createLongTermMemories(memories, options) { ... }
  async deleteLongTermMemories(ids) { ... }

  // Custom logic (uses cloud data + OpenAI)
  async memoryPrompt(request) { ... }
  async extractMemories(sessionId, options) { ... }
  async computeSummary(viewId, group) { ... }
  async forgetLongTermMemories(policy, options) { ... }
}
```

**File**: `packages/cau-redis-agent-memory-cloud/src/agent-memory.ts`

---

### Phase 6: Backend Integration

**Goal**: Replace all `cau-redis-agent-memory` imports with `cau-redis-agent-memory-cloud`.

Since this is cloud-only (no toggle), the change is straightforward:

1. **`backend/package.json`**: Replace `cau-redis-agent-memory` dependency with `cau-redis-agent-memory-cloud`
2. **All handler files**: Find-and-replace import path:
   ```
   - import { AgentMemory, ExtractionStrategy } from "cau-redis-agent-memory";
   + import { AgentMemory, ExtractionStrategy } from "cau-redis-agent-memory-cloud";
   ```
3. **`backend/src/index.ts`**: Update the `AgentMemory.create()` call with cloud config:
   ```typescript
   AgentMemory.create({
     baseUrl: ENV.RAM_ENDPOINT,
     apiKey: ENV.RAM_API_KEY,
     storeId: ENV.RAM_STORE_ID,
   });
   ```
4. **`backend/src/config.ts`**: Replace `AGENT_MEMORY_BASE_URL` with `RAM_ENDPOINT`, `RAM_API_KEY`, `RAM_STORE_ID`
5. **Remove `ams-partition-cleanup.ts`** usage (no AMS Redis keys to clean)

**Files changed**:
- `backend/package.json`
- `backend/src/config.ts`
- `backend/src/index.ts`
- `backend/src/handlers/working-memory.handlers.ts`
- `backend/src/handlers/long-term-memory.handlers.ts`
- `backend/src/handlers/summary-views.handlers.ts`
- `backend/src/handlers/lifecycle.handlers.ts`
- `backend/src/chatbot-agent/tools.ts`
- `backend/src/chatbot-agent/graph.ts`

---

### Phase 7: Docker / Deployment Updates

- Remove `agent-memory` service from `docker-compose.yml` entirely (no longer needed)
- Remove AMS-related env vars (`LONG_TERM_MEMORY`, `GENERATION_MODEL`, `FAST_MODEL`, `EMBEDDING_MODEL`, `LOG_LEVEL`, `DISABLE_AUTH`)
- Update `.env.example` with cloud variables (`RAM_ENDPOINT`, `RAM_API_KEY`, `RAM_STORE_ID`)
- The app still needs Redis (`REDIS_URL`) for copilot stores, topic stores, chunk stores
- Simpler deployment: just the Node app + Redis (no Python AMS container)

---

### Phase 8: Scoping / Multi-Tenancy Mapping

| Dimension | OSS Approach | Cloud Approach |
|---|---|---|
| Tenant isolation | `namespace` filter on all operations | `storeId` in URL path (server-enforced) |
| User scoping | `user_id` query param (Redis key component) | `actorId` on events; `ownerId` filter on LTM |
| Session scoping | `session_id` | `sessionId` |

**Mapping strategy**:
- One `storeId` = one deployment/demo instance (configured via `RAM_STORE_ID`)
- `namespace` from dataset config → `namespace` field on LTM records (preserved)
- `userId` → `actorId` when adding events, `ownerId` filter when searching LTM

---

### Phase 9: Chatbot Tools Verification

The LangGraph chatbot tools (`backend/src/chatbot-agent/tools.ts`) call:
- `AgentMemory.getInstance().searchLongTermMemory(...)` -- works via cloud operations
- `AgentMemory.getInstance().memoryPrompt(...)` -- works via custom logic (Phase 4a)
- `AgentMemory.getInstance().getWorkingMemory(...)` -- works via Phase 2
- `AgentMemory.getInstance().listSessions(...)` -- works via Phase 2
- `AgentMemory.getInstance().listSummaryViews(...)` -- works via custom logic (Phase 4c)

No changes needed to tool definitions since the cloud package exposes the same method signatures.

---

## File Change Summary

| Area | Files Affected | Change Type |
|---|---|---|
| `packages/cau-redis-agent-memory-cloud/` (NEW) | All files in the new package (~15-20 files) | **New package** |
| `packages/cau-redis-agent-memory/` | **None** -- left untouched | No change |
| `backend/package.json` | Replace `cau-redis-agent-memory` dep with `cau-redis-agent-memory-cloud` | Dependency swap |
| `backend/src/config.ts` | Replace `AGENT_MEMORY_*` vars with `RAM_*` | Rewrite config section |
| `backend/src/index.ts` | Update `AgentMemory.create()` with cloud config | Minor edit |
| `backend/src/handlers/*.ts` | Change import path to `cau-redis-agent-memory-cloud` | Import path update |
| `backend/src/chatbot-agent/tools.ts` | Change import path | Import path update |
| `backend/src/chatbot-agent/graph.ts` | Change import path + config | Import path update |
| `backend/src/services/ams-partition-cleanup.ts` | Remove or dead-code (no AMS keys to clean) | Removal |
| Root `package.json` | Workspaces already includes `packages/*` | No change |
| `.env` / `.env.example` | Replace AMS vars with cloud vars | Rewrite |
| `docker-compose.yml` | Remove `agent-memory` service | Simplification |

---

## Risks and Open Questions

1. **Cloud SDK is beta (v0.0.1)** -- API surface may change. Pin exact version. Watch for breaking changes.

2. **`storeId` provisioning** -- How is a store created? Is it linked to the `REDIS_URL` database? Need to confirm with engineering team. For now, assume it's a separate identifier provided at cloud setup.

3. **No server-side context windowing** -- The OSS server returns `tokens`, `contextPercentageTotalUsed`, `contextPercentageUntilSummarization`. We must compute these locally. The frontend uses these for the context utilization bar -- we can estimate with character count or use `tiktoken`.

4. **Extraction quality** -- Our custom extraction prompt needs tuning to match OSS quality. Advantage: we can iterate on prompts faster and customize per-dataset.

5. **Deduplication** -- OSS supports content-hash deduplication server-side on LTM create. Cloud SDK has no equivalent. Implement client-side: hash `text` field, check existing before bulk create, or use the client-generated `id` field as a content hash for idempotency.

6. **Summary Views scope** -- Full implementation requires Redis storage for view definitions + partition caches + OpenAI for summarization. Meaningful engineering effort but doable since we already have `cau-redis` for Redis access.

7. **Event-append ordering** -- The cloud SDK appends events one at a time. If the backend sends multiple events rapidly (e.g., batch playback), ordering is guaranteed by sequential awaits but latency increases. Consider batching multiple `addSessionEvent` calls with `Promise.all` if the API supports concurrent writes to the same session.

---

## Migration Checklist

### Package Creation (Phase 1)
- [ ] Scaffold `packages/cau-redis-agent-memory-cloud/` (package.json, tsconfig, index.ts)
- [ ] Install `@redis-ai/agent-memory` + `openai` as dependencies
- [ ] Copy/mirror types and constants from old package
- [ ] Implement config (`RAM_ENDPOINT`, `RAM_API_KEY`, `RAM_STORE_ID`, `OPENAI_API_KEY`)
- [ ] Implement `AgentMemory` singleton with cloud SDK client instantiation
- [ ] Implement `healthCheck`

### Core Operations (Phases 2-3)
- [ ] Implement session memory operations (get, put via event-append, getOrCreate, delete, list)
- [ ] Implement local token counting / context window estimation
- [ ] Implement LTM create (bulk, with client-generated IDs)
- [ ] Implement LTM search (new TagFilter syntax, pageToken pagination)
- [ ] Implement LTM searchAll (loop with pageToken)
- [ ] Implement LTM get / edit / delete

### Custom Logic (Phase 4)
- [ ] Build memoryPrompt: fetch session + search LTM + compose system prompt via OpenAI
- [ ] Build extraction: gather session events + OpenAI extraction + bulkCreate LTM
- [ ] Build summary views: store definitions + compute via OpenAI + cache results
- [ ] Build forget: search by policy criteria + bulk delete

### Backend Integration (Phases 5-7)
- [ ] Replace `cau-redis-agent-memory` import with `cau-redis-agent-memory-cloud` in all handler files
- [ ] Update `backend/src/config.ts` with `RAM_*` env vars
- [ ] Update `backend/src/index.ts` AgentMemory.create() call
- [ ] Update chatbot tools and graph imports
- [ ] Remove `ams-partition-cleanup.ts` usage
- [ ] Remove `agent-memory` service from `docker-compose.yml`
- [ ] Update `.env` / `.env.example`

### Verification (Phases 8-9)
- [ ] Test session create + append + get flow
- [ ] Test LTM extraction on last transcript chunk
- [ ] Test LTM search from memory explorer panel
- [ ] Test memoryPrompt via chatbot
- [ ] Test summary views computation
- [ ] Test lifecycle reset (delete sessions + LTM)
- [ ] Test full demo end-to-end
- [ ] Update README with cloud setup instructions
