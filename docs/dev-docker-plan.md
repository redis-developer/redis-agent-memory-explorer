# Docker Strategy -- Meeting Memory Demo

## Goal

Provide a single `docker compose up` command that spins up the entire demo stack so anyone can run it with minimal setup. The only prerequisites are Docker, an `OPENAI_API_KEY`, and optionally a `LANGSMITH_API_KEY`.

---

## Architecture Overview

```
docker compose up
    │
    ├── redis          (Redis Stack with RediSearch)
    │     port 6379
    │
    ├── agent-memory   (agent-memory-server Python API)
    │     port 8000
    │     connects to → redis
    │
    ├── app            (Node.js backend + frontend static files)
    │     port 3001
    │     connects to → agent-memory, redis
    │     serves: backend API + frontend static build (same origin)
    │
    └── langgraph      (LangGraph CLI dev server)
          port 2024
          connects to → redis, agent-memory
          mounts: backend source (graph definition)
```

Four services, one compose file. The `app` container is the only user-facing entrypoint (port 3001). Redis, agent-memory-server, and LangGraph are internal.

---

## Service Breakdown

### 1. `redis` -- Redis

| Property | Value                                              |
| -------- | -------------------------------------------------- |
| Image    | `redis:latest`                                     |
| Port     | `6379` (internal, optional external for debugging) |
| Volumes  | Named volume for persistence                       |
| Health   | `redis-cli ping`                                   |

Redis 8.x (the current `latest`) includes Redis Query Engine (RediSearch) and RedisJSON natively -- no separate "Redis Stack" image needed. The agent-memory-server uses these for vector similarity search and the backend uses RedisJSON for copilot state.

### 2. `agent-memory` -- Agent Memory Server

**Recommended: use the pre-built Docker image.** The `redislabs/agent-memory-server` image is published to Docker Hub and GitHub Packages with every release. Environment variables are the primary configuration mechanism -- no source code modification needed.

| Property     | Value                                                   |
| ------------ | ------------------------------------------------------- |
| Image        | `redislabs/agent-memory-server:latest`                  |
| Port         | `8000` (internal)                                       |
| Depends on   | `redis`                                                 |
| Health       | `curl -f http://localhost:8000/v1/health`               |
| Task backend | `asyncio` (single-process dev mode, no separate worker) |

**Key environment variables:**

| Variable           | Source                   | Purpose                                    |
| ------------------ | ------------------------ | ------------------------------------------ |
| `REDIS_URL`        | compose `environment:`   | Points to the compose Redis service        |
| `OPENAI_API_KEY`   | `.env` via `env_file:`   | From host `.env` file                      |
| `GENERATION_MODEL` | `.env` via `env_file:`   | LLM for extraction + summarization         |
| `FAST_MODEL`       | `.env` via `env_file:`   | Fast LLM for background tasks (extraction) |
| `EMBEDDING_MODEL`  | `.env` via `env_file:`   | Embedding model for vector search          |
| `DISABLE_AUTH`     | compose `environment:`   | No OAuth for local demo                    |
| `LOG_LEVEL`        | `.env` via `env_file:`   | Logging verbosity                          |

**Command override:**

```yaml
command: agent-memory api --host 0.0.0.0 --port 8000 --task-backend=asyncio
```

The `--task-backend=asyncio` flag runs background tasks (memory extraction, summarization) inline without a separate worker process. This is simpler for the demo -- no need for a `task-worker` sidecar.

**Why Docker image over source checkout:**

- The image is the official distribution -- stable, tested, versioned.
- All behavior is configurable via environment variables (`REDIS_URL`, `OPENAI_API_KEY`, `GENERATION_MODEL`, `EMBEDDING_MODEL`, `DISABLE_AUTH`, etc.).
- No Python environment, no `uv sync`, no build step.
- To pin a version: `redislabs/agent-memory-server:v0.15.1` instead of `:latest`.
- For debugging, the compose file can mount a local checkout into the container (see [Advanced: Source Checkout](#advanced-agent-memory-server-from-source) below).

### 3. `app` -- Demo App (Backend + Frontend)

Single container that serves both the Node.js backend API and the Next.js static frontend build. This is the only port users access.

| Property   | Value                                  |
| ---------- | -------------------------------------- |
| Build      | Multi-stage Dockerfile (see below)     |
| Port       | `3001` (exposed to host)               |
| Depends on | `redis`, `agent-memory`                |
| Health     | `curl -f http://localhost:3001/health` |

**How it works:**

1. Multi-stage Docker build:
   - Stage 1 (`builder`): Install npm dependencies, build workspace packages, build frontend static export
   - Stage 2 (`runner`): Copy backend + built packages + frontend `out/` folder, run backend
2. The backend serves the frontend's static files from a `/public` directory using Express static middleware
3. Frontend is built with `NEXT_PUBLIC_API_BASE_URL=""` so all API calls use relative paths (same origin)

**Key environment variables:**

| Variable                         | Source                   | Purpose                             |
| -------------------------------- | ------------------------ | ----------------------------------- |
| `MEETING_MEMORY_PORT`            | `.env` via `env_file:`   | Backend listen port                 |
| `AGENT_MEMORY_BASE_URL`          | compose `environment:`   | Points to compose AMS service       |
| `REDIS_URL`                      | compose `environment:`   | Redis for copilot state (RedisJSON) |
| `MEETING_MEMORY_DATA_DIR`        | compose `environment:`   | Data directory inside container     |
| `MEETING_MEMORY_ACTIVE_DATASET`  | `.env` via `env_file:`   | Active dataset                      |
| `MEETING_MEMORY_ALLOWED_ORIGINS` | compose `environment:`   | CORS (permissive for demo)          |
| `OPENAI_API_KEY`                 | `.env` via `env_file:`   | For LangGraph agent / chatbot       |
| `LANGGRAPH_DEPLOYMENT_URL`       | compose `environment:`   | Points to compose LangGraph service |
| `LANGSMITH_API_KEY`              | `.env` via `env_file:`   | Optional tracing                    |

### 4. `langgraph` -- LangGraph Dev Server

The LangGraph CLI (`@langchain/langgraph-cli`) runs a development server that hosts the chatbot graph. It must run separately because it's a different process with its own HTTP server (port 2024).

| Property   | Value                                                 |
| ---------- | ----------------------------------------------------- |
| Build      | Separate Dockerfile or same image + different command |
| Port       | `2024` (internal, optional external for debugging)    |
| Depends on | `redis`, `agent-memory`                               |

**Approach: Reuse the `app` image with a different command**

Since this is a demo, simplicity wins over image size optimization. The `langgraph` service reuses the same Docker image as `app` but overrides the command:

```yaml
langgraph:
  build: . # same Dockerfile as app
  command: npx @langchain/langgraph-cli dev --port 2024 --host 0.0.0.0
  working_dir: /app/backend
```

No separate Dockerfile target, no extra build step. The LangGraph CLI finds `langgraph.json` in `/app/backend/` and loads the graph definition from the same compiled source.

**Key environment variables:**

Same as `app` for `OPENAI_API_KEY`, `LANGSMITH_API_KEY`, `REDIS_URL`, `AGENT_MEMORY_BASE_URL`. The LangGraph graph code imports from workspace packages, so those must be built and available.

---

## Dockerfile (Multi-Stage)

```
Dockerfile (root of repo)
│
├── Stage 1: deps        -- install all npm workspace dependencies
├── Stage 2: packages    -- build workspace packages (cau-*)
├── Stage 3: frontend    -- build Next.js static export (out/)
└── Stage 4: app         -- production image: backend + static frontend + LangGraph reuse
```

### Detailed Stage Breakdown

```dockerfile
# ── Stage 1: Install dependencies ──
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/cau-logger/package.json packages/cau-logger/
COPY packages/cau-redis/package.json packages/cau-redis/
COPY packages/cau-api-server/package.json packages/cau-api-server/
COPY packages/cau-redis-agent-memory/package.json packages/cau-redis-agent-memory/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --workspace-root

# ── Stage 2: Build workspace packages ──
FROM deps AS packages
COPY packages/ packages/
RUN npm run build:packages

# ── Stage 3: Build frontend static export ──
FROM packages AS frontend-build
COPY frontend/ frontend/
ENV NEXT_PUBLIC_API_BASE_URL=""
RUN npm run build -w frontend
# Output: frontend/out/

# ── Stage 4: Production app image ──
FROM node:20-alpine AS app
WORKDIR /app

# Copy workspace package.json files for resolution
COPY package.json package-lock.json ./
COPY packages/cau-logger/package.json packages/cau-logger/
COPY packages/cau-redis/package.json packages/cau-redis/
COPY packages/cau-api-server/package.json packages/cau-api-server/
COPY packages/cau-redis-agent-memory/package.json packages/cau-redis-agent-memory/
COPY backend/package.json backend/

# Install production deps only
RUN npm ci --workspace-root --omit=dev

# Copy built packages
COPY --from=packages /app/packages/ packages/

# Copy backend source
COPY backend/ backend/

# Copy data directory
COPY data/ data/

# Copy frontend static build into backend public dir
COPY --from=frontend-build /app/frontend/out/ backend/public/

# Set environment defaults
ENV NODE_ENV=production
ENV MEETING_MEMORY_PORT=3001
ENV MEETING_MEMORY_DATA_DIR=/app/data
ENV MEETING_MEMORY_ALLOWED_ORIGINS=*

EXPOSE 3001

CMD ["npx", "tsx", "backend/src/index.ts"]
```

The `langgraph` service reuses this same image with a command override (see `docker-compose.yml` below) -- no separate stage needed for a demo.

### Static File Serving Change (Backend)

The backend needs a small addition to serve the frontend's static files. Since `cau-api-server` is Express-based, add static file serving in `backend/src/index.ts`:

```typescript
import express from "express";
import { resolve } from "node:path";

// In the ApiServer.create() config or after server creation:
// Serve frontend static files from /public directory
const staticPath = resolve(__dirname, "../public");
app.use(express.static(staticPath));

// Fallback: serve index.html for client-side routing (SPA)
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api") || req.path === "/health") {
    return next();
  }
  res.sendFile(resolve(staticPath, "index.html"));
});
```

If `cau-api-server` supports a `staticDir` config option, use that instead. Otherwise, the Express instance needs to be exposed for adding this middleware. The exact integration depends on `cau-api-server`'s API -- check if it exposes the underlying Express app or has a plugin/middleware hook.

---

## docker-compose.yml

```yaml
services:
  redis:
    image: redis:latest
    ports:
      - "6379:6379" # Optional: expose for debugging
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  agent-memory:
    image: redislabs/agent-memory-server:latest
    command: agent-memory api --host 0.0.0.0 --port 8000 --task-backend=asyncio
    ports:
      - "8000:8000"       # Optional: expose for debugging
    env_file: .env
    environment:
      REDIS_URL: redis://redis:6379
      DISABLE_AUTH: "true"
    depends_on:
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 15s

  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: app
    ports:
      - "3001:3001"
    env_file: .env
    environment:
      AGENT_MEMORY_BASE_URL: http://agent-memory:8000
      REDIS_URL: redis://redis:6379
      MEETING_MEMORY_DATA_DIR: /app/data
      MEETING_MEMORY_ALLOWED_ORIGINS: "*"
      LANGGRAPH_DEPLOYMENT_URL: http://langgraph:2024
    depends_on:
      redis:
        condition: service_healthy
      agent-memory:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 10s
      timeout: 5s
      retries: 5

  langgraph:
    build:
      context: .
      dockerfile: Dockerfile
      target: app               # reuses the same image as app
    command: npx @langchain/langgraph-cli dev --port 2024 --host 0.0.0.0
    working_dir: /app/backend
    ports:
      - "2024:2024"       # Optional: expose for debugging
    env_file: .env
    environment:
      REDIS_URL: redis://redis:6379
      AGENT_MEMORY_BASE_URL: http://agent-memory:8000
    depends_on:
      redis:
        condition: service_healthy
      agent-memory:
        condition: service_healthy

volumes:
  redis-data:
```

---

## Environment Variables (`.env` at repo root)

Every service uses `env_file: .env` so all variables are loaded from a single file. Services then override only the Docker-internal values (like `REDIS_URL`, `AGENT_MEMORY_BASE_URL`) in their `environment:` block -- compose `environment:` takes precedence over `env_file:`.

Create a `.env` file at the repo root (already gitignored). Copy from `.env.example`:

```env
# ── Required ──
OPENAI_API_KEY=sk-your-openai-key-here

# ── App (backend) ──
MEETING_MEMORY_PORT=3001
MEETING_MEMORY_ACTIVE_DATASET=wealth-advisor
MEETING_MEMORY_MODEL_NAME=gpt-4o-mini
MEETING_MEMORY_CONTEXT_WINDOW_MAX=1500
MEETING_MEMORY_CHATBOT_MODEL=gpt-4o-mini

# ── Agent Memory Server ──
GENERATION_MODEL=gpt-4o-mini
FAST_MODEL=gpt-4o-mini
EMBEDDING_MODEL=text-embedding-3-small
LOG_LEVEL=INFO

# ── LangSmith (optional) ──
LANGSMITH_API_KEY=
LANGSMITH_TRACING=false
```

**How `env_file` + `environment` interact:**

```
.env (loaded by every service via env_file)
  │
  ├── OPENAI_API_KEY ──► agent-memory, app, langgraph (shared)
  ├── GENERATION_MODEL ──► agent-memory
  ├── FAST_MODEL ──► agent-memory
  ├── EMBEDDING_MODEL ──► agent-memory
  ├── MEETING_MEMORY_* ──► app (backend config)
  ├── LANGSMITH_* ──► app, langgraph
  │
  └── Docker-internal overrides (in compose `environment:` block):
      ├── REDIS_URL=redis://redis:6379           (all services)
      ├── AGENT_MEMORY_BASE_URL=http://agent-memory:8000 (app, langgraph)
      ├── LANGGRAPH_DEPLOYMENT_URL=http://langgraph:2024 (app)
      ├── DISABLE_AUTH=true                      (agent-memory)
      ├── MEETING_MEMORY_DATA_DIR=/app/data      (app)
      └── MEETING_MEMORY_ALLOWED_ORIGINS=*       (app)
```

Users edit ONE file (`.env`) to configure everything. Docker-internal service URLs are never in `.env` -- they're hardcoded in the compose file using compose service names.

---

## How the Frontend Reaches the Backend (Same-Origin)

In local development, the frontend runs on `localhost:3000` and talks to the backend on `localhost:3001` via `NEXT_PUBLIC_API_BASE_URL=http://localhost:3001`.

In Docker, the frontend static files are served directly by the backend on port 3001. This means:

1. **Build-time:** `NEXT_PUBLIC_API_BASE_URL=""` (empty string) during `next build`
2. **Runtime:** Frontend JS makes fetch calls to `/api/getDataset`, `/api/appendWorkingMemory`, etc. -- relative paths that resolve to the same origin (`http://localhost:3001`)
3. **No CORS issues** -- same origin, no preflight requests
4. **Single port** -- users only need to open `http://localhost:3001` in their browser

The frontend's `api.service.ts` already supports this:

```typescript
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
// When NEXT_PUBLIC_API_BASE_URL="" at build time, API_BASE_URL = ""
// fetch("" + "/api/getDataset") → fetch("/api/getDataset") → same origin
```

---

## Startup Order & Health Check Flow

```
1. redis starts
   └── healthcheck: redis-cli ping
       └── healthy ✓

2. agent-memory starts (depends on redis healthy)
   └── connects to redis://redis:6379
   └── healthcheck: curl http://localhost:8000/health
       └── healthy ✓ (may take 10-15s for model init)

3. app starts (depends on redis + agent-memory healthy)
   └── connects to http://agent-memory:8000 (AMS health check)
   └── connects to redis://redis:6379 (RedisJSON for copilot state)
   └── loads dataset config, pre-creates summary views
   └── serves frontend static files + backend API
   └── healthcheck: curl http://localhost:3001/health
       └── healthy ✓

4. langgraph starts (depends on redis + agent-memory healthy)
   └── loads graph from backend/src/chatbot-agent/graph.ts
   └── serves LangGraph API on port 2024
```

Total cold start: ~30-45 seconds (dominated by agent-memory-server startup and model initialization).

---

## User Experience

### Quick Start (what goes in the README)

```bash
# 1. Clone the repo
git clone https://github.com/redis/redis-agent-memory-explorer.git
cd redis-agent-memory-explorer

# 2. Set your OpenAI API key
echo "OPENAI_API_KEY=sk-your-key-here" > .env

# 3. Start everything
docker compose up --build

# 4. Open the demo
open http://localhost:3001
```

That's it. Three commands (four if you count the clone) to a running demo.

### Selective Startup

```bash
# Core demo only (no chatbot / LangGraph)
docker compose up redis agent-memory app

# Just Redis + AMS (for local backend development)
docker compose up redis agent-memory

# Rebuild after code changes
docker compose up --build app

# View logs for a specific service
docker compose logs -f agent-memory

# Full reset (wipe Redis data)
docker compose down -v
docker compose up --build
```

### Development Mode (hybrid)

For active development, run infrastructure in Docker and the app locally:

```bash
# Start infrastructure only
docker compose up redis agent-memory

# In another terminal: run the app locally (with hot reload)
npm run dev
```

This gives you hot-reload on the frontend and backend while using Dockerized Redis + AMS.

---

## Profiles (Optional Enhancement)

Docker Compose profiles can separate "core" from "optional" services:

```yaml
services:
  redis:
    # no profile = always starts

  agent-memory:
    # no profile = always starts

  app:
    # no profile = always starts

  langgraph:
    profiles: ["chatbot"] # only starts with --profile chatbot
```

Usage:

```bash
# Core demo (no chatbot)
docker compose up

# Full demo with chatbot
docker compose --profile chatbot up
```

This is useful if the chatbot/LangGraph isn't needed for every demo run.

---

## Advanced: Agent Memory Server from Source

If you need to modify agent-memory-server behavior or want the latest unreleased code:

### Option A: Git Submodule

```bash
# Add as submodule
git submodule add https://github.com/redis/agent-memory-server.git vendor/agent-memory-server

# Update compose to build from source
```

```yaml
agent-memory:
  build:
    context: ./vendor/agent-memory-server
    dockerfile: Dockerfile
  command: agent-memory api --host 0.0.0.0 --port 8000 --task-backend=asyncio
  environment:
    # same env vars as before
```

### Option B: Clone Alongside (not tracked in git)

```bash
# Clone into a gitignored directory
git clone https://github.com/redis/agent-memory-server.git .agent-memory-server
echo ".agent-memory-server/" >> .gitignore
```

```yaml
agent-memory:
  build:
    context: ./.agent-memory-server
    dockerfile: Dockerfile
  # ...
```

### When to Use Source vs. Image

| Scenario                            | Recommendation          |
| ----------------------------------- | ----------------------- |
| Demo / presentation                 | Docker image `:latest`  |
| Pinned reproducible build           | Docker image `:v0.15.1` |
| Need to debug AMS behavior          | Source checkout         |
| Contributing patches to AMS         | Source checkout         |
| Custom memory extraction strategies | Source checkout         |
| Custom embedding provider           | Docker image + env vars |

**Recommendation for this demo:** Use the Docker image. All the configuration we need (Redis URL, models, auth) is exposed via environment variables. No source modification is necessary.

---

## File Changes Required

### New Files

| File                  | Purpose                                               |
| --------------------- | ----------------------------------------------------- |
| `Dockerfile`          | Multi-stage build for `app` and `langgraph` targets   |
| `docker-compose.yml`  | Orchestrates all four services                        |
| `.dockerignore`       | Excludes `node_modules`, `.git`, `.next`, `out`, etc. |
| `.env.example` (root) | Template for required env vars (for Docker Compose)   |

### Modified Files

| File                   | Change                                                                                              |
| ---------------------- | --------------------------------------------------------------------------------------------------- |
| `backend/src/index.ts` | Add `express.static()` for `public/` dir via `server.expressApp` (same pattern as CopilotKit mount) |
| `.gitignore`           | Add `.agent-memory-server/` if using source checkout option                                         |
| `README.md`            | Add Docker quick start section                                                                      |

### `.dockerignore`

```
node_modules/
.git/
.next/
out/
*.md
docs/
.vscode/
.env
.env.*
!.env.example
temp/
.agent-memory-server/
```

---

## Backend Static File Serving Detail

The code for static file serving does **not exist yet**, but the integration point is clear.

`cau-api-server` exposes the underlying Express app via `server.expressApp` (public getter). The backend already uses this pattern to mount the CopilotKit middleware:

```typescript
// backend/src/index.ts (existing code, lines 133-141)
server.expressApp.use(COPILOTKIT_ENDPOINT, async (req, res, next) => {
  // ...CopilotKit handler...
});
```

Static file serving follows the exact same pattern. Add this in `backend/src/index.ts` between `ApiServer.create()` and `server.start()`:

```typescript
import express from "express";
import { resolve } from "node:path";
import { existsSync } from "node:fs";

// Resolve the public directory (frontend static build copied here during Docker build)
const STATIC_DIR = resolve(__dirname, "../public");

// Serve static files if the public directory exists (Docker build only)
if (existsSync(STATIC_DIR)) {
  server.expressApp.use(express.static(STATIC_DIR));
}
```

**Why this works with the middleware order in `cau-api-server`:**

1. `ApiServer.create()` → installs security middleware, request ID, health endpoint
2. User code runs → adds `express.static()` + CopilotKit middleware
3. `server.start()` → calls `mountRouterAndErrorHandlers()` which adds API routes + 404 handler

Static files are checked **before** API routes. If no file matches, the request falls through to the API router. This is the correct Express middleware order.

**SPA fallback is not needed** because the Next.js static export uses `trailingSlash: true`, which generates `out/index.html` for the root route. Express static serves `index.html` from a directory automatically when the request path matches the directory.

**No-op in local dev:** The `existsSync` guard means this code does nothing when running locally (no `public/` folder exists). The frontend runs on its own dev server at `:3000` during development.

---

## DATA_DIR Path Resolution

In Docker, the `data/` folder is copied to `/app/data/`. The backend's `config.ts` resolves `DATA_DIR` relative to `__dirname`:

```typescript
DATA_DIR: resolve(
  __dirname,
  process.env.MEETING_MEMORY_DATA_DIR ?? DEFAULT_DATA_DIR,
);
```

- **Local dev:** `__dirname` = `backend/src/`, `DEFAULT_DATA_DIR` = `../../data` → resolves to repo root `data/`
- **Docker:** Set `MEETING_MEMORY_DATA_DIR=/app/data` as an absolute path. The `resolve()` call with an absolute second arg ignores the first arg, so it resolves to `/app/data` correctly.

No code change needed -- just set the env var to an absolute path in Docker.

---

## LangGraph Container Detail

The LangGraph CLI (`@langchain/langgraph-cli`) is a development tool that:

1. Reads `langgraph.json` to find graph definitions
2. Starts an HTTP server that exposes the graph as a REST API
3. The backend's CopilotKit integration calls this server to run the chatbot agent

**`langgraph.json`** (already exists in `backend/`):

```json
{
  "node_version": "20",
  "graphs": {
    "memoryAgent": "./src/chatbot-agent/graph.ts:compiledGraph"
  },
  "env": ".env"
}
```

In Docker, the LangGraph container needs:

- The compiled workspace packages (the graph imports from `cau-redis-agent-memory`)
- The backend source code (the graph definition is in `backend/src/chatbot-agent/`)
- Environment variables (`OPENAI_API_KEY`, `REDIS_URL`, `AGENT_MEMORY_BASE_URL`)

The multi-stage Dockerfile handles this by creating a `langgraph` target that includes all necessary code but runs the LangGraph CLI instead of the backend server.

**Note:** `@langchain/langgraph-cli dev` is meant for development. For production, LangGraph Cloud or `langgraph up` would be used. For this demo, the dev server is sufficient.

---

## Open Questions / Decisions

### 1. LangGraph CLI in Docker

The `@langchain/langgraph-cli dev` command may expect a TTY or behave differently in a container. Need to test:

- Does it bind to `0.0.0.0` by default or only `localhost`? (We pass `--host 0.0.0.0` explicitly)
- Does it require any interactive prompts on first run?
- Are there any file-watching features that should be disabled in Docker?

### 2. Hot Reload in Docker (Development)

For development workflows where users want to edit code and see changes:

- Mount source directories as volumes
- Use the `dev` script instead of `start`
- Consider a `docker-compose.dev.yml` override

---

## Summary

| What                      | How                                                          |
| ------------------------- | ------------------------------------------------------------ |
| Redis                     | `redis:latest` image (8.x includes Query Engine natively)    |
| Agent Memory Server       | `redislabs/agent-memory-server:latest` image                 |
| Demo App                  | Single container: backend API + frontend static build        |
| LangGraph                 | Separate container, reuses `app` image with command override |
| Frontend delivery         | Next.js static export → copied into backend `public/`        |
| Static file serving       | `server.expressApp.use(express.static(...))` in `index.ts`   |
| Config                    | Single `.env` file with `OPENAI_API_KEY` (only required)     |
| Startup                   | `docker compose up --build` → open `http://localhost:3001`   |
| Core demo (no chatbot)    | `docker compose up redis agent-memory app`                   |
| Full demo                 | `docker compose up` (or `--profile chatbot` with profiles)   |
| Infrastructure-only (dev) | `docker compose up redis agent-memory`                       |
