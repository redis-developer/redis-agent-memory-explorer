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
| Backend architecture        | **New REST endpoints** (`generateSuggestion` + `listSuggestions`), suggestions stored per session |
| Context for LLM             | `memoryPrompt` (working memory + LT search) + recent chunks + participant info                    |
| Suggestion types            | **Object array in dataset config** (`suggestionTypes[]` with id, label, description, enabled)     |
| Detected topics             | **Hybrid** -- pre-seeded from transcript `meeting.summary.topics` + AI adds new ones dynamically  |
| Chatbot relationship        | **Independent system**, reuses `AgentMemory` methods but separate LLM call and system prompt      |
| Default tab during playback | **AI Copilot tab is the default** when playback starts (read-only tab)                            |

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
│  │   1. Hydrate context via AgentMemory.memoryPrompt()                │ │
│  │   2. Direct LLM call (ChatOpenAI) with suggestion system prompt    │ │
│  │   3. Store suggestion in session-scoped in Redis          │ │
│  │   4. Return suggestion (or null if nothing noteworthy)             │ │
│  │                                                                     │ │
│  │ listSuggestionsHandler:                                             │ │
│  │   Return all stored suggestions for a session                      │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  Existing routes (unchanged): /api/appendWorkingMemory, etc.            │
└──────────────────────────────────────────────────────────────────────────┘
```

---

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

Called by the frontend every N chunks during playback. The backend:

1. Hydrates context via `AgentMemory.memoryPrompt()` (working memory + LT search)
2. Makes a direct LLM call (`ChatOpenAI`) with a suggestion-specific system prompt
3. Stores the suggestion in Redis as JSON with session id field (Redis keyed by sessionId)
4. Returns the suggestion (or `null` if nothing noteworthy)

**Request:**

```json
{
  "sessionId": "playback-2026-02-26-google-meet-1773247345966",
  "recentChunks": [
    {
      "timestamp": "00:12:00",
      "speaker": "James Morrison",
      "role": "client",
      "text": "..."
    },
    {
      "timestamp": "00:12:15",
      "speaker": "James Morrison",
      "role": "client",
      "text": "...Maya's been talking about retiring early..."
    },
    {
      "timestamp": "00:12:42",
      "speaker": "Sarah Chen",
      "role": "rm",
      "text": "That's a big change..."
    }
  ],
  "chunkIndex": 24,
  "detectedTopics": [
    { "name": "REIT rebalancing", "status": "discussed" },
    { "name": "Education fund", "status": "pending" }
  ]
}
```

- `recentChunks` -- the last N chunks (window) for the LLM to analyze
- `chunkIndex` -- current position in the transcript (for context)
- `detectedTopics` -- current state of the topic checklist (so the LLM knows what's been covered and can suggest agenda reminders)

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
    "topicUpdates": [
      {
        "name": "Spouse retirement",
        "status": "new",
        "detectedAtTimestamp": "00:12:15"
      }
    ]
  }
}
```

**Response (nothing noteworthy):**

```json
{
  "data": {
    "suggestion": null,
    "topicUpdates": []
  }
}
```

- `topicUpdates` -- any changes to detected topics (new topics discovered, existing topics confirmed as discussed). The frontend merges these into its local topic state.

**Implementation approach:**

```typescript
const generateSuggestionHandler: RouteHandler = async (input, { logger }) => {
  const { namespace, userId } = getAppState();
  const { sessionId, recentChunks, chunkIndex, detectedTopics } = input;

  // 1. Hydrate context via memoryPrompt
  const memoryContext = await AgentMemory.getInstance().memoryPrompt({
    query: recentChunks
      .map((c) => `[${c.timestamp}] ${c.speaker}: ${c.text}`)
      .join("\n"),
    session: { sessionId, userId, modelName: ENV.MODEL_NAME },
    longTermSearch: { namespace: { eq: namespace }, userId: { eq: userId } },
  });

  // 2. Build system prompt with enabled suggestion types from dataset config
  const systemPrompt = buildSuggestionSystemPrompt(
    datasetConfig,
    detectedTopics,
  );

  // 3. Direct LLM call
  const llm = new ChatOpenAI({ model: ENV.CHATBOT_MODEL, temperature: 0 });
  const result = await llm.invoke([
    new SystemMessage(systemPrompt),
    new SystemMessage(`Memory context:\n${JSON.stringify(memoryContext)}`),
    new HumanMessage(formatRecentChunks(recentChunks)),
  ]);

  // 4. Parse structured response
  const parsed = parseSuggestionResponse(result.content);

  // 5. Store suggestion if non-null
  if (parsed.suggestion) {
    suggestionStore.add(sessionId, parsed.suggestion);
  }

  return parsed;
};
```

#### `POST /api/listSuggestions`

Returns all stored suggestions for a session. Used by the frontend to populate the AI Copilot tab on initial load (e.g., when loading an existing session) or to sync after reconnection.

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
    "total": 2
  }
}
```

### Suggestion Storage

Suggestions are stored in Redis on the backend. The `resetLifecycle` handler clears the store.

```typescript
// redis-store.ts

const add = (sessionId: string, suggestion: LiveSuggestion): void => { ... };
const list = (sessionId: string): LiveSuggestion[] => { ... };
const clear = (sessionId: string): void => { ... };
const clearAll = (): void => { ... };
```

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
│   ├── suggestion-system-prompt.ts         # System prompt builder for suggestions
│   ├── suggestion.service.ts               # LLM call logic (hydrate context + generate)
│   └── index.ts                            # Barrel export
│
├── handlers/
│   ├── suggestion.handlers.ts              # NEW: generateSuggestion, listSuggestions
│   └── ... (existing, unchanged)
│
├── services/
│   ├── suggestion-store.ts                 # NEW: redis store Map<sessionId, LiveSuggestion[]>
│   └── ... (existing, unchanged)
│
├── routes.ts                               # MODIFIED: add suggestion routes
├── types.ts                                # MODIFIED: add suggestion types
├── constants.ts                            # MODIFIED: add suggestion constants
└── ... (existing, unchanged)
```

**Note:** Renaming `agent/` to `chatbot-agent/` requires updating imports in `index.ts` (the CopilotKit mount) and `langgraph.json` (the graph path). The `langgraph.json` graph entry becomes `"./src/chatbot-agent/graph.ts:compiledGraph"`.

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

Lives inside `memory-explorer-panel/ai-copilot/`. Manages the suggestion trigger timing, API calls, and state.

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

1. Receives `chunkIndex` (from playback), `sessionId`, `isPlaying`, `triggerEveryNChunks`, and the transcript `chunks` array as inputs
2. Tracks the last chunk index that triggered a suggestion call
3. When `chunkIndex - lastTriggeredIndex >= triggerEveryNChunks` AND `isPlaying`:
   - Collect the last N chunks as `recentChunks`
   - Call `POST /api/generateSuggestion` with `{ sessionId, recentChunks, chunkIndex, detectedTopics }`
   - On response: append suggestion to local array (if non-null), merge `topicUpdates` into `detectedTopics`
4. On session load (existing session): call `POST /api/listSuggestions` to populate history
5. On reset: clear all state

**Topic initialization:**

When a transcript is selected and playback starts, the hook reads `transcriptData.meeting.summary.topics` and seeds `detectedTopics` with those entries as `status: "pending"`, `source: "pre-seeded"`.

### Wiring: How the Trigger Flows

The frontend already has `chunkIndex` (from `useTranscriptPlayback` inside TranscriptPanel) and `lastAppendResult` flowing to MemoryExplorerPanel. For live suggestions, we need `chunkIndex` and the `chunks` array to flow to `useLiveSuggestions`. This means DemoPage needs to bridge one more piece of state from TranscriptPanel to MemoryExplorerPanel.

```
DemoPage
  │
  ├── State: sessionId, lastAppendResult
  │   NEW: currentChunkIndex, transcriptChunks
  │
  ├──► TranscriptPanel
  │     callbacks: onSessionCreated, onReset, onAppendResult
  │     NEW callback: onChunkPlayed(chunkIndex, chunks)
  │
  └──► MemoryExplorerPanel
        props: sessionId, lastAppendResult, datasetConfig
        NEW props: currentChunkIndex, transcriptChunks, isPlaying
        │
        └── useLiveSuggestions(sessionId, currentChunkIndex, transcriptChunks, isPlaying, config)
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
TranscriptPanel                DemoPage              MemoryExplorerPanel              Backend
  │                               │                       │                              │
  │ (chunk 24 played)             │                       │                              │
  │ onChunkPlayed(24, chunks)     │                       │                              │
  │──────────────────────────────>│                       │                              │
  │                               │ currentChunkIndex=24  │                              │
  │                               │──────────────────────>│                              │
  │                               │                       │                              │
  │                               │                       │ useLiveSuggestions:           │
  │                               │                       │ 24 - 19 = 5 >= triggerN(5)   │
  │                               │                       │ → trigger suggestion call     │
  │                               │                       │                              │
  │                               │                       │ POST /api/generateSuggestion │
  │                               │                       │ { sessionId, recentChunks    │
  │                               │                       │   [20..24], chunkIndex: 24,  │
  │                               │                       │   detectedTopics: [...] }    │
  │                               │                       │─────────────────────────────>│
  │                               │                       │                              │
  │                               │                       │                              │ 1. memoryPrompt()
  │                               │                       │                              │ 2. LLM call
  │                               │                       │                              │ 3. Store suggestion
  │                               │                       │                              │
  │                               │                       │ { suggestion: {              │
  │                               │                       │     type: "lifeEvent",       │
  │                               │                       │     title: "Spouse Early     │
  │                               │                       │       Retirement Detected",  │
  │                               │                       │     ... },                   │
  │                               │                       │   topicUpdates: [{           │
  │                               │                       │     name: "Spouse retirement",│
  │                               │                       │     status: "new" }] }       │
  │                               │                       │<─────────────────────────────│
  │                               │                       │                              │
  │                               │                       │ → Update suggestions array   │
  │                               │                       │ → Merge topic updates        │
  │                               │                       │ → Banner shows new suggestion│
  │                               │                       │ → AI Copilot tab updates     │
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
| 2     | Backend: `suggestion-store.ts` (in-memory store)                                                | Storage before handlers       |
| 3     | Backend: `suggestion-system-prompt.ts`                                                          | System prompt before handler  |
| 4     | Backend: `suggestion.handlers.ts` (generateSuggestion + listSuggestions) + route registration   | Core backend                  |
| 5     | Frontend: `api.service.ts` additions (generateSuggestion, listSuggestions)                      | API connectivity              |
| 6     | Frontend: `use-live-suggestions.ts` hook                                                        | Core frontend logic           |
| 7     | Frontend: `suggestion-card.component.tsx` + `detected-topics.component.tsx`                     | Sub-components                |
| 8     | Frontend: `ai-copilot-tab.component.tsx`                                                        | Tab content                   |
| 9     | Frontend: `suggestion-banner.component.tsx`                                                     | Persistent banner             |
| 10    | Frontend: Wire into `memory-explorer-panel.component.tsx` (add tab, add banner, auto-switch)    | Integration                   |
| 11    | Frontend: Bridge `currentChunkIndex` / `transcriptChunks` from TranscriptPanel through DemoPage | Playback → suggestions wiring |
| 12    | Test end-to-end + tune `triggerEveryNChunks` and system prompt                                  | Polish                        |

---

## Reset Behavior

When "Clear All Memories & Restart" is clicked:

1. Backend `resetLifecycle` handler calls `suggestionStore.clearAll()` (clear all stored suggestions)
2. Frontend `useLiveSuggestions` clears its state (suggestions array, detected topics, latest suggestion)
3. Banner hides (no suggestion to show)
4. AI Copilot tab shows the empty/idle state message from config

---

## Notes

- **Independent from chatbot.** Live suggestions and the CopilotKit chatbot are completely separate systems. Different system prompt, different backend path, different UI. They share only the `AgentMemory` instance for context hydration (`memoryPrompt`, `searchLongTermMemory`).
- **AI Copilot tab is read-only.** No user input, no buttons, no interactivity beyond scrolling. The tab passively displays what the AI has detected. For interactive Q&A, the user opens the chatbot sidebar.
- **Suggestions are stored per session** in an in-memory Map on the backend. This allows `listSuggestions` to return the full history (useful when loading an existing session). The store is cleared on reset.
- **Config-driven everything.** Suggestion types are an object array in `dataset.config.json` (`liveSuggestions.suggestionTypes[]`), each with `id`, `label`, `description`, and `enabled`. The system prompt is built dynamically from enabled entries. The frontend resolves display labels and styling by looking up `suggestion.type` in the array. No hardcoded type keys in code -- new types can be added purely through config. Trigger frequency, all labels, and display text also come from config. Switching datasets updates the copilot behavior automatically.
- **`memoryPrompt` is the key context source.** It combines working memory (what's been said so far) with long-term memory search (what the AI knows from past sessions) into a single hydrated prompt. This gives the LLM rich context for generating relevant suggestions.
- **Detected topics are hybrid.** Pre-seeded from transcript metadata at playback start, then dynamically updated by the LLM. The LLM can confirm pre-seeded topics as "discussed" or add entirely new topics with "new" status.
- **The LLM should prefer quality over quantity.** The system prompt instructs the LLM to return `null` if nothing noteworthy happened in the recent segment. Not every trigger needs to produce a suggestion.
- **Banner is the "never miss it" mechanism.** Even if the presenter is on the Working Memory tab watching tokens grow, the banner above the tabs shows the latest suggestion. "View Details" navigates to the AI Copilot tab.
- The frontend follows the same code style as the rest of the app: arrow functions, consolidated exports, separate type imports, kebab-case files, PascalCase components, CSS-per-component, no emojis in code.

---

## Related Plans

- [Frontend Plan](./dev-frontend-plan.md) -- base frontend architecture (TranscriptPanel + MemoryExplorerPanel)
- [Backend Plan](./dev-backend-plan.md) -- base backend architecture (REST API + AgentMemory)
- [Frontend Chatbot Plan](./dev-frontend-chatbot-plan.md) -- CopilotKit sidebar (complementary, pull-based)
- [Backend Chatbot Plan](./dev-backend-chatbot-plan.md) -- LangGraph agent (complementary, pull-based)
