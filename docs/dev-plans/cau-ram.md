# cau-ram Package

## Overview

`cau-ram` is the core integration package that wraps the Redis Agent Memory cloud SDK (`@redis-ai/agent-memory`). It provides a singleton-based facade with typed operations for session memory, long-term memory, memory prompt generation, and policy-based memory deletion. It also implements custom intelligence features (token-budgeted prompt assembly, LLM summarization) that the cloud doesn't natively provide.

> **Note**: The SDK is currently vendored locally at `packages/agent-memory-ts-sdk/`. Once the `@redis-ai/agent-memory` package is published to npm, remove the vendored folder and switch the dependency in `cau-ram/package.json` to the npm version.

## Architecture

```
cau-ram/
  src/
    index.ts                     # Public exports (class + types + constants)
    redis-agent-memory.ts        # Singleton class (public API surface)
    types.ts                     # All type definitions
    config.ts                    # Environment variable loading
    constants.ts                 # Constants + model context windows
    operations/
      session-memory/
        index.ts                 # addSessionEvent, getSessionMemory, getSessionEvent, deleteSessionEvent, deleteSessionMemory, listSessions
        index.test.ts            # Integration tests
      long-term-memory/
        index.ts                 # createLongTermMemories, searchLongTermMemory, searchAllLongTermMemory, getLongTermMemory, updateLongTermMemory, deleteLongTermMemories
        build-filters.util.ts    # Filter construction helpers
        index.test.ts            # Integration tests
      memory-prompt/
        index.ts                 # buildMemoryPrompt (main orchestrator)
        token-counter.util.ts    # js-tiktoken token counting
        model-limits.util.ts     # Context window resolution
        summarize-messages.util.ts # LangChain-based LLM summarization
        index.test.ts            # Integration tests
      forget-memories/
        index.ts                 # forgetMemories (policy-based deletion)
        index.test.ts            # Integration tests
```

## Singleton Pattern

```typescript
RedisAgentMemory.create({ ram: { endpoint, apiKey, storeId }, llm: { model, apiKey } });
const ram = RedisAgentMemory.getInstance();
```

- `create()` merges explicit config with env-loaded defaults
- `getInstance()` returns the singleton (throws if not initialized)
- `resetInstance()` clears the singleton (for testing)

## Configuration

Environment variables loaded by `config.ts`:

| Variable | Required | Config Key | Purpose |
|----------|----------|------------|---------|
| `RAM_ENDPOINT` | Yes | `ram.endpoint` | Cloud API server URL |
| `RAM_API_KEY` | Yes | `ram.apiKey` | Cloud API key |
| `RAM_STORE_ID` | Yes | `ram.storeId` | Tenant/store identifier |
| `OPENAI_API_KEY` | No | `llm.apiKey` | OpenAI key for summarization |
| `SUMMARY_MODEL` | No | `llm.model` | Model for summarization (e.g., `gpt-4o-mini`) |

LLM config is optional; without it, `buildMemoryPrompt` falls back to trimming messages instead of summarizing.

## Public API

### Session Memory

| Method | Signature | Description |
|--------|-----------|-------------|
| `addSessionEvent` | `(input: SessionEventInput) => SessionEvent` | Adds an event to a session |
| `getSessionMemory` | `(sessionId: string) => SessionMemory \| null` | Gets all events for a session |
| `getSessionEvent` | `(sessionId: string, eventId: string) => SessionEvent` | Gets a single event |
| `deleteSessionEvent` | `(sessionId: string, eventId: string) => void` | Deletes a single event |
| `deleteSessionMemory` | `(sessionId: string) => void` | Deletes entire session |
| `listSessions` | `(options?: SessionListOptions) => SessionListResult` | Lists session IDs with pagination |

### Long-Term Memory

| Method | Signature | Description |
|--------|-----------|-------------|
| `createLongTermMemories` | `(records: CreateMemoryInput[]) => BulkCreateResult` | Creates multiple LTMs |
| `searchLongTermMemory` | `(options?: MemorySearchOptions) => MemorySearchResult` | Searches with pagination |
| `searchAllLongTermMemory` | `(options?) => { memories: MemoryRecord[] }` | Auto-paginates all results |
| `getLongTermMemory` | `(memoryId: string) => MemoryRecord` | Gets a single LTM by ID |
| `updateLongTermMemory` | `(memoryId: string, updates: MemoryUpdateInput) => MemoryRecord` | Updates an LTM |
| `deleteLongTermMemories` | `(memoryIds: string[]) => BulkDeleteResult` | Deletes multiple LTMs |

**Validation**: `searchLongTermMemory` and `searchAllLongTermMemory` validate that at least `text` or `filter` is provided (cloud API requirement).

### Memory Prompt (`buildMemoryPrompt`)

Assembles an LLM-ready context string from session events + LTM search results, with token budgeting.

```typescript
const result = await ram.buildMemoryPrompt({
  query: "What did we discuss about portfolio allocation?",
  sessionId: "playback-meeting-...",
  ownerId: "sarah-chen",
  modelName: "gpt-4o-mini",
  contextWindowMax: 1500,  // optional override
  longTermSearch: true,    // or custom MemorySearchOptions, or false to disable
});
// result.context       - formatted markdown context string
// result.sessionSummary - LLM summary (if session was too large)
// result.recentSessionEvents - events included verbatim
// result.longTermMemories - LTM data included
// result.tokenUsage    - { budget, used }
```

**Token budgeting strategy:**
1. Determine total budget (from `contextWindowMax` or `modelName` lookup or default 128k)
2. Calculate fixed costs: `queryTokens + ltmTokens + FORMATTING_OVERHEAD (200)`
3. Remaining budget = session budget
4. If all session events fit in budget → include all verbatim
5. If they exceed budget AND LLM config exists → summarize all messages via LLM (asking for ~50% of budget)
6. If no LLM config → trim from the beginning (keep most recent messages)

**Output format:**
```markdown
## Long-Term Memory
- [episodic, coding] User prefers TypeScript over JavaScript
- [semantic] Project uses npm workspaces monorepo structure

## Session Summary
User discussed project setup and chose Redis for caching.

## Recent Conversation
USER: What about vector search?
ASSISTANT: Redis supports vector similarity search via RediSearch.
```

### Forget Memories (`forgetMemories`)

Policy-based deletion with explicit boolean flags:

```typescript
const result = await ram.forgetMemories({
  includeSession: true,
  includeLtm: true,
  session: { sessionId: "playback-..." },
  ltm: { ownerId: "sarah-chen", topics: ["portfolio"] },
});
// result.deletedSessionIds, result.deletedLtmIds, result.totalDeleted
```

**Validation rules:**
- If `includeSession: true`, `session.sessionId` is required
- If `includeLtm: true`, at least one criterion in `ltm` is required (ownerId, namespace, topics, sessionId, or text)

### Health

```typescript
const { status } = await ram.health(); // "ok" or error
```

## Key Types

```typescript
type SessionEventInput = { sessionId, actorId, role: MessageRole, content, createdAt?, metadata? };
type SessionEvent = { eventId, sessionId, actorId, role, content, createdAt, metadata? };
type SessionMemory = { sessionId, ownerId, events: SessionEvent[] };

type CreateMemoryInput = { text, id?, memoryType?, sessionId?, ownerId?, namespace?, topics? };
type MemoryRecord = { id, text, memoryType?, sessionId?, ownerId?, namespace?, topics?, createdAt, updatedAt };
type MemoryFilter = { sessionId?, ownerId?, namespace?, topics?, memoryType?, createdAfter?, createdBefore? };
type MemorySearchOptions = { text?, filter?, filterOp?, limit?, pageToken?, similarityThreshold? };

type BuildMemoryPromptOptions = { query, sessionId?, ownerId?, namespace?, modelName?, contextWindowMax?, longTermSearch? };
type MemoryPromptResult = { context, sessionSummary?, recentSessionEvents, longTermMemories, tokenUsage: { budget, used } };

type ForgetOptions = { includeSession: boolean, includeLtm: boolean, session?, ltm? };
type ForgetResult = { deletedSessionIds, deletedLtmIds, totalDeleted };
```

## Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `MessageRole` | `USER / ASSISTANT / SYSTEM` | Event roles |
| `MemoryType` | `semantic / episodic / message` | LTM classification |
| `FilterOp` | `all / any` | Multi-filter combination logic |
| `DEFAULT_LTM_SEARCH_LIMIT` | `20` | Default limit for raw LTM searches |
| `DEFAULT_LTM_PROMPT_LIMIT` | `10` | LTM limit for memory prompt results |
| `DEFAULT_LIST_LIMIT` | `50` | Default session list pagination |
| `FORMATTING_OVERHEAD_TOKENS` | `200` | Token budget reserved for formatting |
| `PER_MESSAGE_TOKEN_OVERHEAD` | `4` | Token overhead per message (role prefix) |
| `DEFAULT_CONTEXT_WINDOW` | `128_000` | Fallback context window size |
| `MODEL_CONTEXT_WINDOWS` | Map<string, number> | Known model limits (gpt-4o, claude-3, gemini, etc.) |

## Cloud RAM Behavior Notes

- **Async LTM extraction**: Cloud automatically extracts long-term memories from session events in the background (~5-7 minutes). All auto-extracted are `episodic` type.
- **Deduplication**: Duplicate session insertions don't create duplicate LTMs.
- **Contradiction resolution**: Contradicting information updates existing LTMs rather than creating new ones.
- **No namespace on auto-extracted**: Cloud extraction doesn't set `namespace`. Use `ownerId` for scoping.
- **Search validation**: API returns 400 if neither `text` nor `filter` provided. `cau-ram` validates client-side.
- **FLUSHALL**: Destroys the search index. Recovery takes significant time. Never use in production.

## Utility Modules

### Token Counter (`token-counter.util.ts`)
- Uses `js-tiktoken` with `cl100k_base` encoding
- `countTokens(text, modelName?)` -- counts tokens in a string
- `countMessagesTokens(messages, modelName?)` -- counts tokens for an array of messages

### Model Limits (`model-limits.util.ts`)
- `getModelContextWindow(modelName?)` -- exact-match lookup in `MODEL_CONTEXT_WINDOWS`, falls back to `DEFAULT_CONTEXT_WINDOW`
- `getEffectiveTokenLimit(modelName?, contextWindowMax?)` -- returns `contextWindowMax` if provided, otherwise model lookup

### Summarize Messages (`summarize-messages.util.ts`)
- `summarizeMessages(messages, llmConfig, tokenBudget)` -- calls OpenAI (via LangChain `ChatOpenAI`) to produce a summary within the given token budget
- Returns the summary string or empty string on failure

## Testing

Tests are co-located with operations (`index.test.ts` in each folder). They run against the real cloud endpoint (no mocking). Key test setup:
- `vitest.config.ts` with `fileParallelism: false`, `sequence: { concurrent: false }`
- `dotenv` loaded from root `.env`
- 3-second delay between tests (rate limit mitigation)
- `testTimeout: 60000` for network-dependent tests
