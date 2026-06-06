# Redis agent memory explorer

A meeting-memory app that demonstrates [Redis Agent Memory](https://redis.io/products/agent-memory/) capabilities -- working memory, long-term memory, suggestions, and a conversational chatbot -- powered by the Redis Agent Memory (RAM) cloud service and Redis Context Surfaces for structured data retrieval.

## Documentation

Detailed developer documentation lives in [`docs/dev-plans/`](docs/dev-plans/):

| Document                                          | Covers                                                              |
| ------------------------------------------------- | ------------------------------------------------------------------- |
| [architecture.md](docs/dev-plans/architecture.md) | Monorepo layout, data flows, packages, env vars, cloud RAM behavior |
| [backend.md](docs/dev-plans/backend.md)           | Routes, handlers, services, config, API contract                    |
| [frontend.md](docs/dev-plans/frontend.md)         | Components, state management, hooks, styling, dataset-driven UI     |
| [cau-ram.md](docs/dev-plans/cau-ram.md)           | Cloud RAM wrapper API, operations, types, token budgeting           |
| [chatbot.md](docs/dev-plans/chatbot.md)           | LangGraph agent, tools, system prompt, CopilotKit integration       |
| [context-surfaces-integration.md](docs/dev-plans/context-surfaces-integration.md) | Context Surfaces setup, MCP tools, data flow, source attribution |
| [suggestions.md](docs/dev-plans/suggestions.md)   | Real-time AI copilot pipeline, topic detection, stores              |

## Prerequisites

- **Node.js** >= 18
- **OpenAI API key** for the chatbot, suggestion agents, and memory summarization
- **Redis Agent Memory cloud credentials**:
  - `RAM_ENDPOINT` -- REST API endpoint
  - `RAM_API_KEY` -- API key
  - `RAM_STORE_ID` -- store identifier
  - `REDIS_URL` -- Redis protocol URL for the same cloud instance
- **Context Surfaces credentials** (optional, enables structured data queries):
  - `CTX_ADMIN_KEY` -- Admin API key from Redis Cloud
  - `CTX_SURFACE_ID` -- Reuse an existing surface (auto-created on first run if blank)
  - `MCP_AGENT_KEY` -- Reuse an existing agent key (auto-created on first run if blank)

## Quick start (Docker)

The fastest way to get the backend + frontend and LangGraph running in a single command.

### 1. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in the required values:

```env
OPENAI_API_KEY=sk-your-actual-key-here

REDIS_URL=redis://your-cloud-redis-url:6379

RAM_ENDPOINT=https://your-ram-endpoint.redis.io
RAM_API_KEY=your-ram-api-key
RAM_STORE_ID=your-store-id

# Context Surfaces (optional -- enables structured data queries in chatbot)
CTX_ADMIN_KEY=ak_your-admin-key
```

### 2. Start all services

```bash
docker compose up --build
```

This spins up two containers:

| Service          | Description                           | Port   |
| ---------------- | ------------------------------------- | ------ |
| `demo-app`       | Backend API + frontend (static build) | `3001` |
| `demo-langgraph` | LangGraph chatbot agent dev server    | `2024` |

Open [http://localhost:3001](http://localhost:3001) once all services are healthy.

### Stop and clean up

```bash
docker compose down
```

---

## Local development

If you prefer running services directly on your machine (e.g. for hot-reload).

### 1. Install dependencies and build packages

```bash
npm run setup
```

This runs `npm install` (resolves all workspaces) and then builds the shared `packages/` libraries that the backend depends on.

### 2. Configure environment

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` and fill in your credentials:

| Variable                        | Description                                                          | Default                                            |
| ------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------- |
| `OPENAI_API_KEY`                | OpenAI API key                                                       | --                                                 |
| `REDIS_URL`                     | Redis protocol URL (cloud instance)                                  | --                                                 |
| `RAM_ENDPOINT`                  | Redis Agent Memory cloud REST endpoint                               | --                                                 |
| `RAM_API_KEY`                   | Redis Agent Memory cloud API key                                     | --                                                 |
| `RAM_STORE_ID`                  | Redis Agent Memory cloud store ID                                    | --                                                 |
| `CTX_ADMIN_KEY`                 | Context Surfaces admin API key (optional)                            | --                                                 |
| `CTX_ADMIN_API_URL`             | Context Surfaces admin REST endpoint                                 | `https://cloud.redis.io/context-surfaces`          |
| `CTX_MCP_URL`                   | Context Surfaces MCP endpoint                                        | `https://gcp-us-east4.context-surfaces.redis.io/mcp` |
| `CTX_SURFACE_ID`                | Reuse existing surface (auto-created if blank)                       | --                                                 |
| `MCP_AGENT_KEY`                 | Reuse existing agent key (auto-created if blank)                     | --                                                 |
| `MEETING_MEMORY_PORT`           | Backend API port                                                     | `3001`                                             |
| `MEETING_MEMORY_ACTIVE_DATASET` | Active dataset folder name                                           | `wealth-advisor`                                   |
| `MEETING_MEMORY_CHATBOT_MODEL`  | OpenAI model for the chatbot agent + LangCache query normalizer      | `gpt-4o-mini`                                      |
| `MEETING_MEMORY_BACKGROUND_MODEL` | OpenAI model for suggestions, query extraction, and summarization  | `gpt-4o-mini`                                      |
| `LANGGRAPH_DEPLOYMENT_URL`      | LangGraph local dev server URL                                       | `http://localhost:2024`                             |
| `LANGSMITH_API_KEY`             | LangSmith API key (optional)                                         | --                                                 |

### 3. Start everything

```bash
npm run dev
```

This single command builds the shared packages, then starts all three services concurrently with color-coded, labeled output:

| Label       | Service                      | Port   |
| ----------- | ---------------------------- | ------ |
| `langgraph` | LangGraph CLI dev server     | `2024` |
| `api`       | Express backend (hot-reload) | `3001` |
| `frontend`  | Next.js dev server           | `3000` |

Open [http://localhost:3000](http://localhost:3000) once all services are up.

You can also start services individually in separate terminals if you prefer:

```bash
npm run dev:langgraph   # LangGraph agent graph
npm run dev:api         # Express API server
npm run dev:frontend    # Next.js frontend
```

## Scripts reference

All scripts are run from the repo root.

| Script          | Description                                           |
| --------------- | ----------------------------------------------------- |
| `npm run setup` | Install all deps + build shared packages (run once)   |
| `npm run dev`   | Build packages + start all 3 services in one terminal |

### Individual services

| Script                  | Description                                       |
| ----------------------- | ------------------------------------------------- |
| `npm run dev:frontend`  | Start Next.js dev server (port 3000)              |
| `npm run dev:api`       | Start Express backend with hot-reload (port 3001) |
| `npm run dev:langgraph` | Start LangGraph CLI dev server (port 2024)        |

### Build and maintenance

| Script                   | Description                                 |
| ------------------------ | ------------------------------------------- |
| `npm run build:packages` | Build only the shared `packages/` libraries |
| `npm run build`          | Build all workspaces                        |
| `npm run test`           | Run tests across all workspaces             |
| `npm run clean`          | Clean build artifacts across all workspaces |
