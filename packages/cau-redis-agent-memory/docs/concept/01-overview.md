# Redis Agent Memory Server — Overview

## What It Is

Redis Agent Memory Server is a production-ready memory system for AI agents. It runs as a
standalone server (Docker) that provides persistent, searchable memory through **REST API**
(`http://localhost:8000`) and **MCP SSE** (`http://localhost:9050/sse`) interfaces.

It gives AI agents two tiers of memory — **Working Memory** (session-scoped, ephemeral) and
**Long-Term Memory** (cross-session, persistent) — backed by Redis with vector indexing for
semantic search.

## Core Value Proposition

| Problem                        | Solution                                                     |
| ------------------------------ | ------------------------------------------------------------ |
| Agents forget between sessions | Long-term memory persists facts, preferences, events forever |
| Context windows overflow       | Working memory auto-summarizes old messages                  |
| Finding relevant context       | Semantic vector search surfaces the right memories           |
| Duplicate information          | Hash-based + semantic deduplication                          |
| Memory bloat                   | Automatic forgetting policies + compaction                   |
| Multi-tenant isolation         | Namespace + user_id scoping on all operations                |

## Architecture at a Glance

```
┌──────────────────────────────────────────────────┐
│  Your AI Application (Node.js / Python / etc.)   │
│                                                   │
│  ┌────────────────┐   ┌────────────────────────┐ │
│  │  LLM (OpenAI,  │   │  Application Logic     │ │
│  │  Anthropic...) │   │  (code-driven memory)  │ │
│  └──────┬─────────┘   └──────────┬─────────────┘ │
│         │ tool calls             │ SDK / REST     │
└─────────┼────────────────────────┼────────────────┘
          │                        │
          ▼                        ▼
┌──────────────────────────────────────────────────┐
│         Redis Agent Memory Server                 │
│                                                   │
│  REST API  :8000    │    MCP SSE  :9050/sse      │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │  Working Memory   │  Long-Term Memory        │ │
│  │  (Redis JSON)     │  (Redis + Vector Index)  │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  Background Workers: extraction, summarization,   │
│  compaction, forgetting                           │
└──────────────────────────────────────────────────┘
```

## Two-Tier Memory System

### Working Memory (Session-Scoped)

- Holds the **current conversation** for a single session
- Contains: `messages`, `context` (summary), `memories` (structured records), `data` (arbitrary JSON)
- Stored in Redis JSON with optional TTL
- **Auto-summarizes** older messages when the token count approaches the context window limit
- Memories placed in the `memories` field are **automatically promoted** to long-term storage

### Long-Term Memory (Persistent)

- Cross-session knowledge base of facts, preferences, and experiences
- **Three memory types**: semantic (facts/preferences), episodic (events with dates), message (conversation records)
- Stored in Redis with **vector embeddings** for semantic search
- Rich metadata: topics, entities, timestamps, access counts
- Automatic **deduplication** (hash-based + semantic) and **compaction**

## Interfaces

| Interface      | URL / Protocol                              | Best For                                |
| -------------- | ------------------------------------------- | --------------------------------------- |
| REST API       | `http://localhost:8000/v1/...`              | Application backends, custom wrappers   |
| MCP Server     | `http://localhost:9050/sse`                 | Claude Desktop, MCP-compatible agents   |
| Swagger Docs   | `http://localhost:8000/docs`                | Interactive exploration                 |
| TypeScript SDK | `npm install agent-memory-client`           | Node.js / browser apps                  |
| Python SDK     | `pip install agent-memory-client`           | Python apps                             |

## Key Concepts Glossary

| Term                    | Meaning                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| **Session**             | A conversation identified by `session_id`; scopes working memory                        |
| **Namespace**           | Logical grouping for multi-tenancy (`my-app`, `production`, etc.)                       |
| **Memory Type**         | `semantic` (fact), `episodic` (event + date), `message` (chat record)                   |
| **Memory Promotion**    | Moving memories from working memory's `memories[]` to long-term indexed storage          |
| **Background Extraction** | Server-side LLM analyzes conversations and auto-creates long-term memories            |
| **Summarization**       | When messages exceed a threshold, older ones are summarized into `context`               |
| **Compaction**          | Background merge/dedup of semantically similar memories                                  |
| **Forgetting**          | Age-based or inactivity-based automatic deletion of old memories                         |
| **Memory Prompt**       | API that hydrates a user query with working memory context + relevant long-term memories |
| **Summary View**        | Aggregated summary over a partition of memories (grouped by user, topics, etc.)          |
| **Recency Boost**       | Time-aware re-ranking to surface recently accessed/created memories                      |
