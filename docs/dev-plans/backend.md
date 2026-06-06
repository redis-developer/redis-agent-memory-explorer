# Backend

## Overview

The backend is a Node.js Express server (`backend/src/`) that provides a POST-only REST API for the frontend. It manages session memory (via cloud RAM), long-term memory search, transcript loading, real-time suggestion generation, and proxies the CopilotKit chatbot to a separate LangGraph server process.

## Entry Point (`index.ts`)

1. Creates a structured logger (console + daily rotating files)
2. Calls `initializeApp()`:
   - Loads dataset config from `data/<dataset>/dataset.config.json`
   - Creates `RedisAgentMemory` singleton (cloud RAM connection)
   - Connects `RedisDb` (local Redis for copilot stores)
   - Sets global `AppState` (datasetConfig, userId)
3. Creates `ApiServer` with routes, CORS, rate limiting, and static file serving
4. Mounts CopilotKit proxy at `/copilotkit`
5. Starts server on configured port

## App State (`app-state.ts`)

A simple module-level object holding runtime state:

```typescript
type AppState = {
  datasetConfig: DatasetConfig | null;
  userId: string;
};
```

Set once during initialization. Handlers access it via `getAppState()`.

## Configuration (`config.ts`)

The `ENV` object parses all environment variables with fallback defaults:

| Key | Source | Default |
|-----|--------|---------|
| `PORT` | `MEETING_MEMORY_PORT` | `3001` |
| `RAM_ENDPOINT` | `RAM_ENDPOINT` | `""` |
| `RAM_API_KEY` | `RAM_API_KEY` | `""` |
| `RAM_STORE_ID` | `RAM_STORE_ID` | `""` |
| `CHATBOT_MODEL` | `MEETING_MEMORY_CHATBOT_MODEL` | `gpt-4o-mini` |
| `BACKGROUND_MODEL` | `MEETING_MEMORY_BACKGROUND_MODEL` | `gpt-4o-mini` |
| `DATA_DIR` | `MEETING_MEMORY_DATA_DIR` | `../../data` |
| `ACTIVE_DATASET` | `MEETING_MEMORY_ACTIVE_DATASET` | `wealth-advisor` |
| `CONTEXT_WINDOW_MAX` | `MEETING_MEMORY_CONTEXT_WINDOW_MAX` | `1500` |
| `ALLOWED_ORIGINS` | `MEETING_MEMORY_ALLOWED_ORIGINS` | `["http://localhost:3000"]` |
| `LANGGRAPH_DEPLOYMENT_URL` | `LANGGRAPH_DEPLOYMENT_URL` | `http://localhost:2024` |
| `LANGSMITH_API_KEY` | `LANGSMITH_API_KEY` | `""` |
| `OPENAI_API_KEY` | `OPENAI_API_KEY` | `""` |
| `REDIS_URL` | `REDIS_URL` | `""` |
| `LOG_DIR` | `MEETING_MEMORY_LOG_DIR` | `../../logs` |

## Routes (`routes.ts`)

All routes are POST-only (body contains the input). Pattern: `{ path: string, handler: RouteHandler }`.

| Route | Handler | Description |
|-------|---------|-------------|
| `/getDataset` | `getDatasetHandler` | Returns the active dataset config |
| `/listDatasets` | `listDatasetsHandler` | Lists available dataset IDs |
| `/listTranscripts` | `listTranscriptsHandler` | Lists transcripts for active dataset |
| `/getTranscript` | `getTranscriptHandler` | Returns full transcript data (meeting + chunks) |
| `/createWorkingMemory` | `createWorkingMemoryHandler` | Creates session ID, seeds topics + chunk store |
| `/appendWorkingMemory` | `appendWorkingMemoryHandler` | Adds event to cloud RAM session + chunk store |
| `/getWorkingMemory` | `getWorkingMemoryHandler` | Gets session memory from cloud RAM |
| `/deleteWorkingMemory` | `deleteWorkingMemoryHandler` | Deletes a session from cloud RAM |
| `/listWorkingMemorySessions` | `listWorkingMemorySessionsHandler` | Lists sessions with pagination |
| `/searchLongTermMemory` | `searchLongTermMemoryHandler` | Semantic/filter search on LTMs |
| `/searchLongTermMemoryBySession` | `searchLongTermMemoryBySessionHandler` | LTMs linked to a session |
| `/generateSuggestion` | `generateSuggestionHandler` | Triggers AI suggestion for a chunk |
| `/listSuggestions` | `listSuggestionsHandler` | Returns all suggestions + topics for a session |
| `/resetLifecycle` | `resetLifecycleHandler` | Deletes all sessions, LTMs, and copilot stores |

## Handlers

### Dataset Handlers (`handlers/dataset.handlers.ts`)

**`getDatasetHandler`**
- Input: none
- Returns: The full `DatasetConfig` object (branding, roles, participants, labels, suggestions config)
- Used by frontend on initial load to configure all UI labels and behavior

**`listDatasetsHandler`**
- Input: none
- Returns: `{ datasets: DatasetSummary[] }` -- array of `{ id, name }` for each available dataset
- Scans the `data/` directory for folders containing `dataset.config.json`

### Transcript Handlers (`handlers/transcript.handlers.ts`)

**`listTranscriptsHandler`**
- Input: none
- Returns: `{ transcripts: TranscriptSummary[] }` -- id, date, type, duration, chunk count, participants
- Lists all transcript JSON files in the active dataset's `transcripts/` folder

**`getTranscriptHandler`**
- Input: `{ transcriptId: string }`
- Returns: `{ meeting: TranscriptMeeting, chunks: TranscriptChunk[] }` -- full meeting metadata + all dialogue chunks
- Used when user selects a transcript for playback

### Working Memory Handlers (`handlers/working-memory.handlers.ts`)

**`createWorkingMemoryHandler`**
- Input: `{ transcriptId: string }`
- Returns: `{ sessionId: string, created: true, memory: { events: [] } }`
- Generates a unique session ID (`playback-<transcriptId>-<timestamp>`), seeds detected topics from transcript metadata into TopicStore, and initializes TranscriptChunkStore. Does NOT create anything in cloud RAM yet -- the cloud session is implicitly created on the first `addSessionEvent`.

**`appendWorkingMemoryHandler`**
- Input: `{ sessionId: string, chunk: TranscriptChunk, isLastChunk: boolean }`
- Returns: `{ eventId: string, latencyMs: number }`
- Formats the chunk as `[timestamp] speaker: text`, resolves the speaker's role to `MessageRole.USER` or `ASSISTANT` via dataset roleMapping, then stores the event in cloud RAM via `ram.addSessionEvent()`. Also appends the raw chunk to the local TranscriptChunkStore (used by the suggestion agent for context).

**`getWorkingMemoryHandler`**
- Input: `{ sessionId: string }`
- Returns: `{ sessionId, ownerId, events: SessionEvent[], summary?: string }`
- Retrieves the full session memory from cloud RAM. If cloud returns null (session was created locally but no events appended yet), returns an empty session structure instead of an error since the session ID is legitimate.

**`deleteWorkingMemoryHandler`**
- Input: `{ sessionId: string }`
- Returns: `{ deleted: true, sessionId }`
- Permanently deletes a session and all its events from cloud RAM.

**`listWorkingMemorySessionsHandler`**
- Input: `{ limit?: number, offset?: number }`
- Returns: `{ sessions: string[], total: number }`
- Lists all session IDs from cloud RAM with pagination. Used by the frontend session dropdown and chatbot tools.

### Long-Term Memory Handlers (`handlers/long-term-memory.handlers.ts`)

**`searchLongTermMemoryHandler`**
- Input: `{ text?: string, memoryType?: MemoryType, topics?: string[], limit?, offset? }`
- Returns: `{ memories: MemoryRecord[], total: number }`
- Performs semantic search across all long-term memories. Always scopes by `ownerId: userId` (from app state). Accepts optional filters for memory type and topics. If no `text` provided, uses `"*"` wildcard to return all (filter-only mode). Uses `searchAllLongTermMemory` which auto-paginates internally.

**`searchLongTermMemoryBySessionHandler`**
- Input: `{ sessionId: string }`
- Returns: `{ memories: MemoryRecord[], total: number }`
- Returns all LTMs that were extracted from a specific session. Filters by `sessionId` only (no semantic search). Used by the frontend LTM tab in "session" scope mode.

### Lifecycle Handler (`handlers/lifecycle.handlers.ts`)

**`resetLifecycleHandler`**
- Input: none
- Returns: `{ sessionsDeleted: number, memoriesDeleted: number }`
- The "Reset (delete all memories)" action. Destructive -- clears everything for the current user in 3 steps:
  1. Lists all sessions in batches (limit 100), deletes each from cloud RAM
  2. Searches LTMs by `ownerId: userId` in a loop, deletes each batch until none remain
  3. Clears all local copilot stores (suggestions, topics, transcript chunks) via Redis SCAN + DEL

### Suggestion Handlers (`handlers/suggestion.handlers.ts`)

**`generateSuggestionHandler`**
- Input: `{ sessionId: string, chunkIndex: number }`
- Returns: `{ suggestion: Suggestion | null, detectedTopics: DetectedTopic[] }`
- Triggers the full suggestion pipeline (see `docs/dev-plans/suggestions.md`). Extracts a search query from recent chunks, hydrates memory context, invokes the LLM, and persists results. Returns null suggestion if nothing noteworthy detected.

**`listSuggestionsHandler`**
- Input: `{ sessionId: string }`
- Returns: `{ suggestions: Suggestion[], detectedTopics: DetectedTopic[], total: number }`
- Returns all previously generated suggestions and the current topic state from local Redis stores. No LLM calls -- purely reads persisted data.

## Services

### Dataset Loader Service (`services/dataset-loader.service.ts`)

Static methods:
- `loadDatasetConfig(datasetId)`: Reads + parses `dataset.config.json`
- `listDatasets()`: Scans data directory for available datasets

### Transcript Loader Service (`services/transcript-loader.service.ts`)

Static methods:
- `loadTranscript(datasetId, transcriptId)`: Reads + parses transcript JSON
- `listTranscripts(datasetId)`: Lists available transcript files

### Redis JSON Store (`services/redis-json-store.ts`)

Generic Redis JSON operations for copilot auxiliary data. Key pattern: `copilot:<entityPrefix>:<userId>[:<sessionId>]`.

Operations: `getItems`, `setItems`, `appendItem`, `countItems`, `clearItems`, `clearAllItems`.

### Specialized Stores

Each extends the generic store with domain logic:
- **`SuggestionStore`** (`services/suggestion-store.ts`): `initialize`, `add`, `list`, `clearAll`
- **`TopicStore`** (`services/topic-store.ts`): `initialize`, `get`, `update`, `clearAll`
- **`TranscriptChunkStore`** (`services/transcript-chunk-store.ts`): `initialize`, `append`, `getRecent`, `count`, `clearAll`

## Constants (`constants.ts`)

Key constants:

| Constant | Value | Purpose |
|----------|-------|---------|
| `SESSION_ID_PREFIX` | `"playback"` | Prefix for generated session IDs |
| `DEFAULT_LIST_LIMIT` | `100` | Default pagination limit |
| `DEFAULT_LIST_OFFSET` | `0` | Default pagination offset |
| `AGENT_SEARCH_DEFAULT_LIMIT` | `50` | Default limit for chatbot agent LTM searches |
| `COPILOTKIT_ENDPOINT` | `"/copilotkit"` | CopilotKit proxy mount path |
| `COPILOTKIT_GRAPH_ID` | `"memoryAgent"` | LangGraph graph ID |
| `SUGGESTION_CHUNK_WINDOW` | `10` | Recent chunks for suggestion context |
| `DetectedTopicStatus` | `pending/discussed/new/question` | Topic lifecycle states |
| `DetectedTopicSource` | `pre-seeded/ai-detected` | How topic was discovered |

## CopilotKit Integration

The backend proxies `/copilotkit` requests to the LangGraph server. The proxy handles:
- Forwarding HTTP requests to `LANGGRAPH_DEPLOYMENT_URL`
- CopilotKit uses this to connect the frontend chat sidebar to the LangGraph ReAct agent

See `docs/dev-plans/chatbot.md` for the agent's implementation details.

## API Contract

All endpoints accept POST with JSON body. Response is always JSON.

### Request/Response Examples

**POST /createWorkingMemory**
```json
// Request
{ "transcriptId": "meeting-2024-12-01" }
// Response
{ "sessionId": "playback-meeting-2024-12-01-1715000000", "created": true, "memory": { "events": [] } }
```

**POST /appendWorkingMemory**
```json
// Request
{ "sessionId": "playback-...", "chunk": { "timestamp": "00:01:30", "speaker": "Sarah Chen", "role": "advisor", "text": "Let's discuss..." }, "isLastChunk": false }
// Response
{ "eventId": "evt_abc123", "latencyMs": 245 }
```

**POST /getWorkingMemory**
```json
// Request
{ "sessionId": "playback-..." }
// Response
{ "sessionId": "...", "ownerId": "sarah-chen", "events": [...], "summary": null }
```

**POST /searchLongTermMemory**
```json
// Request
{ "text": "portfolio allocation", "memoryType": "episodic" }
// Response
{ "memories": [...], "total": 5 }
```

**POST /resetLifecycle**
```json
// Request
{}
// Response
{ "sessionsDeleted": 3, "memoriesDeleted": 12 }
```

**POST /generateSuggestion**
```json
// Request
{ "sessionId": "playback-...", "chunkIndex": 15 }
// Response
{ "suggestion": { "id": "...", "type": "insight", "title": "...", ... }, "detectedTopics": [...] }
```
