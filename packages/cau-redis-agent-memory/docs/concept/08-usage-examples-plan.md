# Usage Examples Plan

All examples use our `AgentMemory` wrapper class + `@langchain/openai` / `@langchain/langgraph`
for LLM interactions. They live in `examples/` and are written **after** the package is built.

---

## Example 1: Chatbot with Working Memory (Core Loop)

**File**: `examples/01-chatbot-working-memory.ts`

**Goal**: A realistic multi-turn chatbot loop demonstrating `memoryPrompt` as the primary
method — it retrieves working memory conversation history, context summary from
auto-summarization, and relevant long-term memories in one call. Also shows the
`putWorkingMemory` accumulation pattern (it replaces, so we must fetch-append-put).

### Why `memoryPrompt` Is the Star Method

`memoryPrompt` does three things in a single call:

1. Reads the **working memory** for the session (messages + `context` summary field)
2. Optionally runs a **long-term memory search** for relevant facts
3. Returns a **ready-to-send `messages[]` array** hydrated with all that context

This is the method you call before every LLM invocation in a chatbot.

### The Chatbot Loop

```
┌─────────────────────────────────────────────────────────────────────┐
│  For each user turn:                                                │
│                                                                     │
│  1. memoryPrompt(query, sessionId, longTermSearch?)                 │
│     └─► returns { messages } with conversation history +            │
│         context summary + relevant long-term memories               │
│                                                                     │
│  2. Send messages to LLM → get assistant response                   │
│                                                                     │
│  3. getWorkingMemory(sessionId) → get current messages list         │
│     (because putWorkingMemory REPLACES, not appends)                │
│                                                                     │
│  4. putWorkingMemory(sessionId, {                                   │
│       messages: [...existingMessages, newUserMsg, newAssistantMsg], │
│       data: { ... },                                                │
│       memories: [ ... facts to promote ... ]                        │
│     })                                                              │
│     └─► server stores conversation, triggers auto-summarization     │
│         if token threshold exceeded, promotes memories to LT store  │
└─────────────────────────────────────────────────────────────────────┘
```

### Flow

1. `AgentMemory.create({ baseUrl, defaultNamespace })` — init singleton
2. `agentMemory.getOrCreateWorkingMemory(sessionId, { userId })` — start session
3. **Turn 1**: User says "Hi, I'm Alice, a software engineer who loves hiking"
   a. `agentMemory.memoryPrompt({ query: userMsg, session: { sessionId, userId, modelName } })`
   — first turn, returns minimal context (new session)
   b. Send hydrated `messages` + user message to `ChatOpenAI` → get response
   c. `agentMemory.putWorkingMemory(sessionId, { messages: [user, assistant], data: { topic: "intro" }, memories: [{ text: "Alice is a software engineer who loves hiking" }] })`
4. **Turn 2**: User says "I'm planning a trip to the Swiss Alps"
   a. `agentMemory.memoryPrompt(...)` — now returns Turn 1 messages from working memory
   b. LLM responds with context from previous turn
   c. `agentMemory.getWorkingMemory(sessionId)` — fetch existing 2 messages
   d. `agentMemory.putWorkingMemory(sessionId, { messages: [...existing, newUser, newAssistant], memories: [...] })`
5. **Turn 3-5**: More turns to build up conversation length
   a. Same loop: `memoryPrompt` → LLM → `getWorkingMemory` → `putWorkingMemory`
   b. At some point auto-summarization kicks in (older messages compressed into `context`)
6. `agentMemory.getWorkingMemory(sessionId, { modelName })` — inspect final state:
   - `context` — the summary of older messages
   - `contextPercentageTotalUsed` / `contextPercentageUntilSummarization`
   - remaining `messages` (recent ones kept intact)
   - `data` field
7. `agentMemory.listSessions()` — verify session exists
8. `agentMemory.deleteWorkingMemory(sessionId)` — clean up

### Key Patterns Demonstrated

- **`memoryPrompt` before every LLM call** — the core integration point
- **Fetch-append-put** for message accumulation (since `putWorkingMemory` replaces)
- **`memories[]` for promotion** — structured facts attached to working memory get auto-promoted to long-term storage
- **`data` for scratch pad** — session-only state that doesn't persist beyond session
- **Auto-summarization** — observe `context` field populating as conversation grows
- **`modelName` parameter** — required for summarization monitoring fields

### Methods Exercised

- `getOrCreateWorkingMemory`
- `memoryPrompt` (the main method — called every turn)
- `getWorkingMemory` (for fetch-before-put pattern)
- `putWorkingMemory` (with messages, data, memories)
- `listSessions`
- `deleteWorkingMemory`

### LangChain Usage

- `ChatOpenAI` with `gpt-4o-mini` for generating assistant responses
- `HumanMessage` / `AIMessage` / `SystemMessage` from `@langchain/core/messages`
- Map `memoryPrompt` response messages to LangChain message types

### Interaction Mode

Standalone TypeScript script (`npx tsx 01-chatbot-working-memory.ts`) with hardcoded user
messages that simulate a multi-turn chat. No frontend, no Postman — just a runnable demo that
prints each step to the console. A real app would wire the same `AgentMemory` calls into a
REST endpoint, CopilotKit handler, WebSocket chat, etc.

---

## Example 2: Long-Term Memory CRUD Flow

**File**: `examples/02-long-term-memory-crud.ts`

**Goal**: Full CRUD + semantic search on long-term memories. Pure data operations —
no chatbot loop (that's Example 1). Shows how to store, find, update, and clean up
the persistent knowledge base.

### Flow

1. `agentMemory.createLongTermMemories([...])` — store several memories:
   - Semantic: "Alice is a software engineer at TechCorp"
   - Semantic: "Alice prefers Python over JavaScript"
   - Episodic: "Alice visited Paris in March 2024" (with `eventDate`)
2. `agentMemory.searchLongTermMemory({ text: "programming languages", userId, limit })` — semantic search
3. `agentMemory.searchLongTermMemory({ text: "travel", topics: { any: ["travel"] } })` — search with topic filter
4. `agentMemory.getLongTermMemory(memoryId)` — fetch a specific memory by ID from search results
5. `agentMemory.editLongTermMemory(memoryId, { text: "Alice is a SENIOR software engineer at TechCorp", topics: [..., "senior"] })` — user got promoted
6. `agentMemory.searchLongTermMemory(...)` — verify the edit shows updated text
7. `agentMemory.deleteLongTermMemories([...ids])` — clean up

### Methods Exercised

- `createLongTermMemories`
- `searchLongTermMemory` (text search, filtered search)
- `getLongTermMemory`
- `editLongTermMemory`
- `deleteLongTermMemories`

### LangChain Usage

- Minimal — this example focuses on data operations, no LLM calls needed

---

## Example 3: LangGraph Agent with Memory Tools

**File**: `examples/03-langgraph-memory-agent.ts`

**Goal**: Build a LangGraph agent where the LLM decides when to store/search memories via
tool calling. Demonstrates the "LLM-Driven" integration pattern (production-style).

### Production Pattern: Tools + Working Memory (No Background Extraction)

This follows the official Travel Agent pattern from the Redis docs:

- **`memoryPrompt`** before each LLM call — hydrates context from working memory history
  + relevant long-term memories
- **LLM with bound tools** — `store_memory`, `search_memory`, etc. for explicit memory CRUD
- **`putWorkingMemory`** after each turn — stores conversation history only,
  **without `longTermMemoryStrategy`** (no background extraction)

Clean separation of concerns:
- **Tools** handle memory CRUD (LLM decides what to remember)
- **Working memory** handles conversation state (history + auto-summarization)
- **`memoryPrompt`** ties them together (reads both into a single prompt)
- **No duplication** — background extraction is skipped because tools already handle it

```
┌──────────────────────────────────────────────────────────────────────┐
│  For each user turn:                                                 │
│                                                                      │
│  1. memoryPrompt(query, sessionId, longTermSearch)                   │
│     └─► hydrated messages (working memory + long-term context)       │
│                                                                      │
│  2. LLM + tools (store_memory / search_memory / edit_memory)         │
│     └─► LLM decides what to remember via tool calls                  │
│                                                                      │
│  3. getWorkingMemory → append turn → putWorkingMemory                │
│     └─► conversation history only, NO longTermMemoryStrategy         │
│         server auto-summarizes if token threshold exceeded            │
└──────────────────────────────────────────────────────────────────────┘
```

### Flow

1. `agentMemory.getOrCreateWorkingMemory(sessionId, { userId })` — start session
2. Define LangChain tools that wrap `AgentMemory` methods:
   - `search_memory` — calls `agentMemory.searchLongTermMemory`
   - `store_memory` — calls `agentMemory.createLongTermMemories`
   - `edit_memory` — calls `agentMemory.editLongTermMemory`
3. Build a LangGraph `StateGraph` with:
   - `llmCall` node — `memoryPrompt` for context, then `ChatOpenAI` with bound tools
   - `toolNode` — resolves tool calls against our `AgentMemory` methods
   - Conditional edge: if tool calls → `toolNode` → `llmCall`, else → END
4. Run the agent with a multi-turn conversation:
   - **Turn 1**: User: "I'm Bob, I work at Acme Corp as a data engineer"
     → `memoryPrompt` → LLM calls `store_memory` tool
     → After final response: fetch-append-put to working memory (no extraction strategy)
   - **Turn 2**: User: "What do you know about me?"
     → `memoryPrompt` (now includes Turn 1 from working memory + stored long-term fact)
     → LLM calls `search_memory` tool, responds with context
     → fetch-append-put
   - **Turn 3**: User: "Actually I moved to senior data engineer recently"
     → `memoryPrompt` → LLM calls `search_memory` then `edit_memory` to update the fact
     → fetch-append-put
5. Clean up

### Why No `longTermMemoryStrategy` Here

When the LLM handles memory via tools, adding background extraction creates duplication:
- Tool: `store_memory("Bob is a data engineer at Acme Corp")`
- Background extraction: analyzes the same conversation and extracts the same fact

The server has hash-based + semantic deduplication + compaction, so it would resolve
eventually. But the cleaner production pattern is: **tools for memory CRUD, working memory
for conversation state only**. Reserve background extraction (Example 5) for scenarios where
no tools are used and the system should learn passively.

### Methods Exercised

- `getOrCreateWorkingMemory` (session init)
- `memoryPrompt` (context hydration — each turn)
- `createLongTermMemories` (via `store_memory` tool)
- `searchLongTermMemory` (via `search_memory` tool)
- `editLongTermMemory` (via `edit_memory` tool)
- `getWorkingMemory` (fetch before append — each turn)
- `putWorkingMemory` (conversation persistence — each turn, no extraction strategy)

### LangChain / LangGraph Usage

- `ChatOpenAI` with `bindTools` for tool-augmented LLM
- `@langchain/core/tools` `tool()` function to define typed tools with Zod schemas
- `StateGraph` with `MessagesValue` state, conditional edges
- `HumanMessage`, `AIMessage`, `ToolMessage` message types

---

## Example 4: Summary Views Flow

**File**: `examples/04-summary-views-flow.ts`

**Goal**: Create summary views, run partition summaries, poll background tasks.

### Flow

1. Seed some long-term memories for two users across different topics
2. `agentMemory.createSummaryView({ name, source, groupBy, timeWindowDays })` — create a
   view grouped by `user_id`
3. `agentMemory.listSummaryViews()` — verify the view exists
4. `agentMemory.runSummaryViewPartition(viewId, { user_id: "alice" })` — sync compute
   a summary for Alice's partition
5. Log the `summary` and `memoryCount` from the partition result
6. `agentMemory.runSummaryView(viewId, { force: true })` — trigger async full recompute
7. Poll with `agentMemory.getTask(taskId)` until status is `completed` or `failed`
8. `agentMemory.listSummaryViewPartitions(viewId)` — read all materialized summaries
9. `agentMemory.deleteSummaryView(viewId)` — clean up
10. Delete the seeded memories

### Methods Exercised

- `createLongTermMemories` (seeding)
- `createSummaryView`
- `listSummaryViews`
- `runSummaryViewPartition`
- `runSummaryView`
- `getTask`
- `listSummaryViewPartitions`
- `deleteSummaryView`
- `deleteLongTermMemories` (cleanup)

### LangChain Usage

- Minimal — this example focuses on the summary view API; no LLM calls from our code
  (the server uses its own LLM for summarization)

---

## Example 5: Background Extraction + Forget Flow

**File**: `examples/05-background-extraction-and-forget.ts`

**Goal**: Show how conversations automatically create long-term memories via background
extraction, and how to apply forget policies.

### Flow

1. `agentMemory.putWorkingMemory(sessionId, { messages, longTermMemoryStrategy })` — store
   a conversation with `strategy: "discrete"` to trigger background extraction
2. Wait a few seconds for background extraction to run
3. `agentMemory.searchLongTermMemory({ userId })` — verify extracted memories appeared
4. Log the auto-extracted facts, their topics, and entities
5. `agentMemory.forgetLongTermMemories(policy, { dryRun: true })` — preview what a forget
   policy would delete
6. `agentMemory.forgetLongTermMemories(policy, { dryRun: false })` — execute the forget
7. Verify memories are gone
8. Clean up working memory session

### Methods Exercised

- `putWorkingMemory` (with `longTermMemoryStrategy`)
- `searchLongTermMemory`
- `forgetLongTermMemories` (dry run + actual)
- `deleteWorkingMemory`

### LangChain Usage

- `ChatOpenAI` for generating realistic assistant responses to store in working memory

---

## Shared Patterns Across Examples

### Initialization

```typescript
import { AgentMemory } from "cau-redis-agent-memory";

const agentMemory = AgentMemory.create({
  baseUrl: process.env.AGENT_MEMORY_BASE_URL ?? "http://localhost:8000",
  defaultNamespace: "examples",
});
```

### Cleanup

Every example cleans up its own sessions and memories in a `finally` block so examples
are idempotent and don't leak state.

### LangChain Model Setup

```typescript
import { ChatOpenAI } from "@langchain/openai";

const llm = new ChatOpenAI({ modelName: "gpt-4o-mini", temperature: 0 });
```

### Dependencies

| Package                  | Purpose                               |
| ------------------------ | ------------------------------------- |
| `cau-redis-agent-memory` | Our wrapper (the package being built) |
| `@langchain/openai`      | OpenAI chat model                     |
| `@langchain/core`        | Messages, tools, base types           |
| `@langchain/langgraph`   | StateGraph agent (Example 3 only)     |
| `zod`                    | Tool parameter schemas (Example 3)    |
| `dotenv`                 | Env loading                           |

---

## Coverage Matrix

| AgentMemory Method          | Ex.1  | Ex.2 | Ex.3  | Ex.4 | Ex.5 |
| --------------------------- | ----- | ---- | ----- | ---- | ---- |
| `healthCheck`               |       |      |       |      |      |
| `listSessions`              | x     |      |       |      |      |
| `getWorkingMemory`          | x     |      | x     |      |      |
| `putWorkingMemory`          | x     |      | x     |      | x    |
| `getOrCreateWorkingMemory`  | x     |      | x     |      |      |
| `deleteWorkingMemory`       | x     |      |       |      | x    |
| **`memoryPrompt`**          | **x** |      | **x** |      |      |
| `createLongTermMemories`    |       | x    | x     | x    |      |
| `searchLongTermMemory`      |       | x    | x     |      | x    |
| `getLongTermMemory`         |       | x    |       |      |      |
| `editLongTermMemory`        |       | x    | x     |      |      |
| `deleteLongTermMemories`    |       | x    |       | x    |      |
| `forgetLongTermMemories`    |       |      |       |      | x    |
| `createSummaryView`         |       |      |       | x    |      |
| `listSummaryViews`          |       |      |       | x    |      |
| `getSummaryView`            |       |      |       |      |      |
| `deleteSummaryView`         |       |      |       | x    |      |
| `runSummaryViewPartition`   |       |      |       | x    |      |
| `listSummaryViewPartitions` |       |      |       | x    |      |
| `runSummaryView`            |       |      |       | x    |      |
| `getTask`                   |       |      |       | x    |      |

`memoryPrompt` is the **primary method** in Examples 1 and 3 — called before every LLM
invocation to hydrate context from working memory + long-term search.

Example 3 uses `putWorkingMemory` **without `longTermMemoryStrategy`** — tools handle
memory CRUD, working memory handles conversation state only. Example 5 is the one that
uses `longTermMemoryStrategy` for background extraction (no tools, passive learning).

Every public method is covered by at least one example except `healthCheck` and
`getSummaryView` (trivial getters — can be added to any example if needed).
