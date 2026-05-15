# Context Surfaces Integration Analysis

## The Central Question

This demo has **call conversations** (free-text transcript chunks) as its primary data.
Context Surfaces requires **structured data** (typed entities with indexed fields).
Can we bridge that gap, and if so, where does Context Surfaces add value vs. the existing Cloud RAM approach?

---

## What the Demo Has Today

### Data Shape

| Layer | Shape | Example |
|---|---|---|
| **Transcript chunks** | Free-text dialogue lines | `"[00:02:00] James Morrison: I'd like to retire at fifty-seven, target is three million liquid"` |
| **Session events** | Semi-structured (text + role + timestamp + metadata) | `{ sessionId, actorId, role: "user", content: "...", createdAt }` |
| **Long-term memories (LTMs)** | Semi-structured (text + metadata tags) | `{ text: "Client wants $3M liquid by 2031", memoryType: "episodic", topics: ["retirement"], ownerId: "sarah-chen", sessionId: "..." }` |
| **Topics** | Lightweight tags | `{ name: "retirement planning", status: "discussed", source: "ai-detected" }` |
| **Suggestions** | LLM-generated JSON | `{ type: "lifeEvent", title: "Retirement target mentioned", summary: "..." }` |

### Access Patterns

| Feature | How it queries data |
|---|---|
| **Session Memory tab** | `getSessionMemory(sessionId)` — full session event list |
| **LTM tab** | `searchLongTermMemory({ text, filter: { ownerId, sessionId, memoryType } })` — vector + filter search |
| **Suggestions** | `buildMemoryPrompt(query, sessionId)` — token-budgeted context from session + LTMs |
| **Chatbot** | ReAct agent with 5 tools: `searchMemories`, `searchMemoriesBySession`, `getMemoryContext`, `listSessions`, `getSessionState` |

---

## The Fundamental Mismatch

Context Surfaces shines when you have **operational structured data** — customers, orders, products, shipments — where the relationships and attributes are well-defined and the agent needs to search/filter/join across them.

Our demo's data is **conversational and semi-structured**. The raw transcripts are free-text. The extracted LTMs are closer to structured data, but they're still primarily text blobs with a handful of metadata tags. Here's the gap:

| Context Surfaces Expects | What We Have |
|---|---|
| Entity with 5-20 typed, indexed fields | LTM with text + 4-5 optional metadata fields |
| Relationships between entities (Customer → Orders) | Loose sessionId links between LTMs and sessions |
| Pre-defined data model before data is loaded | Schema-less — LTMs are created dynamically by Cloud RAM |
| Static or slowly-changing data | Continuously growing — new LTMs appear during playback |
| Data loaded via import API | Data created by Cloud RAM's async extraction |

---

## Three Possible Approaches

### Approach A: Structure the Conversations (Transform to Fit)

Transform conversation data into structured entities that Context Surfaces can index.

#### Proposed Entity Model

```
Client
├── client_id (TAG)
├── name (TEXT)
├── age (NUMERIC)
├── role_title (TEXT)
├── organization (TAG)
├── risk_profile (TAG: conservative/moderate/aggressive)
├── retirement_target_year (NUMERIC)
├── retirement_target_amount (NUMERIC)
├── total_aum (NUMERIC)
└── relationships: meetings[], goals[], holdings[]

Meeting
├── meeting_id (TAG)
├── date (TAG)
├── type (TAG: phone/google-meet)
├── duration_minutes (NUMERIC)
├── sentiment (TAG)
├── summary (TEXT)
├── key_decisions (TEXT)
├── follow_ups (TEXT)
├── embedding (VECTOR)
└── relationships: client, topics[], action_items[]

FinancialGoal
├── goal_id (TAG)
├── client_id (TAG)
├── type (TAG: retirement/education/estate/tax)
├── target_amount (NUMERIC)
├── target_date (TAG)
├── status (TAG: active/achieved/revised)
├── description (TEXT)
└── relationships: client

Holding
├── holding_id (TAG)
├── client_id (TAG)
├── asset_class (TAG: equities/fixed-income/reits/cash/alternatives)
├── allocation_percent (NUMERIC)
├── current_value (NUMERIC)
├── notes (TEXT)
└── relationships: client

ActionItem
├── action_id (TAG)
├── meeting_id (TAG)
├── assignee (TAG)
├── description (TEXT)
├── status (TAG: pending/completed/cancelled)
├── due_date (TAG)
└── relationships: meeting

Topic
├── topic_id (TAG)
├── name (TEXT)
├── category (TAG: portfolio/retirement/tax/estate/insurance)
├── first_mentioned_date (TAG)
├── mention_count (NUMERIC)
├── latest_context (TEXT)
├── embedding (VECTOR)
└── relationships: meetings[]
```

#### How Auto-Generated Tools Would Look

From the model above, Context Surfaces would auto-generate tools like:

```
search_client_by_text           → find clients by name/role
filter_meeting_by_client_id     → all meetings for a client
filter_meeting_by_type          → phone vs video meetings
filter_meeting_by_sentiment     → positive/negative meetings
search_meeting_by_text          → search meeting summaries
filter_financial_goal_by_type   → retirement goals vs tax goals
filter_holding_by_asset_class   → equities holdings
filter_action_item_by_status    → pending action items
filter_action_item_by_assignee  → what Sarah needs to do
search_topic_by_text            → find topics by keyword
get_client_by_client_id         → get full client profile
```

#### What This Gives the Agent

Instead of the chatbot doing a single vector search and hoping the right LTMs come back, it could make precise structured queries:

- "What are James's pending action items?" → `filter_action_item_by_status({status: "pending"})` → exact results
- "Show meetings about retirement" → `search_meeting_by_text({query: "retirement"})` + `filter_financial_goal_by_type({type: "retirement"})` → structured cross-referencing
- "What's his current portfolio allocation?" → `filter_holding_by_client_id({client_id: "james-morrison"})` → typed numeric data

Compare to today: the chatbot calls `searchMemories({query: "pending action items"})` and gets back text blobs that may or may not contain the answer.

#### The Cost

| Concern | Detail |
|---|---|
| **Extraction pipeline needed** | We'd need to build LLM-based extraction to parse transcripts into these entities. Not trivial — the transcripts are conversational, not structured documents. |
| **Data duplication** | Same information lives in Cloud RAM (as LTMs) and in Context Surfaces (as structured entities). Two truth sources. |
| **Timing issues** | Entities would need to be extracted and imported before the agent can use them. Can't happen in real-time during playback (import API is batch, not streaming). |
| **Maintenance burden** | Schema changes require re-creating the surface + re-importing all data. |
| **Artificial feel** | Wealth advisor meetings naturally produce narrative data. Forcing it into rigid entities loses nuance (e.g., "client seemed hesitant about bonds" becomes `risk_profile: "moderate"`). |

---

### Approach B: Surface the LTMs Directly (Light Touch)

Instead of creating new structured entities, expose the existing Cloud RAM LTMs through Context Surfaces with a thin entity model.

#### Proposed Entity Model (Minimal)

```
Memory
├── memory_id (TAG)
├── text (TEXT, weight: 2.0)
├── memory_type (TAG: episodic/semantic/message)
├── owner_id (TAG)
├── session_id (TAG)
├── topics (TAG, separator: ",")
├── created_at (NUMERIC, sortable: true)
├── updated_at (NUMERIC, sortable: true)
├── embedding (VECTOR, dim: 1536, metric: cosine)
└── no relationships (flat)

Session
├── session_id (TAG)
├── owner_id (TAG)
├── event_count (NUMERIC)
├── created_at (NUMERIC, sortable: true)
└── relationships: memories[]
```

#### Auto-Generated Tools

```
search_memory_by_text             → full-text search on LTM text
filter_memory_by_memory_type      → episodic vs semantic
filter_memory_by_session_id       → LTMs from a specific meeting
filter_memory_by_owner_id         → user-scoped memories
search_memory_by_embedding_similarity → vector search
get_memory_by_memory_id           → retrieve a single LTM
filter_session_by_owner_id        → list sessions for a user
```

#### Advantage

- Minimal transformation needed — LTMs already have the fields listed above
- Consistent with Cloud RAM as the source of truth
- Context Surfaces adds the MCP tool interface on top

#### Problems

| Problem | Detail |
|---|---|
| **Redundant with Cloud RAM** | Cloud RAM already provides `searchLongTermMemory` with vector search and filters. The auto-generated tools would be doing the same thing with extra hops (app → MCP → Context Surfaces → same Redis). |
| **Sync challenge** | LTMs are continuously created/updated by Cloud RAM's async extraction. We'd need to keep the Context Surface in sync — either via periodic re-import or by hooking into Cloud RAM's creation events. Neither is clean. |
| **Two search indexes** | Cloud RAM already maintains its own RediSearch indexes on the LTM data. Context Surfaces would create a second set of indexes on the same underlying data. Wasteful and confusing. |
| **No new capability** | The chatbot already has `searchMemories`, `searchMemoriesBySession`, `getMemoryContext`. Context Surfaces would provide roughly the same tools but with MCP protocol overhead. |

---

### Approach C: Don't Integrate Context Surfaces (Use What We Have)

Recognize that Context Surfaces solves a different problem and that our demo already has the right tool for conversation-centric data.

#### Why Cloud RAM Is Already the Right Fit

| Feature | Cloud RAM (what we have) | Context Surfaces (what we'd add) |
|---|---|---|
| **Data ingestion** | Real-time event streaming (`addSessionEvent`) | Batch import (`POST .../data`) |
| **Intelligence** | Auto-extracts LTMs from conversation, deduplicates, resolves contradictions | None — it indexes what you give it |
| **Search** | Vector + metadata filter on LTMs | Vector + text + tag + numeric on entities |
| **Schema** | Schema-less — LTMs are created dynamically | Requires pre-defined entity schema |
| **Agent tools** | Custom tools (`searchMemories`, etc.) that map to our exact access patterns | Auto-generated generic tools (`search_*`, `filter_*`) |
| **Context building** | `buildMemoryPrompt` with token budgeting and summarization | No context building — returns raw results |
| **Memory prompt** | Session + LTM combined, formatted for LLM consumption | No equivalent |

Cloud RAM is purpose-built for conversational memory. Context Surfaces is purpose-built for structured operational data. Using Context Surfaces to query conversational data would be like using a SQL database to store chat logs — possible but not playing to its strengths.

---

## Recommendation

**Short answer: Approach A (structured extraction) is the only approach where Context Surfaces adds genuine value, but it has significant cost. Approach B is redundant. Approach C is the pragmatic default.**

### Decision Matrix

| Criterion | A: Structure the Data | B: Surface LTMs | C: Don't Integrate |
|---|---|---|---|
| New capabilities for the user | High (precise structured queries, cross-entity reasoning) | Low (same queries, different protocol) | None (keep current) |
| Engineering effort | High (LLM extraction pipeline, schema design, sync, import) | Medium (sync pipeline, duplicate indexes) | None |
| Demo impressiveness | High (shows CS + RAM together) | Low (feels redundant) | N/A |
| Architectural fit | Moderate (two data systems for two purposes) | Poor (two systems for one purpose) | Good (one system for its purpose) |
| Data freshness | Delayed (batch import after extraction) | Delayed (sync lag) | Real-time (events → LTMs) |
| Risk | Medium (extraction quality, schema evolution) | Medium (sync reliability) | None |

### If We Want to Showcase Context Surfaces (Recommended: Approach A, scoped)

The strongest demo story would be: *"Cloud RAM handles conversational memory. Context Surfaces handles structured client data. The chatbot uses both."*

Rather than trying to extract structure from the conversation transcripts, we could:

1. **Pre-define structured client data** (client profile, portfolio holdings, financial goals) as static JSON — similar to how the demo already has `dataset.config.json` with participant details.
2. **Load it into a Context Surface** during setup.
3. **Give the chatbot agent both tool sets**: Cloud RAM tools for conversation/memory queries + Context Surfaces MCP tools for structured client data queries.
4. **Show the contrast**: "What did James say about bonds?" → Cloud RAM. "What's James's current equity allocation percentage?" → Context Surfaces.

This avoids the extraction pipeline entirely. The structured data is hand-authored (or generated) as part of the dataset, and it complements the conversational data rather than duplicating it.

#### Minimal Implementation

| Step | Description | Effort |
|---|---|---|
| 1. Author client data | JSON files with client profile, holdings, goals, action items alongside existing transcripts in `data/wealth-advisor/` | Low |
| 2. Setup surface script | CLI or backend endpoint that creates a Context Surface + imports the client data. Runs once per dataset. | Low |
| 3. MCP client wrapper | Thin TypeScript module that calls `POST /mcp` with agent key. Methods: `listTools()`, `callTool(name, args)`. ~50 lines. | Low |
| 4. Chatbot integration | Add Context Surfaces tools to the LangGraph ReAct agent alongside existing Cloud RAM tools. Update system prompt to explain when to use which. | Medium |
| 5. Suggestions integration | When generating suggestions, optionally call Context Surfaces tools for client-profile context (e.g., "client's risk profile is moderate" enriches suggestion quality). | Medium |
| 6. Frontend (optional) | Add a "Client Profile" tab or card that displays structured data fetched via Context Surfaces tools. | Low |

#### New Config Variables

```env
CTX_ADMIN_KEY=ak_...        # From Redis Cloud console
CTX_API_URL=https://...     # Context Surfaces REST API (has default)
CTX_MCP_URL=https://...     # MCP server (has default)
CTX_SURFACE_ID=             # Auto-populated by setup
MCP_AGENT_KEY=              # Auto-populated by setup
```

#### Updated Architecture

```
Frontend (Next.js)                 Backend (Node.js)                   Cloud Services
──────────────────                 ─────────────────                   ──────────────

                                                                       Redis Agent Memory
page.tsx                           index.ts                              (Cloud RAM)
 ├─ TranscriptPanel                 ├─ initializeApp()                  ├─ Session events
 │   └─ Playback → appendChunk     │   ├─ RedisAgentMemory.create      ├─ Auto LTM extraction
 │                                  │   ├─ ContextSurfaceMCP.create ◄── ├─ LTM search
 ├─ MemoryExplorerPanel             │   └─ RedisDb (local)              │
 │   ├─ Session Memory              │                                   │  Context Surfaces
 │   ├─ Long-Term Memory            ├─ chatbot-agent/                   │  (MCP Server)
 │   ├─ Client Profile (NEW)        │   ├─ RAM tools (5)                ├─ Structured tools
 │   ├─ Suggestions                 │   └─ CS tools (N) ────────────────┤  (search, filter, get)
 │   └─ Redis Metrics               │                                   │
 │                                  └─ suggestion-agent/                │
 └─ CopilotSidebar (chatbot)           └─ CS profile enrichment ───────┘
```

#### Example Chatbot Tool Routing (Updated System Prompt)

```
When to use which tools:

CONVERSATION & MEMORY QUERIES (Cloud RAM tools):
- "What did James say about bonds?" → searchMemories
- "Summary of last meeting" → getMemoryContext
- "Any meetings about tax planning?" → searchMemories

STRUCTURED CLIENT DATA QUERIES (Context Surfaces tools):
- "What's James's current equity allocation?" → filter_holding_by_client_id
- "What's his retirement target?" → get_financial_goal_by_goal_id / filter_financial_goal_by_type
- "Pending action items" → filter_action_item_by_status
- "Client risk profile" → get_client_by_client_id

COMBINED QUERIES (use both):
- "Should we adjust the portfolio given what he said last meeting?"
  → get holdings (CS) + get last meeting context (RAM) + reason
```

---

## What NOT to Do

1. **Don't replace Cloud RAM with Context Surfaces** — they solve different problems. Cloud RAM handles the conversational memory lifecycle (ingest → extract → search → prompt). Context Surfaces handles structured data access for agents.

2. **Don't try real-time sync between Cloud RAM LTMs and Context Surfaces** — the async extraction timing makes this fragile, and it creates two truth sources for the same data.

3. **Don't build an LLM extraction pipeline to structure transcripts** — for a demo, this adds complexity without proportional value. Hand-authored structured data is more reliable and easier to maintain.

4. **Don't use Context Surfaces for the suggestion agent's primary flow** — suggestions are driven by recent transcript chunks + memory context. The suggestion LLM prompt is already well-tuned for this. However, enriching the context with structured client data (e.g., risk profile, goals) could improve suggestion quality with minimal effort.

---

## Summary

| Aspect | Verdict |
|---|---|
| Is Context Surfaces suitable for raw conversations? | No — it's designed for structured entities, not free-text dialogue. |
| Can we extract structure from conversations? | Yes, but the extraction pipeline is non-trivial and the demo doesn't need it. |
| Where does Context Surfaces add real value? | Alongside Cloud RAM — structured client profile data (holdings, goals, action items) that the agent queries with precise filters and the LLM reasons over jointly with conversational context. |
| Best integration strategy? | Pre-define structured client data, load into a Context Surface, give the chatbot both RAM tools and CS tools, and show the contrast. |
| Effort for minimum viable integration | Low-to-medium: ~50-line MCP wrapper, client data JSON files, chatbot agent tool expansion, system prompt update. |
