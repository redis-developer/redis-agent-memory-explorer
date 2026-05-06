# Migration Plan: OSS Agent Memory Server → Redis Agent Memory Cloud

## Overview

This document describes the migration path from the **open-source Agent Memory Server** (self-hosted, `agent-memory-client` npm SDK, Docker image `redislabs/agent-memory-server`) to the **Redis Agent Memory** cloud product (`@redis-ai/agent-memory` TypeScript SDK v0.0.1).

The cloud product is being built by the core engineering team as a managed service. It will eventually deprecate the open-source version. Its APIs are different, and it currently lacks some features that the OSS version provides (summary views, memory prompt, extraction strategies, forget policies).

### Strategy: New Package (`cau-redis-agent-memory-cloud`)

Rather than rewriting the existing `cau-redis-agent-memory` package (which works fine for OSS), we create a **new parallel package** `cau-redis-agent-memory-cloud` that:

- Wraps the `@redis-ai/agent-memory` cloud SDK
- Exposes the **same public interface** as `cau-redis-agent-memory` (same types, same method signatures)
- Handles all cloud-specific adaptation (event-append model, local emulation of missing features)
- Allows both packages to coexist in the monorepo
- Backend swaps which package it imports based on `MEMORY_PROVIDER` config

This keeps the OSS package untouched (no regression risk) and provides a clean separation for the cloud path.

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

### Target Architecture (Cloud mode)

```
Frontend (Next.js static)
  └─> Backend API (Express via cau-api-server)
        ├─> cau-redis-agent-memory-cloud (NEW PACKAGE)
        │     ├─> @redis-ai/agent-memory SDK (cloud)
        │     │     └─> Redis Agent Memory Cloud (RAM_ENDPOINT)
        │     └─> Local LLM Emulation Layer
        │           └─> OpenAI API (for extraction, memoryPrompt, summaries)
        └─> cau-redis (copilot stores, local state)
              └─> Redis (REDIS_URL -- still needed for app state)
```

### Key Design Decisions

1. **New package, not a rewrite.** Create `packages/cau-redis-agent-memory-cloud/` as a brand-new package. The existing `cau-redis-agent-memory` stays untouched -- zero regression risk for OSS mode.

2. **Same public interface.** `cau-redis-agent-memory-cloud` exports the same `AgentMemory` class, same method signatures, same return types. Backend code can swap imports with no logic changes.

3. **Backend uses conditional import.** Based on `MEMORY_PROVIDER` env var, the backend imports from either `cau-redis-agent-memory` (OSS) or `cau-redis-agent-memory-cloud` (cloud). This swap happens at startup in one place (`backend/src/index.ts` or a new provider factory).

4. **Both packages coexist.** During transition, both packages live in `packages/`. When OSS is fully deprecated, `cau-redis-agent-memory` can be removed.

### Package Relationship

```
packages/
  cau-redis-agent-memory/          # EXISTING - untouched, works with OSS AMS
    src/
      agent-memory.ts              # AgentMemory class (OSS)
      operations/                  # OSS operation implementations
      types.ts                     # Public types (SHARED CONTRACT)
      constants.ts                 # Enums (SHARED CONTRACT)

  cau-redis-agent-memory-cloud/    # NEW - cloud adapter
    src/
      agent-memory.ts              # AgentMemory class (cloud) -- same interface
      operations/                  # Cloud operation implementations
      emulation/                   # Local LLM emulation (memoryPrompt, extraction, summaries)
      types.ts                     # Re-exports same types for compatibility
      constants.ts                 # Re-exports same constants
    package.json                   # depends on @redis-ai/agent-memory, openai
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

### New (Cloud mode additions)

```env
# Provider toggle
MEMORY_PROVIDER=cloud   # "oss" | "cloud"

# Redis Agent Memory Cloud
RAM_ENDPOINT=https://gcp-us-east4.memory.redis.io
RAM_API_KEY=mem1_...
RAM_STORE_ID=<store-id>   # TBD: may be derived from REDIS_URL or separately provisioned

# Redis (still needed for copilot stores, topic stores, chunk stores)
REDIS_URL=redis://default:...@geese-crown-supersteady-16768.db.redis.io:18074

# OpenAI (needed for local emulation of extraction/memoryPrompt/summaries)
OPENAI_API_KEY=...
```

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

### Phase 4: Local Emulation of Missing Features

#### Phase 4a: Memory Prompt Emulation

**What `memoryPrompt` does in OSS**: Server-side endpoint that combines working memory context + long-term memory search into a ready-to-use LLM prompt (array of `{ role, content }` messages).

**Local emulation**:
1. Call `getSessionMemory` to get recent conversation events
2. Call `searchLongTermMemory` with the query
3. Build system messages containing:
   - Conversation context (last N events summarized)
   - Relevant long-term memories as bullet points
4. Return `{ messages: [{ role: "system", content: "..." }] }`

**File**: `packages/cau-redis-agent-memory-cloud/src/emulation/memory-prompt.service.ts`

#### Phase 4b: LTM Extraction Emulation

**What `longTermMemoryStrategy: { strategy: "discrete" }` does in OSS**: Server triggers an LLM call to extract discrete facts/preferences from working memory into long-term memory.

**Local emulation**:
1. After `putWorkingMemory` is called with a strategy, gather all session events
2. Call OpenAI with a fact-extraction system prompt:
   ```
   Extract key facts, user preferences, decisions, and important information
   from the following conversation. Return each fact as a separate line.
   ```
3. Parse the response into individual memory records
4. Call `bulkCreateLongTermMemories` with extracted facts (tagged with sessionId, namespace, ownerId)

**File**: `packages/cau-redis-agent-memory-cloud/src/emulation/memory-extraction.service.ts`

#### Phase 4c: Summary Views

**Options**:
- **Option A (full emulation)**: Store view definitions in Redis (app's `REDIS_URL`), compute summaries via OpenAI, store results in Redis hashes. Maintains full demo functionality.
- **Option B (graceful degradation)**: Return empty/stub responses in cloud mode; frontend shows "Summary Views not available in cloud mode" or hides the panel.

**Recommendation**: Option B initially (stubs that return empty arrays), upgrade to Option A if demo requires it.

**File**: `packages/cau-redis-agent-memory-cloud/src/operations/summary-view.ts` (stubs or full emulation)

#### Phase 4d: Forget Policy Emulation

**Local emulation**:
1. Search LTM with date/session filters matching the policy criteria
2. Collect all matching memory IDs
3. Bulk delete matching records
4. Return counts matching the `ForgetResult` shape

**File**: `packages/cau-redis-agent-memory-cloud/src/operations/forget.ts`

---

### Phase 5: AgentMemory Singleton (Cloud Version)

**Goal**: The cloud package's `AgentMemory` class mirrors the OSS one's interface.

**Pattern**:
```typescript
import { AgentMemory as CloudSDK } from "@redis-ai/agent-memory";
import { ENV } from "./config";

class AgentMemory {
  private static instance: AgentMemory;
  private client: CloudSDK;

  static create(config?: AgentMemoryConfig): AgentMemory { ... }
  static getInstance(): AgentMemory { ... }

  async healthCheck(): Promise<HealthResult> {
    const res = await this.client.health();
    return { status: res.status };
  }

  async getWorkingMemory(sessionId, options) { ... }
  async putWorkingMemory(sessionId, payload, options) { ... }
  async getOrCreateWorkingMemory(sessionId, options) { ... }
  // ... all other methods using cloud operations
}
```

**File**: `packages/cau-redis-agent-memory-cloud/src/agent-memory.ts`

---

### Phase 6: Backend Provider Swap

**Goal**: Backend dynamically imports the correct package based on `MEMORY_PROVIDER`.

**Implementation** in `backend/src/index.ts` (or a new `backend/src/memory-provider.ts`):

```typescript
// backend/src/memory-provider.ts
import { ENV } from "./config";

const loadAgentMemory = async () => {
  if (ENV.MEMORY_PROVIDER === "cloud") {
    const { AgentMemory } = await import("cau-redis-agent-memory-cloud");
    return AgentMemory;
  }
  const { AgentMemory } = await import("cau-redis-agent-memory");
  return AgentMemory;
};
```

**Changes**:
- `backend/package.json` -- add `cau-redis-agent-memory-cloud` as workspace dependency
- `backend/src/config.ts` -- add `MEMORY_PROVIDER` to `ENV`
- `backend/src/index.ts` -- use dynamic import or provider factory
- All handler files that import `from "cau-redis-agent-memory"` -- import from the factory instead

**Alternative** (simpler): Use a barrel re-export:
```typescript
// backend/src/agent-memory.ts (new file -- single import point)
export { AgentMemory, ExtractionStrategy, ... } from ENV.MEMORY_PROVIDER === "cloud"
  ? "cau-redis-agent-memory-cloud"
  : "cau-redis-agent-memory";
```

Then all handlers import from `"../agent-memory"` instead of the package directly.

---

### Phase 7: Docker / Deployment Updates

- Create `docker-compose.cloud.yml` override that omits the `agent-memory` service
- Update `.env.example` with new cloud variables (`MEMORY_PROVIDER`, `RAM_ENDPOINT`, `RAM_API_KEY`, `RAM_STORE_ID`)
- The app still needs local Redis (`REDIS_URL`) for copilot stores, topic stores, chunk stores
- `ams-partition-cleanup.ts` skipped in cloud mode (no AMS Redis keys exist)
- Cloud mode: `docker compose -f docker-compose.yml -f docker-compose.cloud.yml up`

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
- `AgentMemory.getInstance().memoryPrompt(...)` -- works via Phase 4a emulation
- `AgentMemory.getInstance().getWorkingMemory(...)` -- works via Phase 2
- `AgentMemory.getInstance().listSessions(...)` -- works via Phase 2
- `AgentMemory.getInstance().listSummaryViews(...)` -- works via Phase 4c (stubs or emulation)

No changes needed to tool definitions since the cloud package exposes the same interface.

---

## File Change Summary

| Area | Files Affected | Change Type |
|---|---|---|
| `packages/cau-redis-agent-memory-cloud/` (NEW) | All files in the new package | **New package** |
| `packages/cau-redis-agent-memory/` | **None** -- untouched | No change |
| `backend/package.json` | Add `cau-redis-agent-memory-cloud` workspace dep | Addition |
| `backend/src/config.ts` | Add `MEMORY_PROVIDER` | Minor addition |
| `backend/src/index.ts` or new `memory-provider.ts` | Dynamic import based on provider | New file or minor edit |
| `backend/src/handlers/*.ts` | Change import source to provider factory | Import path update |
| `backend/src/chatbot-agent/tools.ts` | Change import source to provider factory | Import path update |
| Root `package.json` | Workspaces already includes `packages/*` | No change |
| `.env.example` | Add cloud variables | Addition |
| `docker-compose.yml` / `docker-compose.cloud.yml` | Cloud override without AMS container | New file |

---

## Risks and Open Questions

1. **Cloud SDK is beta (v0.0.1)** -- API surface may change. Pin exact version. Watch for breaking changes.

2. **`storeId` provisioning** -- How is a store created? Is it linked to the `REDIS_URL` database? Need to confirm with engineering team. For now, assume it's a separate identifier provided at cloud setup.

3. **No server-side context windowing** -- The OSS server manages `context_window_max` and returns `tokens`, `contextPercentageTotalUsed`, `contextPercentageUntilSummarization`. In cloud mode, these must be computed locally or stubbed. The frontend uses these for the context utilization bar.

4. **Extraction latency** -- Local extraction (Phase 4b) adds an OpenAI round-trip that previously happened asynchronously server-side. Consider running it in a background task (existing task polling infrastructure).

5. **Summary Views complexity** -- Full local emulation is significant engineering effort. If the cloud team plans to add this feature soon, consider Option B (disable/stubs) for now.

6. **`deduplicate` flag on LTM creation** -- OSS supports content-hash deduplication server-side. Cloud SDK has no equivalent. Must implement client-side dedup if needed (hash text before bulk create, skip duplicates).

7. **AMS partition cleanup** -- `backend/src/services/ams-partition-cleanup.ts` does direct Redis SCAN/DEL on `summary_view:*` keys. Not needed in cloud mode. The backend provider swap should skip this service initialization.

8. **Type drift** -- If `cau-redis-agent-memory` types evolve, the cloud package's copied types must stay in sync. Consider a shared types package long-term.

---

## Migration Checklist

- [ ] Scaffold `packages/cau-redis-agent-memory-cloud/` (package.json, tsconfig, index.ts, stubs)
- [ ] Install `@redis-ai/agent-memory` + `openai` as dependencies in new package
- [ ] Copy/mirror types and constants from `cau-redis-agent-memory`
- [ ] Implement config (`RAM_ENDPOINT`, `RAM_API_KEY`, `RAM_STORE_ID`)
- [ ] Implement `AgentMemory` singleton with cloud SDK client instantiation
- [ ] Implement cloud working memory operations (event-append model)
- [ ] Implement cloud LTM operations (new filter syntax, client-generated IDs, pageToken pagination)
- [ ] Build memory prompt emulation (local LLM)
- [ ] Build LTM extraction emulation (local LLM on last chunk)
- [ ] Implement summary view stubs (or full emulation if needed)
- [ ] Implement forget policy emulation (search + bulk delete)
- [ ] Add `MEMORY_PROVIDER` to backend config
- [ ] Create backend provider factory (dynamic import)
- [ ] Update handler imports to use factory
- [ ] Update chatbot tool imports to use factory
- [ ] Update `.env.example` with all new variables
- [ ] Create `docker-compose.cloud.yml` override
- [ ] Test full demo flow end-to-end in cloud mode
- [ ] Verify chatbot tools work through the cloud package
- [ ] Update README with cloud setup instructions
