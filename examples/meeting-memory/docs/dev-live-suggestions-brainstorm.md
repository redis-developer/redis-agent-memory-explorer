# Meeting Memory Demo -- Live Suggestions Plan

## Goal

Add **push-based live suggestions** to the Meeting Memory demo, inspired by Screen 3 from [plan.md](./plan.md). During transcript playback, the AI periodically analyzes recent chunks and surfaces contextual suggestions -- detected topics, life events, action items, and contextual insights -- without the user asking. This creates the "AI copilot listening in" experience.

The chatbot (CopilotKit sidebar) is **pull-based** -- the user asks, the agent answers. Live suggestions are **push-based** -- the AI detects something noteworthy and surfaces it automatically. These are complementary, independent systems.

This plan covers changes to both the frontend and backend. The existing chatbot, transcript playback, and memory exploration features are unchanged.

---

## What We Already Have

| Feature                           | Implementation                                      | Status |
| --------------------------------- | --------------------------------------------------- | ------ |
| Transcript playback               | TranscriptPanel (left, 55%)                         | Done   |
| Memory exploration                | MemoryExplorerPanel (right, 45%) with 4 tabs        | Done   |
| Chatbot (pull-based Q&A)          | CopilotKit sidebar overlay                          | Done   |
| LangGraph agent with memory tools | Backend `agent/` folder, 8 tools                    | Done   |
| Working memory writes             | `POST /api/appendWorkingMemory` per chunk           | Done   |
| Session context passing           | `useCopilotReadable` (sessionId, userId, namespace) | Done   |

---

## Decisions Summary

| Question                    | Decision                                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------------- |
| UI placement                | **Persistent banner above tabs + AI Copilot tab** (Option B)                                      |
| Trigger frequency           | **Every N chunks** (configurable N in dataset config)                                             |
| Backend architecture        | **New REST endpoints** (`generateSuggestion` + `listSuggestions`), all session state (raw transcript chunks, suggestions, detected topics) stored in Redis with distinct key prefixes |
| Context for LLM             | `memoryPrompt` (working memory + LT search) + recent chunks (retrieved from Redis) + participant info |
| Suggestion types            | **Object array in dataset config** (`suggestionTypes[]` with id, label, description, enabled)     |
| Detected topics             | **Backend-managed, hybrid** -- pre-seeded at session creation from transcript `meeting.summary.topics`, AI merges updates in backend, full state returned to frontend |
| Chatbot relationship        | **Independent system**, reuses `AgentMemory` methods but separate LLM call and system prompt      |
| Default tab during playback | **AI Copilot tab is the default** when playback starts or when loading an existing session (read-only tab) |

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Frontend (Next.js)                                                       │
│                                                                          │
│  ┌──────────────────────────┐  ┌──────────────────────────────────────┐  │
│  │ TranscriptPanel (55%)    │  │ MemoryExplorerPanel (45%)            │  │
│  │                          │  │                                      │  │
│  │ [Toolbar]                │  │ ┌──────────────────────────────────┐ │  │
│  │ [Transcript Feed]        │  │ │ 💡 Persistent Suggestion Banner │ │  │
│  │ [Playback Controls]      │  │ │ (latest suggestion, always      │ │  │
│  │                          │  │ │  visible above tabs)            │ │  │
│  │                          │  │ └──────────────────────────────────┘ │  │
│  │ useTranscriptPlayback    │  │                                      │  │
│  │   │                      │  │ [AI Copilot*] [WM] [LT] [SV] [Redis]│  │
│  │   │ every N chunks       │  │                                      │  │
│  │   │ triggers ────────────│──│─► useLiveSuggestions hook            │  │
│  │   │                      │  │     │                                │  │
│  │                          │  │     │ POST /api/generateSuggestion   │  │
│  │                          │  │     │ POST /api/listSuggestions      │  │
│  └──────────────────────────┘  └─────┼────────────────────────────────┘  │
│                                      │                                   │
│  * = default active tab during playback (read-only)                      │
└──────────────────────────────────────┼───────────────────────────────────┘
                                       │ HTTP (POST)
┌──────────────────────────────────────▼───────────────────────────────────┐
│  Backend (cau-api-server)                                                 │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ suggestion.handlers.ts                                              │ │
│  │                                                                     │ │
│  │ generateSuggestionHandler:                                          │ │
│  │   1. Retrieve recent chunks + detected topics from Redis           │ │
│  │   2. Hydrate context via AgentMemory.memoryPrompt()                │ │
│  │   3. Direct LLM call (ChatOpenAI) with suggestion system prompt    │ │
│  │   4. Store suggestion + merge topic updates in Redis               │ │
│  │   5. Return suggestion + full detected topics state                │ │
│  │                                                                     │ │
│  │ listSuggestionsHandler:                                             │ │
│  │   Return all stored suggestions + detected topics for a session    │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  Existing routes (unchanged): /api/appendWorkingMemory, etc.            │
└──────────────────────────────────────────────────────────────────────────┘
```

- Note: check cau-redis package for Redis storage
- Note: all live suggestion data (raw transcript chunks, suggestions, detected topics) stored in Redis with distinct key prefixes separate from AMS keys (see [Redis Key Structure](#redis-key-structure) below)

## UI Design

### Persistent Suggestion Banner (Above Tabs, Always Visible)

A compact banner sits above the tab bar in MemoryExplorerPanel. It shows the latest suggestion one-liner and is visible regardless of which tab is active. This ensures the presenter never misses a suggestion while demonstrating Working Memory or other tabs.

```
MemoryExplorerPanel
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ 💡 Maya's early retirement detected -- income impact     │    │
│  │    ~40%. Consider dual-retirement scenario.              │    │
│  │                               [View Details]  [00:12:15] │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│ [AI Copilot] [Working Memory] [LT Memory] [Summary] [Redis]     │
├──────────────────────────────────────────────────────────────────┤
│  (active tab content)                                            │
└──────────────────────────────────────────────────────────────────┘
```

**Banner behavior:**

- Empty with some placeholder text when no suggestions exist (pre-playback, after reset)
- Animates to show the new suggestion when a new suggestion arrives
- Shows a one-line summary of the latest suggestion
- Timestamp badge (chunk timestamp when the suggestion was triggered)
- "View Details" navigates to the AI Copilot tab and scrolls to that suggestion
- Updates in-place when a newer suggestion arrives (with a brief highlight animation)
- Stays visible after playback completes (showing the last suggestion)

### AI Copilot Tab (Read-Only, Default During Playback)

A new fifth tab in MemoryExplorerPanel. This is a **read-only** tab -- no user input, no buttons. It passively displays what the AI has detected.

```
AI Copilot Tab
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  DETECTED TOPICS                                                 │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ ✅ REIT rebalancing (discussed 00:04)                     │    │
│  │ 🔄 Spouse retirement (new -- 00:12)                       │    │
│  │ ❓ Bond fund vs bonds (question -- 00:13)                 │    │
│  │ ○ Education fund (not yet discussed)                      │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│  LIVE INSIGHTS                                                   │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  [00:12:15] LIFE EVENT DETECTED                          │    │
│  │  Maya Morrison may retire early (2027). This could       │    │
│  │  reduce household income by ~40%. Consider:              │    │
│  │  - Revisit withdrawal rate assumptions                   │    │
│  │  - Model dual-retirement scenario                        │    │
│  │  - Review insurance coverage                             │    │
│  │                                                          │    │
│  ├──────────────────────────────────────────────────────────┤    │
│  │                                                          │    │
│  │  [00:04:15] TOPIC RECALL                                 │    │
│  │  James is asking about the REIT rebalancing from the     │    │
│  │  Jan 15 meeting. Based on past sessions, he expressed    │    │
│  │  concern about commercial property defaults. Consider    │    │
│  │  presenting short-duration bond fund (4.8%) + dividend   │    │
│  │  aristocrats ETF (3.6%) as alternatives.                 │    │
│  │                                                          │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Waiting for more transcript...                                  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Tab behavior:**

- **Default active tab** when playback starts (auto-switches from whatever tab was active)
- **Also auto-activates when loading an existing session** -- `listSuggestions` returns the full tab state (suggestions + topics), so the tab renders fully populated immediately
- Read-only -- no user input fields, no action buttons
- **Detected Topics** section at the top: checklist of topics, updated live as the AI detects or confirms them
- **Live Insights** section below: scrollable list of suggestion cards, newest at the top, each with timestamp and type badge
- New suggestion cards animate in (fade-up) when they arrive
- "Waiting for more transcript..." shown between suggestions
- After playback completes, the tab shows the complete history (all suggestions + final topic state)
- On reset, the tab clears

### Tab Ordering

```
[AI Copilot] [Working Memory] [Long-Term Memories] [Summary Views] [Redis Under the Hood]
```

AI Copilot is the first tab (leftmost). It auto-activates when playback starts. The presenter can switch to other tabs at any time and still see the banner.

---

## Detected Topics

### Source: Hybrid (Pre-Seeded + AI-Generated)

Topics come from two sources:

1. **Pre-seeded from transcript metadata** -- the transcript JSON has `meeting.summary.topics` (e.g., `["REIT rebalancing", "spouse retirement", "bond funds", "education fund"]`). These are loaded as the initial topic checklist with status `pending` when a transcript is selected.
2. **AI-generated dynamically** -- as the LLM analyzes chunks, it can add new topics not in the pre-seeded list (e.g., a surprise topic the client brings up). These appear with a "new" badge.

### Topic States

| State       | Icon | Meaning                                            |
| ----------- | ---- | -------------------------------------------------- |
| `pending`   | ○    | Pre-seeded, not yet discussed                      |
| `discussed` | ✅   | AI confirmed this topic was covered                |
| `new`       | 🔄   | AI detected a new topic not in the pre-seeded list |
| `question`  | ❓   | Client asked a question about this topic           |

### Topic Data Shape

```typescript
type DetectedTopic = {
  name: string;
  status: "pending" | "discussed" | "new" | "question";
  detectedAtChunkIndex: number | null;
  detectedAtTimestamp: string | null;
  source: "pre-seeded" | "ai-detected";
};
```

Pre-seeded topics start with `status: "pending"`, `detectedAtChunkIndex: null`, `source: "pre-seeded"`. The AI updates their status and timestamp when it detects them in the conversation.

---

## Suggestion Types (Configurable in Dataset Config)

Suggestion types are defined as an **object array** in `dataset.config.json`, not hardcoded enum keys. Each entry carries its own `id`, display `label`, `description` (fed into the system prompt so the LLM knows what to look for), and `enabled` flag. New suggestion types can be added purely through config without any code changes.

### Suggestion Type Config Shape

```typescript
type SuggestionTypeConfig = {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
};
```

### Default Types (Defined in Dataset Config)

These are the default suggestion types shipped with the wealth-advisor dataset. Other datasets can define different types entirely.

| `id`             | `label`             | `description` (instructs the LLM)                                                  |
| ---------------- | ------------------- | ---------------------------------------------------------------------------------- |
| `lifeEvent`      | Life Event Detected | Client mentions a significant personal change (retirement, marriage, health, etc.) |
| `topicRecall`    | Topic Recall        | Conversation touches a topic from past sessions (LT memory match)                  |
| `questionAnswer` | Question Answer     | Client asks a factual question the AI can help answer                              |
| `agendaReminder` | Agenda Reminder     | Pre-seeded topic not yet discussed -- nudge to bring it up                         |
| `sentimentShift` | Sentiment Shift     | Tone/content suggests anxiety, excitement, concern                                 |
| `actionItem`     | Action Item         | A decision is made or a follow-up is identified                                    |

### Suggestion Data Shape

```typescript
type LiveSuggestion = {
  id: string;
  type: string;
  title: string;
  summary: string;
  details: string[];
  chunkIndex: number;
  timestamp: string;
  relatedTopics: string[];
  createdAt: string;
};
```

`LiveSuggestion.type` is a free-form `string` that matches a `SuggestionTypeConfig.id` from the config. The frontend resolves the display label and styling by looking up the type in the `suggestionTypes` array.

---

## Dataset Config Changes (`dataset.config.json`)

Add a `liveSuggestions` section:

```json
{
  "liveSuggestions": {
    "title": "AI Copilot",
    "description": "Real-time AI suggestions during transcript playback.",
    "bannerLabel": "AI Insight",
    "topicsTitle": "Detected Topics",
    "insightsTitle": "Live Insights",
    "waitingMessage": "Listening to transcript...",
    "noSuggestionsMessage": "No insights yet. Play a transcript to see live AI suggestions.",
    "triggerEveryNChunks": 5,
    "suggestionTypes": [
      {
        "id": "lifeEvent",
        "label": "Life Event Detected",
        "description": "Client mentions a significant personal change (retirement, marriage, health, etc.)",
        "enabled": true
      },
      {
        "id": "topicRecall",
        "label": "Topic Recall",
        "description": "Conversation touches a topic from past sessions (long-term memory match)",
        "enabled": true
      },
      {
        "id": "questionAnswer",
        "label": "Question Answer",
        "description": "Client asks a factual question the AI can help answer",
        "enabled": true
      },
      {
        "id": "agendaReminder",
        "label": "Agenda Reminder",
        "description": "Pre-seeded topic not yet discussed -- nudge to bring it up",
        "enabled": true
      },
      {
        "id": "sentimentShift",
        "label": "Sentiment Shift",
        "description": "Tone or content suggests anxiety, excitement, or concern",
        "enabled": true
      },
      {
        "id": "actionItem",
        "label": "Action Item",
        "description": "A decision is made or a follow-up is identified",
        "enabled": true
      }
    ]
  }
}
```

**Key config values:**

- `triggerEveryNChunks` -- how often to call the suggestion endpoint (default: 5). At 2s/chunk playback speed, this means one LLM analysis every ~10 seconds.
- `suggestionTypes` -- object array defining all suggestion types. Each entry has `id` (used in LLM responses and `LiveSuggestion.type`), `label` (display text for badges/chips), `description` (fed into the system prompt to instruct the LLM), and `enabled` (toggle per dataset). The system prompt and frontend rendering are built dynamically from this array -- no hardcoded type keys in code.
- All display strings (`title`, `bannerLabel`, etc.) are config-driven as per the project convention.

---

## Backend

### New APIs

#### `POST /api/generateSuggestion`

Called by the frontend every N chunks during playback. The frontend sends only the session ID and current chunk index -- **all data is retrieved from Redis on the backend** (raw transcript chunks, detected topics, memory context). This keeps payloads minimal and makes the backend the single source of truth.

The backend:

1. Retrieves the last N raw transcript chunks from Redis (stored during `appendWorkingMemory`)
2. Retrieves the current detected topics state from Redis
3. Hydrates memory context via `AgentMemory.memoryPrompt()` (working memory + LT search)
4. Makes a direct LLM call (`ChatOpenAI`) with a suggestion-specific system prompt
5. Stores the suggestion in Redis (if non-null), merges any topic updates into the stored topic state
6. Returns the suggestion (or `null`) + the **full** detected topics state

**Request:**

```json
{
  "sessionId": "playback-2026-02-26-google-meet-1773247345966",
  "chunkIndex": 24
}
```

- `sessionId` -- identifies the session; used to retrieve raw chunks, topics, and memory context from Redis
- `chunkIndex` -- current position in the transcript; the backend retrieves the last N chunks ending at this index from its Redis transcript chunk store

**Response (suggestion found):**

```json
{
  "data": {
    "suggestion": {
      "id": "sug-1711234567890-1",
      "type": "lifeEvent",
      "title": "Spouse Early Retirement Detected",
      "summary": "Maya Morrison may retire in 2027, reducing household income by ~40%.",
      "details": [
        "Revisit withdrawal rate assumptions",
        "Model dual-retirement scenario",
        "Review insurance and healthcare coverage"
      ],
      "chunkIndex": 24,
      "timestamp": "00:12:15",
      "relatedTopics": ["Spouse retirement"],
      "createdAt": "2026-03-30T10:14:15Z"
    },
    "detectedTopics": [
      { "name": "REIT rebalancing", "status": "discussed", "detectedAtChunkIndex": 8, "detectedAtTimestamp": "00:04:15", "source": "pre-seeded" },
      { "name": "Spouse retirement", "status": "new", "detectedAtChunkIndex": 24, "detectedAtTimestamp": "00:12:15", "source": "ai-detected" },
      { "name": "Education fund", "status": "pending", "detectedAtChunkIndex": null, "detectedAtTimestamp": null, "source": "pre-seeded" },
      { "name": "Bond fund vs bonds", "status": "question", "detectedAtChunkIndex": 20, "detectedAtTimestamp": "00:13:00", "source": "ai-detected" }
    ]
  }
}
```

**Response (nothing noteworthy):**

```json
{
  "data": {
    "suggestion": null,
    "detectedTopics": [
      { "name": "REIT rebalancing", "status": "discussed", "detectedAtChunkIndex": 8, "detectedAtTimestamp": "00:04:15", "source": "pre-seeded" },
      { "name": "Education fund", "status": "pending", "detectedAtChunkIndex": null, "detectedAtTimestamp": null, "source": "pre-seeded" }
    ]
  }
}
```

- `detectedTopics` -- the **full** current topic state (not deltas). The backend merges any LLM-detected topic changes into the stored state in Redis and returns the complete list. The frontend replaces its local state with this -- no merge logic needed on the client.

**Implementation approach:**

```typescript
const generateSuggestionHandler: RouteHandler = async (input, { logger }) => {
  const { namespace, userId } = getAppState();
  const { sessionId, chunkIndex } = input;

  // 1. Retrieve recent chunks from Redis (stored during appendWorkingMemory)
  const recentChunks = await transcriptChunkStore.getRange(
    sessionId,
    Math.max(0, chunkIndex - SUGGESTION_CHUNK_WINDOW + 1),
    chunkIndex,
  );

  // 2. Retrieve current detected topics state from Redis
  const detectedTopics = await topicStore.get(sessionId);

  // 3. Hydrate context via memoryPrompt
  const memoryContext = await AgentMemory.getInstance().memoryPrompt({
    query: recentChunks
      .map((c) => `[${c.timestamp}] ${c.speaker}: ${c.text}`)
      .join("\n"),
    session: { sessionId, userId, modelName: ENV.MODEL_NAME },
    longTermSearch: { namespace: { eq: namespace }, userId: { eq: userId } },
  });

  // 4. Build system prompt with enabled suggestion types from dataset config
  const systemPrompt = buildSuggestionSystemPrompt(
    datasetConfig,
    detectedTopics,
  );

  // 5. Direct LLM call
  const llm = new ChatOpenAI({ model: ENV.CHATBOT_MODEL, temperature: 0 });
  const result = await llm.invoke([
    new SystemMessage(systemPrompt),
    new SystemMessage(`Memory context:\n${JSON.stringify(memoryContext)}`),
    new HumanMessage(formatRecentChunks(recentChunks)),
  ]);

  // 6. Parse structured response
  const parsed = parseSuggestionResponse(result.content);

  // 7. Store suggestion if non-null
  if (parsed.suggestion) {
    await suggestionStore.add(sessionId, parsed.suggestion);
  }

  // 8. Merge topic updates into stored state and return full state
  const updatedTopics = await topicStore.mergeUpdates(
    sessionId,
    parsed.topicUpdates,
  );

  return { suggestion: parsed.suggestion, detectedTopics: updatedTopics };
};
```

#### `POST /api/listSuggestions`

Returns all stored suggestions **and** the full detected topics state for a session. This is the **complete AI Copilot tab state** in a single call -- used by the frontend to populate the tab when loading an existing session, on initial load, or to sync after reconnection.

**Request:**

```json
{
  "sessionId": "playback-2026-02-26-google-meet-1773247345966"
}
```

**Response:**

```json
{
  "data": {
    "suggestions": [
      {
        "id": "sug-1711234567890-0",
        "type": "topicRecall",
        "title": "REIT Rebalancing Options",
        "summary": "James is asking about REITs from the Jan 15 meeting...",
        "details": ["..."],
        "chunkIndex": 8,
        "timestamp": "00:04:15",
        "relatedTopics": ["REIT rebalancing"],
        "createdAt": "2026-03-30T10:04:15Z"
      },
      {
        "id": "sug-1711234567890-1",
        "type": "lifeEvent",
        "title": "Spouse Early Retirement Detected",
        "summary": "Maya Morrison may retire in 2027...",
        "details": ["..."],
        "chunkIndex": 24,
        "timestamp": "00:12:15",
        "relatedTopics": ["Spouse retirement"],
        "createdAt": "2026-03-30T10:14:15Z"
      }
    ],
    "detectedTopics": [
      { "name": "REIT rebalancing", "status": "discussed", "detectedAtChunkIndex": 8, "detectedAtTimestamp": "00:04:15", "source": "pre-seeded" },
      { "name": "Spouse retirement", "status": "new", "detectedAtChunkIndex": 24, "detectedAtTimestamp": "00:12:15", "source": "ai-detected" },
      { "name": "Education fund", "status": "pending", "detectedAtChunkIndex": null, "detectedAtTimestamp": null, "source": "pre-seeded" }
    ],
    "total": 2
  }
}
```

### Backend Redis Storage

The backend stores three types of session-scoped data in Redis, all using the `cau-redis` package from the packages folder. Each store has a distinct key prefix to avoid conflicts with AMS keys (`working_memory/`, `memory-server/`, `memory_idx/`, `summary_view/`, `migration/`).

#### Redis Key Structure

```
AMS-managed keys (existing, do NOT touch):
  working_memory/{namespace}/{userId}/{sessionId}    → JSON (AMS working memory)
  memory-server/...                                   → (AMS internal)
  memory_idx/...                                      → (AMS search index)
  summary_view/...                                    → (AMS summary views)
  migration/...                                       → (AMS migrations)

App-managed keys (NEW, our custom stores):
  copilot/suggestions/{namespace}/{userId}/{sessionId}   → JSON array of LiveSuggestion
  copilot/topics/{namespace}/{userId}/{sessionId}        → JSON array of DetectedTopic
  copilot/chunks/{namespace}/{userId}/{sessionId}        → JSON array of TranscriptChunk
```

The `copilot/` top-level prefix groups all live suggestion data and makes it easy to find in Redis Insight. The `{namespace}/{userId}/{sessionId}` pattern mirrors the AMS key hierarchy for consistency.

Example keys for the wealth-advisor dataset:

```
copilot/suggestions/wealth-advisor/sarah-chen/playback-2026-02-26-google-meet-1774...
copilot/topics/wealth-advisor/sarah-chen/playback-2026-02-26-google-meet-1774...
copilot/chunks/wealth-advisor/sarah-chen/playback-2026-02-26-google-meet-1774...
```

#### Store 1: Suggestion Store (`suggestion-store.ts`)

Stores generated `LiveSuggestion` objects per session. Written by `generateSuggestionHandler`, read by `listSuggestionsHandler`.

```typescript
// suggestion-store.ts
const KEY_PREFIX = "copilot/suggestions";

const add = async (sessionId: string, suggestion: LiveSuggestion): Promise<void> => { ... };
const list = async (sessionId: string): Promise<LiveSuggestion[]> => { ... };
const clear = async (sessionId: string): Promise<void> => { ... };
const clearAll = async (): Promise<void> => { ... };
```

#### Store 2: Topic Store (`topic-store.ts`)

Stores the canonical `DetectedTopic[]` state per session. Initialized at session creation (pre-seeded from transcript `meeting.summary.topics`). Updated by `generateSuggestionHandler` after each LLM call. Read by both `generateSuggestionHandler` (for LLM context) and `listSuggestionsHandler` (for full tab state).

```typescript
// topic-store.ts
const KEY_PREFIX = "copilot/topics";

const initialize = async (sessionId: string, topics: DetectedTopic[]): Promise<void> => { ... };
const get = async (sessionId: string): Promise<DetectedTopic[]> => { ... };
const mergeUpdates = async (
  sessionId: string,
  updates: TopicUpdate[],
): Promise<DetectedTopic[]> => {
  // 1. Read current topics from Redis
  // 2. For each update:
  //    - If topic exists: update status, detectedAtChunkIndex, detectedAtTimestamp
  //    - If topic is new: append with source "ai-detected"
  // 3. Write merged state back to Redis
  // 4. Return the full merged array
};
const clear = async (sessionId: string): Promise<void> => { ... };
const clearAll = async (): Promise<void> => { ... };
```

#### Store 3: Transcript Chunk Store (`transcript-chunk-store.ts`)

Stores raw transcript chunks per session. Written during `appendWorkingMemory` (one chunk per call), read by `generateSuggestionHandler` to retrieve recent chunks for the LLM. This is separate from AMS working memory, which auto-compresses messages and creates summaries -- the raw chunk store preserves the full verbatim transcript history.

```typescript
// transcript-chunk-store.ts
const KEY_PREFIX = "copilot/chunks";

const append = async (sessionId: string, chunk: TranscriptChunk): Promise<void> => { ... };
const getRange = async (
  sessionId: string,
  startIndex: number,
  endIndex: number,
): Promise<TranscriptChunk[]> => { ... };
const getAll = async (sessionId: string): Promise<TranscriptChunk[]> => { ... };
const count = async (sessionId: string): Promise<number> => { ... };
const clear = async (sessionId: string): Promise<void> => { ... };
const clearAll = async (): Promise<void> => { ... };
```

#### Topic Initialization Flow

Topics are pre-seeded on the backend during session creation (`createWorkingMemory`), not on the frontend. The backend has access to the transcript metadata and seeds the topic store:

```typescript
// Inside createWorkingMemoryHandler (modified)
const createWorkingMemoryHandler: RouteHandler = async (input, { logger }) => {
  const { transcriptId } = input;

  // ... existing session creation logic ...

  // NEW: Pre-seed detected topics from transcript metadata
  const topics = transcriptData.meeting.summary.topics;
  const seededTopics: DetectedTopic[] = topics.map((name) => ({
    name,
    status: "pending",
    detectedAtChunkIndex: null,
    detectedAtTimestamp: null,
    source: "pre-seeded",
  }));
  await topicStore.initialize(sessionId, seededTopics);

  return { sessionId, ... };
};
```

#### Raw Chunk Storage Flow

Raw transcript chunks are stored during `appendWorkingMemory`, alongside the existing AMS write:

```typescript
// Inside appendWorkingMemoryHandler (modified)
const appendWorkingMemoryHandler: RouteHandler = async (input, { logger }) => {
  const { sessionId, chunk, isLastChunk } = input;

  // Existing: append to AMS working memory
  await agentMemory.addMessages(sessionId, [formatChunk(chunk)]);

  // NEW: store raw chunk in Redis (separate from AMS)
  await transcriptChunkStore.append(sessionId, chunk);

  return { ... };
};
```

The `resetLifecycle` handler clears all three stores.

### Suggestion System Prompt (`suggestion-system-prompt.ts`)

A separate system prompt focused on analyzing transcript segments and generating structured suggestions. Built dynamically from the dataset config (enabled types, participant info).

```typescript
const buildSuggestionSystemPrompt = (
  config: DatasetConfig,
  detectedTopics: DetectedTopic[],
): string => {
  const enabledTypes = config.liveSuggestions.suggestionTypes.filter(
    (t) => t.enabled,
  );
  const pendingTopics = detectedTopics
    .filter((t) => t.status === "pending")
    .map((t) => t.name);
  const discussedTopics = detectedTopics
    .filter((t) => t.status !== "pending")
    .map((t) => `${t.name} (${t.status})`);

  return `You are a real-time AI copilot analyzing a live meeting transcript for a ${config.roles.rm.label}.

## Context
- Dataset: ${config.name}
- ${config.roles.rm.shortLabel}: ${config.participants.rm.name} (${config.participants.rm.title})
- ${config.roles.client.shortLabel}: ${config.participants.client.name} (${config.participants.client.title})

## Your Task
Analyze the most recent transcript segment. If you detect anything noteworthy, return a structured suggestion. If nothing is noteworthy, return null.

## Suggestion Types You Should Look For
${enabledTypes.map((t) => `- ${t.id}: ${t.description}`).join("\n")}

## Current Topic State
- Already discussed: ${discussedTopics.join(", ") || "none"}
- Not yet discussed: ${pendingTopics.join(", ") || "none"}

## Response Format
Return a JSON object with:
- suggestion: { type (one of: ${enabledTypes.map((t) => `"${t.id}"`).join(", ")}), title, summary, details (array of action items), relatedTopics (array of topic names) } OR null
- topicUpdates: array of { name, status ("discussed" | "new" | "question"), detectedAtTimestamp } for any topic changes

Important:
- Only return a suggestion if something genuinely noteworthy happened in this segment
- Prefer quality over quantity -- not every segment needs a suggestion
- Use the memory context to connect current conversation to past sessions
- For agenda reminders, only suggest if a pending topic hasn't been discussed and the conversation is winding down
- Keep summaries concise (1-2 sentences) and details actionable`;
};
```

### Backend Project Structure (Changes Only)

The existing `agent/` folder is renamed to `chatbot-agent/` (it contains the CopilotKit + LangGraph chatbot wiring). The new suggestion agent lives in its own `suggestion-agent/` folder.

```
examples/meeting-memory/backend/src/
├── chatbot-agent/                          # RENAMED from agent/
│   ├── graph.ts                            # (unchanged)
│   ├── tools.ts                            # (unchanged)
│   ├── copilotkit-langgraph.ts             # (unchanged)
│   ├── system-prompt.ts                    # (unchanged)
│   └── index.ts                            # (unchanged)
│
├── suggestion-agent/                       # NEW: live suggestion agent
│   ├── system-prompt.ts                    # System prompt builder for suggestions
│   ├── graph.ts                            # LLM call logic (hydrate context + generate)
│   └── index.ts                            # Barrel export
│
├── handlers/
│   ├── suggestion.handlers.ts              # NEW: generateSuggestion, listSuggestions
│   └── ... (existing, unchanged)
│
├── services/
│   ├── suggestion-store.ts                 # NEW: Redis store for LiveSuggestion objects
│   ├── topic-store.ts                      # NEW: Redis store for DetectedTopic state (init + merge)
│   ├── transcript-chunk-store.ts           # NEW: Redis store for raw transcript chunks
│   └── ... (existing, unchanged)
│
├── routes.ts                               # MODIFIED: add suggestion routes
├── types.ts                                # MODIFIED: add suggestion types
├── constants.ts                            # MODIFIED: add suggestion constants
└── ... (existing, unchanged)
```

---

## Frontend

### Project Structure (Changes Only)

All AI Copilot sub-components and hooks live in a new `ai-copilot/` subfolder under `memory-explorer-panel/`. This keeps them grouped and avoids cluttering the parent folder.

```
examples/meeting-memory/frontend/src/
├── components/
│   └── business/
│       └── memory-explorer-panel/
│           ├── ai-copilot/                             # NEW: AI Copilot subfolder
│           │   ├── ai-copilot-tab.component.tsx        # AI Copilot tab (read-only)
│           │   ├── ai-copilot-tab.component.css
│           │   ├── suggestion-card.component.tsx        # Single suggestion card
│           │   ├── suggestion-card.component.css
│           │   ├── detected-topics.component.tsx        # Topic checklist
│           │   ├── detected-topics.component.css
│           │   ├── suggestion-banner.component.tsx      # Persistent banner above tabs
│           │   ├── suggestion-banner.component.css
│           │   ├── use-live-suggestions.ts              # Suggestion trigger + state hook
│           │   └── index.ts                             # Barrel: export AiCopilotTab, SuggestionBanner
│           │
│           ├── memory-explorer-panel.component.tsx      # MODIFIED: add banner, add tab, auto-switch
│           ├── memory-explorer-panel.component.css      # MODIFIED: banner layout
│           └── ... (existing sub-components unchanged)
│
├── types/
│   ├── suggestion.types.ts                             # NEW: LiveSuggestion, DetectedTopic, SuggestionTypeConfig
│   └── ... (existing, unchanged)
│
├── constants/
│   └── app.constants.ts                                # MODIFIED: add AI Copilot tab ID
│
└── services/
    └── api.service.ts                                  # MODIFIED: add generateSuggestion, listSuggestions
```

The `ai-copilot/index.ts` barrel exports only `AiCopilotTab` and `SuggestionBanner` -- the sub-components (`SuggestionCard`, `DetectedTopics`) and the hook (`useLiveSuggestions`) are internal to the subfolder, imported only by `AiCopilotTab`.

### Hook: `useLiveSuggestions`

Lives inside `memory-explorer-panel/ai-copilot/`. Manages the suggestion trigger timing, API calls, and state. The hook is a **thin client** -- all data (chunks, topics, suggestions) lives on the backend in Redis. The hook just triggers calls at the right time and renders the response.

```typescript
type UseLiveSuggestionsResult = {
  suggestions: LiveSuggestion[];
  latestSuggestion: LiveSuggestion | null;
  detectedTopics: DetectedTopic[];
  isGenerating: boolean;
  error: string | null;
};
```

**Behavior:**

1. Receives `chunkIndex` (from playback), `sessionId`, `isPlaying`, and `triggerEveryNChunks` as inputs. **Does NOT receive transcript `chunks` array** -- raw chunks are stored in Redis by the backend during `appendWorkingMemory`.
2. Tracks the last chunk index that triggered a suggestion call
3. When `chunkIndex - lastTriggeredIndex >= triggerEveryNChunks` AND `isPlaying`:
   - Call `POST /api/generateSuggestion` with `{ sessionId, chunkIndex }` (minimal payload)
   - On response: append suggestion to local array (if non-null), **replace** local `detectedTopics` with the full state from the response (no merge logic)
4. On session load (existing session): call `POST /api/listSuggestions` to populate the full tab state (suggestions + detected topics) in one call
5. On reset: clear all local state

**Topic initialization:**

Topics are **initialized on the backend** during `createWorkingMemory` (pre-seeded from transcript `meeting.summary.topics`). The frontend does NOT seed topics locally -- it receives the full topic state from the backend on every `generateSuggestion` response and on `listSuggestions` calls.

### Wiring: How the Trigger Flows

The frontend already has `chunkIndex` (from `useTranscriptPlayback` inside TranscriptPanel) and `lastAppendResult` flowing to MemoryExplorerPanel. For live suggestions, we need `chunkIndex` and `isPlaying` to flow to `useLiveSuggestions`. Since raw chunks are stored in Redis by the backend (during `appendWorkingMemory`), the frontend does **NOT** need to pass the `chunks` array -- only the chunk index and playback state.

```
DemoPage
  │
  ├── State: sessionId, lastAppendResult
  │   NEW: currentChunkIndex, isPlaying
  │
  ├──► TranscriptPanel
  │     callbacks: onSessionCreated, onReset, onAppendResult
  │     NEW callback: onChunkPlayed(chunkIndex)
  │
  └──► MemoryExplorerPanel
        props: sessionId, lastAppendResult, datasetConfig
        NEW props: currentChunkIndex, isPlaying
        │
        └── useLiveSuggestions(sessionId, currentChunkIndex, isPlaying, config)
```

**Alternative:** Instead of bridging through DemoPage, `useLiveSuggestions` could derive `chunkIndex` from `lastAppendResult` (which already flows). If `lastAppendResult` contains a chunk counter or similar, no new prop is needed. Evaluate at implementation time.

### Sub-component: SuggestionBanner (`suggestion-banner.component.tsx`)

Persistent banner above the tab bar.

**Props (internal to MemoryExplorerPanel):**

```typescript
type SuggestionBannerProps = {
  suggestion: LiveSuggestion | null;
  bannerLabel: string;
  onViewDetails: () => void;
};
```

**Behavior:**

- Empty with some placeholder text when `suggestion` is null
- Shows: type badge + one-line summary + timestamp + "View Details" link
- "View Details" calls `onViewDetails` which switches to the AI Copilot tab and scrolls to the suggestion
- Animate: some animation on appear, brief highlight flash on update

### Sub-component: AiCopilotTab (`ai-copilot-tab.component.tsx`)

Read-only tab content.

**Props (internal to MemoryExplorerPanel):**

```typescript
type AiCopilotTabProps = {
  suggestions: LiveSuggestion[];
  detectedTopics: DetectedTopic[];
  isGenerating: boolean;
  labels: DatasetConfig["liveSuggestions"];
};
```

**Layout:**

1. **Detected Topics** section (top) -- renders `DetectedTopics` sub-component
2. **Live Insights** section (below) -- scrollable list of `SuggestionCard` sub-components, newest first
3. **Status indicator** at the bottom: "Listening to transcript..." (during playback) or "Playback complete -- N insights generated" (after)

### Sub-component: DetectedTopics (`detected-topics.component.tsx`)

Renders the topic checklist.

**Props (internal):**

```typescript
type DetectedTopicsProps = {
  topics: DetectedTopic[];
  title: string;
};
```

Each topic shows an icon based on status (○, ✅, 🔄, ❓), the topic name, and the detection timestamp if available.

### Sub-component: SuggestionCard (`suggestion-card.component.tsx`)

A single suggestion insight card.

**Props (internal):**

```typescript
type SuggestionCardProps = {
  suggestion: LiveSuggestion;
  suggestionTypes: SuggestionTypeConfig[];
  isNew: boolean;
};
```

**Visual:**

- Type badge (chip -- label resolved from `suggestionTypes.find(t => t.id === suggestion.type).label`)
- Timestamp badge (e.g., "00:12:15")
- Title (bold)
- Summary text (1-2 sentences)
- Details as bullet points
- Related topic chips
- `isNew` triggers a fade-in entrance animation

---

## Data Flow: Suggestion Generated During Playback

```
TranscriptPanel                DemoPage              MemoryExplorerPanel              Backend (Redis)
  │                               │                       │                              │
  │ (chunk 24 played)             │                       │                              │
  │ onChunkPlayed(24)             │                       │                              │
  │──────────────────────────────>│                       │                              │
  │                               │ currentChunkIndex=24  │                              │
  │                               │──────────────────────>│                              │
  │                               │                       │                              │
  │                               │                       │ useLiveSuggestions:           │
  │                               │                       │ 24 - 19 = 5 >= triggerN(5)   │
  │                               │                       │ → trigger suggestion call     │
  │                               │                       │                              │
  │                               │                       │ POST /api/generateSuggestion │
  │                               │                       │ { sessionId, chunkIndex: 24 }│
  │                               │                       │─────────────────────────────>│
  │                               │                       │                              │
  │                               │                       │                              │ 1. Get chunks[20..24] from Redis
  │                               │                       │                              │ 2. Get detected topics from Redis
  │                               │                       │                              │ 3. memoryPrompt() (AMS)
  │                               │                       │                              │ 4. LLM call
  │                               │                       │                              │ 5. Store suggestion in Redis
  │                               │                       │                              │ 6. Merge topic updates in Redis
  │                               │                       │                              │
  │                               │                       │ { suggestion: {              │
  │                               │                       │     type: "lifeEvent",       │
  │                               │                       │     title: "Spouse Early     │
  │                               │                       │       Retirement Detected",  │
  │                               │                       │     ... },                   │
  │                               │                       │   detectedTopics: [          │
  │                               │                       │     (full merged state)      │
  │                               │                       │   ] }                        │
  │                               │                       │<─────────────────────────────│
  │                               │                       │                              │
  │                               │                       │ → Append suggestion to array │
  │                               │                       │ → Replace topics (no merge)  │
  │                               │                       │ → Banner shows new suggestion│
  │                               │                       │ → AI Copilot tab updates     │
```

## Data Flow: Loading Existing Session with Suggestions

```
TranscriptPanel                DemoPage              MemoryExplorerPanel              Backend (Redis)
  │                               │                       │                              │
  │ User selects existing session │                       │                              │
  │ from dropdown                 │                       │                              │
  │                               │                       │                              │
  │ onSessionCreated(sessionId)   │                       │                              │
  │──────────────────────────────>│                       │                              │
  │                               │ sessionId = "..."     │                              │
  │                               │──────────────────────>│                              │
  │                               │                       │                              │
  │                               │                       │ useLiveSuggestions:           │
  │                               │                       │ session loaded (not playing)  │
  │                               │                       │ → fetch full tab state        │
  │                               │                       │                              │
  │                               │                       │ POST /api/listSuggestions    │
  │                               │                       │ { sessionId }                │
  │                               │                       │─────────────────────────────>│
  │                               │                       │                              │
  │                               │                       │                              │ Read suggestions from Redis
  │                               │                       │                              │ Read topics from Redis
  │                               │                       │                              │
  │                               │                       │ { suggestions: [...],        │
  │                               │                       │   detectedTopics: [...],     │
  │                               │                       │   total: N }                 │
  │                               │                       │<─────────────────────────────│
  │                               │                       │                              │
  │                               │                       │ → Populate suggestions array │
  │                               │                       │ → Set detected topics        │
  │                               │                       │ → Auto-switch to AI Copilot  │
  │                               │                       │ → Tab renders fully populated│
```

---

## Demo Presenter Flow

1. **Select transcript** -- topic checklist seeds from `meeting.summary.topics` (all ○ pending)
2. **Click Play** -- AI Copilot tab auto-activates (right panel)
3. **Chunks stream** (left) -- AI Copilot tab shows "Listening to transcript..."
4. **~Chunk 8** (first trigger) -- suggestion card animates in: "REIT Rebalancing Options -- James is asking about REITs from the Jan 15 meeting..." Topic checklist: ✅ REIT rebalancing
5. **Presenter narrates**: "Watch the AI copilot -- it's reading the transcript in real-time and pulling insights from past meetings stored in Redis long-term memory."
6. **~Chunk 24** -- banner updates: "Maya's early retirement detected." New suggestion card in the tab. Topic: 🔄 Spouse retirement (new)
7. **Switch to Working Memory tab** -- show tokens growing, context window gauge. Banner still shows the latest suggestion above.
8. **Switch back to AI Copilot** -- show accumulated suggestions, updated topic checklist
9. **After playback** -- explore LT memories, summaries, chatbot as before

---

## Implementation Priority (Build Order)

| Phase | What                                                                                            | Why                           |
| ----- | ----------------------------------------------------------------------------------------------- | ----------------------------- |
| 1     | Types (`suggestion.types.ts`) + dataset config changes + constants                              | Foundation                    |
| 2     | Backend: Redis stores (`suggestion-store.ts`, `topic-store.ts`, `transcript-chunk-store.ts`)    | Storage before handlers       |
| 3     | Backend: Modify `appendWorkingMemory` handler to also store raw chunks via `transcriptChunkStore` | Raw chunk persistence        |
| 4     | Backend: Modify `createWorkingMemory` handler to pre-seed topics via `topicStore`               | Topic initialization          |
| 5     | Backend: `suggestion-system-prompt.ts`                                                          | System prompt before handler  |
| 6     | Backend: `suggestion.handlers.ts` (generateSuggestion + listSuggestions) + route registration   | Core backend                  |
| 7     | Backend: Add store clearing to `resetLifecycle` handler                                         | Reset support                 |
| 8     | Frontend: `api.service.ts` additions (generateSuggestion, listSuggestions)                      | API connectivity              |
| 9     | Frontend: `use-live-suggestions.ts` hook (thin client, no merge logic)                          | Core frontend logic           |
| 10    | Frontend: `suggestion-card.component.tsx` + `detected-topics.component.tsx`                     | Sub-components                |
| 11    | Frontend: `ai-copilot-tab.component.tsx`                                                        | Tab content                   |
| 12    | Frontend: `suggestion-banner.component.tsx`                                                     | Persistent banner             |
| 13    | Frontend: Wire into `memory-explorer-panel.component.tsx` (add tab, add banner, auto-switch)    | Integration                   |
| 14    | Frontend: Bridge `currentChunkIndex` / `isPlaying` from TranscriptPanel through DemoPage        | Playback → suggestions wiring |
| 15    | Frontend: Auto-activate AI Copilot tab on session load (existing session dropdown)              | Session load support          |
| 16    | Test end-to-end + tune `triggerEveryNChunks` and system prompt                                  | Polish                        |

---

## Reset Behavior

When "Clear All Memories & Restart" is clicked:

1. Backend `resetLifecycle` handler clears all three Redis stores:
   - `suggestionStore.clearAll()` -- clear all stored suggestions (`copilot/suggestions/...`)
   - `topicStore.clearAll()` -- clear all detected topic states (`copilot/topics/...`)
   - `transcriptChunkStore.clearAll()` -- clear all raw transcript chunks (`copilot/chunks/...`)
2. Frontend `useLiveSuggestions` clears its local render state (suggestions array, detected topics, latest suggestion)
3. Banner hides (no suggestion to show)
4. AI Copilot tab shows the empty/idle state message from config

---

## Notes

- **Independent from chatbot.** Live suggestions and the CopilotKit chatbot are completely separate systems. Different system prompt, different backend path, different UI. They share only the `AgentMemory` instance for context hydration (`memoryPrompt`, `searchLongTermMemory`).
- **AI Copilot tab is read-only.** No user input, no buttons, no interactivity beyond scrolling. The tab passively displays what the AI has detected. For interactive Q&A, the user opens the chatbot sidebar.
- **All live suggestion state is stored in Redis per session** using the `copilot/` key prefix (see [Redis Key Structure](#redis-key-structure)). Three stores: `copilot/suggestions/` (generated insights), `copilot/topics/` (detected topic state), and `copilot/chunks/` (raw transcript chunks). These are separate from AMS keys (`working_memory/`, `memory-server/`, `memory_idx/`, etc.) and easy to identify in Redis Insight. All stores are cleared on reset.
- **Raw transcript chunks are stored separately from AMS working memory.** AMS auto-compresses messages and creates summaries when the context window fills up, which means the original verbatim transcript may be lost. The `copilot/chunks/` store preserves the full raw transcript history per session, ensuring the suggestion LLM always has access to the exact chunks regardless of AMS compression.
- **Backend is the single source of truth for topic state.** Topics are pre-seeded on the backend during `createWorkingMemory` (from transcript `meeting.summary.topics`), merged by the backend after each `generateSuggestion` LLM call, and returned as a full state array (not deltas). The frontend never seeds or merges topics -- it just renders what the backend provides. This means `listSuggestions` returns the complete AI Copilot tab state (suggestions + topics) in one call, making session loading trivial.
- **Config-driven everything.** Suggestion types are an object array in `dataset.config.json` (`liveSuggestions.suggestionTypes[]`), each with `id`, `label`, `description`, and `enabled`. The system prompt is built dynamically from enabled entries. The frontend resolves display labels and styling by looking up `suggestion.type` in the array. No hardcoded type keys in code -- new types can be added purely through config. Trigger frequency, all labels, and display text also come from config. Switching datasets updates the copilot behavior automatically.
- **`memoryPrompt` is the key context source.** It combines working memory (what's been said so far) with long-term memory search (what the AI knows from past sessions) into a single hydrated prompt. This gives the LLM rich context for generating relevant suggestions.
- **Detected topics are backend-managed and hybrid.** Pre-seeded from transcript metadata at session creation, then dynamically updated by the LLM. The backend merges all topic updates. The LLM can confirm pre-seeded topics as "discussed" or add entirely new topics with "new" status.
- **The LLM should prefer quality over quantity.** The system prompt instructs the LLM to return `null` if nothing noteworthy happened in the recent segment. Not every trigger needs to produce a suggestion.
- **Banner is the "never miss it" mechanism.** Even if the presenter is on the Working Memory tab watching tokens grow, the banner above the tabs shows the latest suggestion. "View Details" navigates to the AI Copilot tab.
- **The frontend `useLiveSuggestions` hook is a thin client.** It only decides *when* to call `generateSuggestion` (based on chunk index and trigger interval) and stores the response for rendering. No topic seeding, no topic merging, no chunk collection -- all of that lives on the backend. On session load, one `listSuggestions` call gives it the complete tab state.
- The frontend follows the same code style as the rest of the app: arrow functions, consolidated exports, separate type imports, kebab-case files, PascalCase components, CSS-per-component, no emojis in code.

---

## Related Plans

- [Frontend Plan](./dev-frontend-plan.md) -- base frontend architecture (TranscriptPanel + MemoryExplorerPanel)
- [Backend Plan](./dev-backend-plan.md) -- base backend architecture (REST API + AgentMemory)
- [Frontend Chatbot Plan](./dev-frontend-chatbot-plan.md) -- CopilotKit sidebar (complementary, pull-based)
- [Backend Chatbot Plan](./dev-backend-chatbot-plan.md) -- LangGraph agent (complementary, pull-based)
