# Architecture Overview

## Purpose

Redis Agent Memory Explorer is a demo app that showcases Redis Agent Memory (cloud) for meeting transcript analysis. A wealth-advisor persona (Sarah Chen) plays back recorded meeting transcripts, which are stored as session events in cloud RAM. The cloud automatically extracts long-term memories (LTMs). Users explore memories through a visual panel and an AI chatbot.

## Monorepo Layout

```
redis-agent-memory-explorer/
  packages/                     # Shared libraries (npm workspaces)
    cau-ram/                    # Cloud RAM facade (core integration package)
    agent-memory-ts-sdk/        # Vendored @redis-ai/agent-memory TS SDK (TEMPORARY -- use npm once published)
    cau-api-server/             # HTTP server framework
    cau-logger/                 # Structured logging
    cau-redis/                  # Redis DB connection (for local copilot stores)
    cau-redis-agent-memory/     # Legacy OSS AMS client (NOT used by the demo)
    cau-mongodb/                # MongoDB utility (NOT used by the demo)
  backend/                      # Node.js API server + LangGraph agent
    src/
      index.ts                  # Entry point: init RAM, Redis, ApiServer
      routes.ts                 # POST-only REST route definitions
      config.ts                 # ENV var loading
      types.ts                  # Shared backend types
      app-state.ts              # Runtime state (datasetConfig, userId)
      constants.ts              # All backend constants
      handlers/                 # Route handlers (dataset, transcript, memory, lifecycle, suggestions)
      services/                 # Business services (dataset-loader, redis-json-store, transcript, stores)
      chatbot-agent/            # LangGraph ReAct agent for CopilotKit chatbot
      suggestion-agent/         # Real-time suggestion generation during playback
    langgraph.json              # LangGraph graph registration
  frontend/                     # Next.js 14 App Router (static export)
    src/
      app/page.tsx              # Main page: two-panel layout + CopilotKit sidebar
      components/business/      # Domain components (transcript-panel, memory-explorer-panel)
      components/core/          # Reusable UI primitives
      services/api.service.ts   # Backend API client
      hooks/                    # Data-fetching hooks
      constants/                # Frontend constants
      types/                    # Frontend type definitions
      styles/                   # Global + theme CSS
  data/                         # Dataset configs + transcript JSON files
    wealth-advisor/
      dataset.config.json       # Branding, roles, participants, labels, suggestion config
      transcripts/              # Meeting transcript JSON files
  docker-compose.yml            # Two services: demo-app + demo-langgraph
  Dockerfile                    # Multi-stage: deps -> packages -> frontend-build -> app
```

## Key Packages

| Package               | Role                                                                                                                                                                                                                                                                           | Used By                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| `cau-ram`             | Facade over `@redis-ai/agent-memory` cloud SDK. Provides session memory, LTM CRUD/search, `buildMemoryPrompt`, `forgetMemories`. Singleton pattern.                                                                                                                            | Backend handlers, chatbot tools, suggestion agent               |
| `agent-memory-ts-sdk` | **Temporary** vendored Speakeasy-generated TypeScript SDK for the Redis Agent Memory cloud API. Will be replaced by the published `@redis-ai/agent-memory` npm package once available. At that point, remove this folder and update `cau-ram`'s dependency to the npm version. | `cau-ram` (internal dependency)                                 |
| `cau-api-server`      | Express-based HTTP server with POST-only routes, rate limiting, static file serving, structured logging.                                                                                                                                                                       | Backend entry point                                             |
| `cau-logger`          | Structured logger with console + file transports, daily rotation.                                                                                                                                                                                                              | All backend code                                                |
| `cau-redis`           | Redis client wrapper for JSON operations (GET/SET/ARRAPPEND/SCAN).                                                                                                                                                                                                             | Backend copilot stores (suggestions, topics, transcript chunks) |

## Data Flow

```
Frontend (Next.js)              Backend (Node.js)                Cloud Services
──────────────────              ─────────────────                ──────────────

                                                                 Redis Agent Memory
page.tsx                        index.ts                           (cloud RAM)
 ├─ TranscriptPanel              ├─ initializeApp()               ├─ Session events
 │   ├─ Select transcript        │   ├─ RedisAgentMemory.create   ├─ Auto LTM extraction
 │   ├─ Play ─────────────────►  │   ├─ RedisDb (local)           │   (~5-7 min async)
 │   │   appendChunk             │   └─ setAppState               └─ LTM search (vector)
 │   └─ Reset ────────────────►  │
 │       resetLifecycle          ├─ routes.ts ──► handlers/
 │                               │   ├─ getWorkingMemory
 ├─ MemoryExplorerPanel          │   ├─ searchLongTermMemory       Local Redis
 │   ├─ Session Memory tab       │   ├─ appendWorkingMemory          (copilot stores)
 │   ├─ Long-Term Memory tab     │   ├─ generateSuggestion          ├─ suggestions (JSON)
 │   ├─ Redis Metrics tab        │   └─ resetLifecycle              ├─ topics (JSON)
 │   └─ Suggestions tab          │                                  └─ chunks (JSON)
 │                               │
 └─ CopilotSidebar (chatbot)    ├─ chatbot-agent/
     └─ /copilotkit ──────────►  │   └─ LangGraph ReAct agent     LangGraph Server
                                 │       ├─ tools (RAM queries)      (separate process)
                                 │       └─ system prompt             port 2024
                                 │
                                 └─ suggestion-agent/              OpenAI API
                                     ├─ query extraction             (LLM calls)
                                     └─ suggestion generation
```

## Two-Process Architecture

The backend runs as **two separate processes**:

1. **API Server** (`npx tsx src/index.ts`, port 3001): Handles REST routes + proxies `/copilotkit` to the LangGraph server.
2. **LangGraph Server** (`npx @langchain/langgraph-cli dev`, port 2024): Hosts the chatbot ReAct agent graph. Initializes its own `RedisAgentMemory` instance since it runs in a separate process.

In Docker, these are two containers (`demo-app` and `demo-langgraph`) communicating over the Docker network.

## Environment Variables

| Variable                            | Required | Description                                                        |
| ----------------------------------- | -------- | ------------------------------------------------------------------ |
| `OPENAI_API_KEY`                    | Yes      | OpenAI API key for LLM calls (chatbot, suggestions, summarization) |
| `RAM_ENDPOINT`                      | Yes      | Redis Agent Memory cloud endpoint URL                              |
| `RAM_API_KEY`                       | Yes      | Cloud RAM API key                                                  |
| `RAM_STORE_ID`                      | Yes      | Cloud RAM store ID (tenant identifier)                             |
| `REDIS_URL`                         | Yes      | Redis connection URL for local copilot stores                      |
| `MEETING_MEMORY_CHATBOT_MODEL`      | No       | Chatbot agent + LangCache query normalizer model (default: `gpt-4o-mini`) |
| `MEETING_MEMORY_BACKGROUND_MODEL`   | No       | Suggestions, query extraction, and summarization model (default: `gpt-4o-mini`) |
| `MEETING_MEMORY_PORT`               | No       | Server port (default: `3001`)                                      |
| `MEETING_MEMORY_ACTIVE_DATASET`     | No       | Active dataset ID (default: `wealth-advisor`)                      |
| `MEETING_MEMORY_CONTEXT_WINDOW_MAX` | No       | Max context window tokens (default: `1500`)                        |
| `LANGGRAPH_DEPLOYMENT_URL`          | No       | LangGraph server URL (default: `http://localhost:2024`)            |
| `LANGSMITH_API_KEY`                 | No       | LangSmith tracing key                                              |

## Cloud RAM Behavior (Key Findings)

- **Async LTM extraction**: Cloud RAM automatically extracts long-term memories from session events in the background (~5-7 minute delay). All auto-extracted LTMs are `episodic` type.
- **Deduplication**: Duplicate session data insertions don't create duplicate LTMs.
- **Contradiction resolution**: When contradicting information is added, cloud updates existing LTMs.
- **No namespace on auto-extracted LTMs**: Cloud extraction doesn't set the `namespace` field. The demo uses `ownerId` (userId) for scoping instead.
- **FLUSHALL is destructive**: Destroys the search index with long recovery times. Never use it on cloud.

## Dataset-Driven Configuration

All UI labels, branding, roles, suggestion types, and playback settings are driven by `data/<dataset>/dataset.config.json`. The backend serves this config to the frontend at startup. This allows different demo personas without code changes.

## Docker Deployment

The `Dockerfile` is a multi-stage build:

1. **deps**: Install all npm dependencies
2. **packages**: Build shared workspace packages
3. **frontend-build**: Static export of Next.js frontend
4. **app**: Production image with backend + static frontend in `backend/public/`

`docker-compose.yml` runs two services from the same image:

- `demo-app`: The API server (port 3001)
- `demo-langgraph`: The LangGraph dev server (port 2024, pinned CLI version `@1.1.17`)
