# Redis agent memory explorer

A meeting-memory app that demonstrates [Redis Agent Memory](https://redis.io/products/agent-memory/) capabilities -- working memory, long-term memory, suggestions, and a conversational chatbot -- powered by the Redis Agent Memory (RAM) cloud service.

## Architecture

```
redis-agent-memory-explorer/
├── backend/         Express API server + LangGraph chatbot agent
├── frontend/        Next.js + MUI + CopilotKit UI
├── data/            Sample transcript datasets (e.g. wealth-advisor)
├── docs/            Design and planning documents
└── packages/        Reusable utility libraries
    ├── agent-memory-ts-sdk  Redis Agent Memory cloud SDK
    ├── cau-api-server       Zero-boilerplate Express server
    ├── cau-logger           Pino-based structured logger
    ├── cau-ram              Cloud RAM wrapper (session + LTM + intelligence)
    └── cau-redis            Typed Redis client wrapper
```

Everything runs against a single cloud Redis instance -- the Agent Memory REST API (`RAM_ENDPOINT`) handles session and long-term memory, while the same database (`REDIS_URL`) stores auxiliary data (topic tracking, transcript chunks, CopilotKit state) under separate key prefixes.

## Prerequisites

- **Node.js** >= 18
- **OpenAI API key** for the chatbot, suggestion agents, and memory summarization
- **Redis Agent Memory cloud credentials**:
  - `RAM_ENDPOINT` -- REST API endpoint
  - `RAM_API_KEY` -- API key
  - `RAM_STORE_ID` -- store identifier
  - `REDIS_URL` -- Redis protocol URL for the same cloud instance

## Quick start (Docker)

The fastest way to get the backend + frontend and LangGraph running in a single command.

### 1. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in the required values:

```env
OPENAI_API_KEY=sk-your-actual-key-here

RAM_ENDPOINT=https://your-ram-endpoint.redis.io
RAM_API_KEY=your-ram-api-key
RAM_STORE_ID=your-store-id
REDIS_URL=redis://your-cloud-redis-url:6379
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

| Variable                        | Description                                          | Default                 |
| ------------------------------- | ---------------------------------------------------- | ----------------------- |
| `RAM_ENDPOINT`                  | Redis Agent Memory cloud REST endpoint               | --                      |
| `RAM_API_KEY`                   | Redis Agent Memory cloud API key                     | --                      |
| `RAM_STORE_ID`                  | Redis Agent Memory cloud store ID                    | --                      |
| `REDIS_URL`                     | Redis protocol URL (same cloud instance)             | --                      |
| `OPENAI_API_KEY`                | OpenAI API key                                       | --                      |
| `LLM_MODEL`                     | OpenAI model for all LLM tasks (chatbot, suggestions, summarization) | `gpt-4o-mini` |
| `MEETING_MEMORY_PORT`           | Backend API port                                     | `3001`                  |
| `MEETING_MEMORY_DATA_DIR`       | Path to transcript data (relative to `backend/src/`) | `../../data`            |
| `MEETING_MEMORY_ACTIVE_DATASET` | Active dataset folder name                           | `wealth-advisor`        |
| `LANGGRAPH_DEPLOYMENT_URL`      | LangGraph local dev server URL                       | `http://localhost:2024` |
| `LANGSMITH_API_KEY`             | LangSmith API key (optional)                         | --                      |

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
