# Redis Agent Memory Explorer

A meeting-memory application that demonstrates [Redis Agent Memory](https://github.com/redis/agent-memory-server) capabilities — working memory,long-term memory, summary views, live suggestions and a conversational chatbot.

## Architecture

```
redis-agent-memory-explorer/
├── backend/         Express API server + LangGraph chatbot agent
├── frontend/        Next.js + MUI + CopilotKit UI
├── data/            Sample transcript datasets (e.g. wealth-advisor)
├── docs/            Design & planning documents
└── packages/        Reusable utility libraries
    ├── cau-api-server          Zero-boilerplate Express server
    ├── cau-logger              Pino-based structured logger
    ├── cau-mongodb             Typed MongoDB CRUD with Zod
    ├── cau-redis               Typed Redis client wrapper
    └── cau-redis-agent-memory  Redis Agent Memory client
```

## Prerequisites

- **Node.js** >= 18
- **Redis** running locally (default `redis://localhost:6379`)
- **Redis Agent Memory Server** running locally (default `http://localhost:8000`)
- **OpenAI API key** for the chatbot and suggestion agents

## Quick Start

### 1. Install dependencies and build packages

```bash
npm run setup
```

This runs `npm install` (resolves all workspaces) and then builds the shared `packages/` libraries that the backend depends on.

### 2. Configure environment

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` and fill in your API keys:

| Variable                        | Description                    | Default                 |
| ------------------------------- | ------------------------------ | ----------------------- |
| `MEETING_MEMORY_PORT`           | Backend API port               | `3001`                  |
| `AGENT_MEMORY_BASE_URL`         | Redis Agent Memory Server URL  | `http://localhost:8000` |
| `MEETING_MEMORY_DATA_DIR`       | Path to transcript data        | `../data`               |
| `MEETING_MEMORY_ACTIVE_DATASET` | Active dataset folder name     | `wealth-advisor`        |
| `OPENAI_API_KEY`                | OpenAI API key                 | —                       |
| `LANGGRAPH_DEPLOYMENT_URL`      | LangGraph local dev server URL | `http://localhost:2024` |
| `LANGSMITH_API_KEY`             | LangSmith API key (optional)   | —                       |

### 3. Start everything

```bash
npm run dev
```

This single command builds the shared packages, then starts all three services concurrently with color-coded, labeled output:

| Label        | Service                  | Port   |
| ------------ | ------------------------ | ------ |
| `langgraph`  | LangGraph CLI dev server | `2024` |
| `api`        | Express backend (hot-reload) | `3001` |
| `frontend`   | Next.js dev server       | `3000` |

Open [http://localhost:3000](http://localhost:3000) once all services are up.

You can also start services individually in separate terminals if you prefer:

```bash
npm run dev:langgraph   # LangGraph agent graph
npm run dev:api         # Express API server
npm run dev:frontend    # Next.js frontend
```

## Scripts Reference

All scripts are run from the repo root.

| Script          | Description                                           |
| --------------- | ----------------------------------------------------- |
| `npm run setup` | Install all deps + build shared packages (run once)   |
| `npm run dev`   | Build packages + start all 3 services in one terminal |

### Individual Services

| Script                   | Description                                       |
| ------------------------ | ------------------------------------------------- |
| `npm run dev:frontend`   | Start Next.js dev server (port 3000)              |
| `npm run dev:api`        | Start Express backend with hot-reload (port 3001) |
| `npm run dev:langgraph`  | Start LangGraph CLI dev server (port 2024)        |

### Build & Maintenance

| Script                   | Description                                 |
| ------------------------ | ------------------------------------------- |
| `npm run build:packages` | Build only the shared `packages/` libraries |
| `npm run build`          | Build all workspaces                        |
| `npm run test`           | Run tests across all workspaces             |
| `npm run clean`          | Clean build artifacts across all workspaces |
