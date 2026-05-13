# Suggestions System

## Overview

The suggestions system is a real-time AI copilot that analyzes transcript chunks during playback and generates context-aware suggestions. It detects topics, tracks their lifecycle, and produces actionable insights by combining the live transcript with long-term memory context from cloud RAM.

## Architecture

```
Frontend (useSuggestions hook)
  │  every N chunks (triggerEveryNChunks from config)
  │  POST /generateSuggestion { sessionId, chunkIndex }
  ▼
Backend (suggestion.handlers.ts)
  │
  ▼
Suggestion Agent Pipeline (generate-suggestion.ts)
  │
  ├─ 1. Fetch recent chunks from TranscriptChunkStore (last 10)
  ├─ 2. Fetch detected topics from TopicStore
  ├─ 3. Extract search query from chunks (LLM call)
  ├─ 4. Hydrate memory context via ram.buildMemoryPrompt()
  ├─ 5. Invoke suggestion LLM with system prompt + memory + chunks
  ├─ 6. Parse LLM JSON response
  ├─ 7. Persist suggestion to SuggestionStore
  └─ 8. Merge topic updates to TopicStore
  │
  ▼
Response: { suggestion, detectedTopics }
```

## Pipeline Steps

### 1. Fetch Recent Chunks
Retrieves the last `SUGGESTION_CHUNK_WINDOW` (10) chunks from `TranscriptChunkStore` for the current session. These represent the most recent conversation context.

### 2. Fetch Detected Topics
Gets the current topic state from `TopicStore`. Topics have lifecycle states (`pending`, `discussed`, `new`, `question`) and sources (`pre-seeded`, `ai-detected`).

### 3. Extract Search Query (`query-extraction.ts`)
Uses an LLM call to distill the recent chunks into a semantic search query (max 100 tokens). This query is then used to find relevant long-term memories.

```
Input:  Last 10 transcript chunks
Output: Natural language search query (e.g., "portfolio allocation bonds retirement")
```

### 4. Hydrate Memory Context
Calls `ram.buildMemoryPrompt()` with the extracted query and session ID. Returns combined session + LTM context that the suggestion LLM can use for informed analysis.

### 5. Invoke Suggestion LLM (`system-prompt.ts`)
The system prompt includes:
- Context (dataset, participants, roles)
- Enabled suggestion types (from config)
- Current topic state (pending vs discussed)
- Previous suggestions (for deduplication)
- Memory context usage instructions
- Strict response format (JSON with suggestion + topicUpdates)

### 6. Parse LLM Response
Expects JSON with:
```json
{
  "suggestion": { "type", "title", "summary", "details", "relatedTopics" } | null,
  "topicUpdates": [{ "name", "status", "detectedAtTimestamp" }]
}
```
Handles code fences and parsing errors gracefully (returns null on failure).

### 7. Persist Suggestion
If the LLM returned a non-null suggestion, it's enriched with metadata (id, chunkIndex, timestamp, createdAt) and stored in `SuggestionStore`.

### 8. Merge Topic Updates
Two sources of topic signals:
- **Explicit**: `topicUpdates` from LLM response
- **Implicit**: `relatedTopics` from suggestion (treated as "discussed" if not in updates)

`TopicStore.mergeUpdates()` handles:
- First detection (fills `detectedAt*` fields)
- Re-mentions (appends to history array)
- New topics (creates with `ai-detected` source)

## Configuration (from `dataset.config.json`)

```json
{
  "suggestions": {
    "title": "AI Copilot",
    "description": "...",
    "bannerLabel": "Latest insight",
    "topicsTitle": "Detected Topics",
    "insightsTitle": "Generated Insights",
    "waitingMessage": "Analyzing conversation...",
    "noSuggestionsMessage": "No suggestions yet.",
    "triggerEveryNChunks": 5,
    "suggestionTypes": [
      { "id": "topicRecall", "label": "Topic recall", "description": "...", "enabled": true },
      { "id": "agendaReminder", "label": "Agenda reminder", "description": "...", "enabled": true },
      { "id": "lifeEvent", "label": "Life event", "description": "...", "enabled": true },
      { "id": "sentimentShift", "label": "Sentiment shift", "description": "...", "enabled": true }
    ]
  }
}
```

## Data Stores

### SuggestionStore
- Key pattern: `copilot:suggestions:<userId>:<sessionId>`
- Operations: `add`, `list`, `clear`, `clearAll`
- Data: Array of `Suggestion` objects (JSON)

### TopicStore
- Key pattern: `copilot:topics:<userId>:<sessionId>`
- Operations: `initialize`, `get`, `mergeUpdates`, `clear`, `clearAll`
- Data: Array of `DetectedTopic` objects (JSON)

### TranscriptChunkStore
- Key pattern: `copilot:chunks:<userId>:<sessionId>`
- Operations: `initialize`, `append`, `getRecent`, `getRange`, `count`, `clearAll`
- Data: Array of `TranscriptChunk` objects (JSON)

All stores use local Redis (not cloud RAM) via the `cau-redis` package and generic `redis-json-store` utilities.

## Frontend Integration

### `useSuggestions` Hook
Located in `components/business/memory-explorer-panel/ai-copilot/use-suggestions.ts`.

Triggers suggestion generation based on:
- Current `chunkIndex` modulo `triggerEveryNChunks` === 0
- Session is active
- Not already generating

Maintains state: `suggestions[]`, `detectedTopics[]`, `latestSuggestion`, `isGenerating`.

### UI Components
- **`SuggestionBanner`**: Shows the latest suggestion at the top of the explorer panel
- **`AiCopilotTab`**: Full view with all suggestions + detected topics
- **`SuggestionCard`**: Individual suggestion with type, title, summary, details
- **`DetectedTopics`**: Topic list with colored status badges

## Topic Lifecycle

```
Pre-seeded (from transcript metadata)
  └─ pending ─────────────────────────────────────────┐
                                                      │
AI-detected (new topic mentioned in conversation)     │
  └─ new ──────────────────────────────────────────┐  │
                                                   ▼  ▼
                                              discussed
                                                   │
                                                   ▼
                                              question (if client asked)
```

- **Pre-seeded topics**: Loaded from `transcript.meeting.summary.topics` when session is created
- **AI-detected topics**: Discovered by the LLM during suggestion generation
- **History tracking**: Each topic maintains an array of mentions with chunk index and timestamp

## Suggestion Types

| Type | Purpose | Trigger |
|------|---------|---------|
| `topicRecall` | Cross-reference current discussion with past meeting memories | Client revisits a topic from previous sessions |
| `agendaReminder` | Remind that pending topics haven't been covered | Conversation moves on without discussing a seeded topic |
| `lifeEvent` | Flag significant life events mentioned | Client mentions retirement, property, inheritance, etc. |
| `sentimentShift` | Detect emotional changes in the conversation | Client expresses anxiety, frustration, excitement |

## Deduplication

The LLM system prompt enforces strict deduplication:
- Previous suggestions are passed to the LLM as context
- If a new suggestion would cover the same theme/topic/sentiment, the LLM returns null
- Same-type suggestions about the same subject (even with different wording) are considered duplicates

## Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `SUGGESTION_CHUNK_WINDOW` | `10` | How many recent chunks to analyze |
| `QUERY_EXTRACTION_MAX_TOKENS` | `100` | Max tokens for extracted search query |
| `DEFAULT_TRIGGER_EVERY_N_CHUNKS` | `5` | Fallback trigger interval (overridden by config) |
