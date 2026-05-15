# Context Surfaces — Feature Understanding

## Purpose

This document captures a thorough analysis of the **Redis Context Surfaces** feature based on two source repositories:

- **Demo app**: `context-engine-demos` — a multi-domain Python demo that showcases Context Surfaces with a LangGraph agent, FastAPI backend, and React chat UI.
- **SDK mono-repo** (`cce`): contains the **Python SDK** (`context-surfaces` package) and a **TypeScript SDK** (`@cloud-context-engine/client`). The Go server code also lives here.

The goal is to understand Context Surfaces deeply so we can integrate the feature into our Redis Agent Memory Explorer (suggestions tab, chatbot, etc.).

---

## What Are Context Surfaces?

Context Surfaces is a **Redis Cloud managed service** that turns structured data stored in Redis into **auto-generated MCP (Model Context Protocol) tools** an AI agent can call. Instead of dumping documents into a vector store and hoping the LLM retrieves the right context, Context Surfaces gives agents **structured, scoped, real-time access** to operational data.

### Core Value Proposition

| Traditional RAG | Context Surfaces |
|---|---|
| Embed documents → vector search → hope LLM reasons correctly | Define a data model → auto-generate `search_*`, `filter_*`, `get_*` MCP tools |
| Single retrieval step, one-shot answer | Multi-step tool-calling agent with full traceability |
| Context is a blob of text chunks | Context is **typed, indexed, relational** Redis data |
| Hard to scope what the agent sees | Scoped via agent keys tied to a specific surface |

### Key Concepts

| Concept | Description |
|---|---|
| **Context Surface** | A named container binding a data model + a Redis data source. The cloud service reads the data model and auto-generates MCP tools (search, filter, get) for every indexed entity field. |
| **Data Model** | A JSON description of entities, their fields (with Redis index metadata: text/tag/numeric/vector), relationships, and key templates. Generated from `ContextModel` Python classes or authored as JSON. |
| **Admin Key** (`CTX_ADMIN_KEY`) | Full-privilege key for creating surfaces, importing data, and minting agent keys. Obtained from the Redis Cloud console. |
| **Agent Key** (`MCP_AGENT_KEY`) | Scoped key that authorizes an AI agent to call MCP tools on a specific surface. Created programmatically per surface. |
| **MCP Server** | The cloud-hosted JSON-RPC endpoint that receives `tools/list` and `tools/call` requests. The agent key in the `X-API-Key` header determines which surface (and therefore which tools) are available. |
| **Auto-generated tools** | From a data model with entities like `Customer`, `Order`, `Product`, the service generates tools such as: `search_customer_by_text`, `filter_order_by_customer_id`, `filter_order_by_status`, `get_order_by_id`, `search_product_by_text`, `search_guide_by_content_embedding_similarity`, etc. |

---

## Architecture (from the demo)

```
┌─────────────┐     SSE      ┌──────────────┐   JSON-RPC   ┌──────────────────┐
│  React Chat │◄────────────►│   FastAPI     │◄────────────►│  Context Surfaces│
│  (Vite)     │              │ + LangGraph   │              │  MCP Server      │
│  :3040      │              │   :8040       │              │  (cloud)         │
└─────────────┘              └──────┬────────┘              └───────┬──────────┘
                                    │                               │
                                    │ redis-py                      │
                                    ▼                               ▼
                             ┌──────────────┐               ┌──────────────┐
                             │ Redis Cloud  │◄──────────────│ Auto-created │
                             │ (your data)  │               │ Search indexes│
                             └──────────────┘               └──────────────┘
```

### Data Flow

1. **Define** entities in Python as `ContextModel` subclasses (or via `EntitySpec` schema definitions).
2. **Generate models** (`make generate-models`) — renders `ContextModel` classes from `EntitySpec`s.
3. **Generate data** (`make generate-data`) — produces JSONL files with sample records.
4. **Setup surface** (`make setup-surface`) — calls the Context Surfaces REST API to create a surface with the data model and embedded Redis connection config. Also creates an agent key. Writes `CTX_SURFACE_ID` and `MCP_AGENT_KEY` back to `.env`.
5. **Load data** (`make load-data`) — uses `UnifiedClient.import_data()` to push records into Redis via the Context Surfaces API (which handles JSON storage and index creation).
6. **Run** — the LangGraph ReAct agent fetches available MCP tools at startup via `UnifiedClient.list_tools()`, wraps them as LangChain `StructuredTool` instances, and uses them alongside internal (local) tools during conversations.

---

## Python SDK (`context-surfaces` package)

Package: `context-surfaces>=0.0.1` (from the `cce/python-client` directory).

### Key Classes

#### `UnifiedClient`

The main high-level client combining REST API and MCP operations.

```python
async with UnifiedClient(api_url=None, mcp_url=None) as client:
    # Admin operations (REST API)
    admin_key = await client.create_admin_key("name", "owner")
    surface   = await client.create_context_surface(admin_key.key, "My Surface", data_model={...})
    agent_key = await client.create_agent_key(admin_key.key, surface.id, "Agent Name")

    # Data loading (REST API)
    result = await client.import_data(
        admin_key=admin_key.key,
        context_surface_id=surface.id,
        records=[Customer(...), Customer(...)],  # ContextModel instances
        on_conflict="overwrite",
    )

    # MCP tool operations (JSON-RPC to MCP server)
    tools  = await client.list_tools(agent_key.key)
    result = await client.query_tool(agent_key.key, "search_customer_by_text", {"query": "john"})
```

URL resolution: explicit arg > `CTX_API_URL` / `CTX_MCP_URL` env vars > built-in defaults.

Default URLs:
- API: `https://cloud.redis.io/context-surfaces`
- MCP: `https://gcp-us-east4.context-surfaces.redis.io/mcp`

#### `ContextSurfacesClient`

Lower-level REST API client (httpx-based, with tenacity retries).

| Method | Endpoint | Description |
|---|---|---|
| `create_admin_key(req)` | `POST /api/v1/keys` | Create admin key |
| `validate_key(key)` | `POST /api/v1/keys/validate` | Validate any key |
| `create_context_surface(req)` | `POST /api/v1/context-surfaces` | Create a surface |
| `get_context_surface(id)` | `GET /api/v1/context-surfaces/{id}` | Get surface details |
| `list_context_surfaces()` | `GET /api/v1/context-surfaces` | List all surfaces |
| `update_context_surface(id, req)` | `PUT /api/v1/context-surfaces/{id}` | Update surface |
| `delete_context_surface(id)` | `DELETE /api/v1/context-surfaces/{id}` | Delete surface |
| `create_agent_key(surface_id, req)` | `POST /api/v1/context-surfaces/{id}/agent-keys` | Create agent key |
| `list_agent_keys(surface_id)` | `GET /api/v1/context-surfaces/{id}/agent-keys` | List agent keys |
| `_request("POST", f".../{surface_id}/data", ...)` | `POST /api/v1/context-surfaces/{id}/data` | Import data records |

#### `MCPClient`

JSON-RPC client for the MCP server (httpx-based).

| Method | JSON-RPC method | Description |
|---|---|---|
| `initialize()` | `initialize` | Initialize MCP session |
| `list_tools()` | `tools/list` | List available MCP tools |
| `call_tool(name, args)` | `tools/call` | Execute a tool |

Authentication: `X-API-Key: <agent_key>` header on every request.

#### `ContextModel` / `ContextField` / `ContextRelationship`

Pydantic BaseModel subclasses that carry Redis indexing metadata.

```python
class Customer(ContextModel):
    __redis_key_template__ = "electrohub_customer:{customer_id}"

    customer_id: str = ContextField(description="Unique ID", is_key_component=True)
    name: str        = ContextField(description="Full name", index="text", weight=2.0)
    email: str       = ContextField(description="Email", index="text", no_stem=True)
    city: str        = ContextField(description="City", index="tag")
    rating: float    = ContextField(description="Rating", index="numeric", sortable=True)
    embedding: list[float] = ContextField(
        description="Vector", index="vector", vector_dim=1536, distance_metric="cosine"
    )

    orders: list[Order] = ContextRelationship(description="Customer orders", source_field="customer_id")
```

`ContextField` index types: `text`, `tag`, `numeric`, `vector`.
`ContextRelationship` descriptors are excluded from serialization but exported in the data model metadata.

`export_data_model(title, description, entities)` → produces the JSON data model consumed by the REST API during surface creation.

---

## TypeScript SDK (`@cloud-context-engine/client`)

Package: `@cloud-context-engine/client` (from `cce/typescript-client`).
Dependencies: `ky` (HTTP), `zod` (runtime validation).

### Key Differences from Python SDK

The TypeScript SDK currently covers admin/management REST API operations but does **not yet wrap** MCP tool calling or data import. However, this is just an SDK gap — the cloud server **does expose all these capabilities as HTTP APIs**. The MCP endpoint is `POST /mcp` (JSON-RPC 2.0 over HTTP with `X-API-Key` agent key auth), and data import is `POST /api/v1/context-surfaces/{id}/data`. We can call these directly from TypeScript without needing the SDK to wrap them.

| Capability | Python SDK | TypeScript SDK | Cloud API |
|---|---|---|---|
| Create/manage surfaces | `ContextSurfacesClient` | `CloudContextSurfaceClient` | `POST /api/v1/context-surfaces` |
| Create admin/agent keys | Yes | Yes | `POST .../agent-keys` |
| Redis instance management | No (embedded in surface creation) | Yes (`createRedisInstance`, `testRedisConnection`) | `POST /api/v1/redis-instances` |
| MCP tool listing/calling | `MCPClient` / `UnifiedClient` | Not in SDK yet | `POST /mcp` (JSON-RPC) |
| Data model as code | `ContextModel` / `ContextField` | Not in SDK yet (JSON only) | N/A (client-side concern) |
| Data import | `UnifiedClient.import_data()` | Not in SDK yet | `POST .../data` |
| JWT auth (login/register) | No | Yes | `POST /api/v1/auth/*` |
| Zod runtime validation | N/A | Yes (all responses) | N/A |
| Retry with backoff | tenacity (Python) | ky built-in (exponential backoff) | N/A |

**Bottom line**: The cloud exposes everything we need as APIs. The TS SDK just hasn't wrapped the MCP and data-import endpoints yet. We can either extend the SDK or call the APIs directly — both are trivial since it's just HTTP.

### TypeScript Client API

```typescript
import { CloudContextSurfaceClient } from '@cloud-context-engine/client';

const client = new CloudContextSurfaceClient({
  baseUrl: 'https://cloud.redis.io/context-surfaces',
  apiKey: 'ak_your_admin_key',
});

// Surface CRUD
const surface = await client.createContextSurface({ name: 'My Surface', description: '...' });
await client.getContextSurface(surface.id);
await client.listContextSurfaces({ page: 1, page_size: 20 });
await client.updateContextSurface(surface.id, { name: 'Updated' });
await client.deleteContextSurface(surface.id);

// Agent keys
const agentKey = await client.createAgentKey(surface.id, { name: 'My Agent' });
await client.listAgentKeys(surface.id);

// Redis instances
const instance = await client.createRedisInstance({ name: 'My Redis', connection_config: { addr: '...', password: '...' } });
await client.testRedisConnection({ addr: '...', password: '...' });

// Admin keys
const adminKey = await client.createAdminKey({ name: 'Admin', owner: 'user123' });
await client.validateAdminKey();

// JWT auth (for dashboard apps)
const auth = await client.login('user@example.com', 'password');
client.setAccessToken(auth.access_token);
```

### TypeScript Zod Schemas (key types)

```typescript
ContextSurface:     { id, name, description?, owner, redis_instance_id?, tools?, data_model?, metadata?, created_at, updated_at }
DataModel:          { title, description, entities?, entity_count? }
EntityDescription:  { name, description, redis_key_template?, fields?, relationships? }
FieldDescription:   { name, type, description, mutable?, is_key_component?, redis_indices? }
RedisIndexConfig:   { type: 'text'|'tag'|'numeric'|'vector', weight?, no_stem?, sortable?, vector_dim?, distance_metric? }
AgentAPIKey:        { id, key, name, context_surface_id, key_type?, ... }
RedisConnectionConfig: { addr?, password?, db?, tls_enabled?, pool_size?, min_idle_conns?, ca_cert? }
```

---

## Demo App Internals (context-engine-demos)

### Domain Pack Pattern

Each demo domain is a self-contained folder under `domains/<domain-id>/`:

| File | Purpose |
|---|---|
| `schema.py` | `ENTITY_SPECS` tuple of `EntitySpec` objects defining entities, fields, indexes, relationships |
| `generated_models.py` | Auto-generated `ContextModel` subclasses (from `make generate-models`) |
| `domain.py` | `DOMAIN` export implementing the `DomainPack` protocol |
| `prompt.py` | System prompt builder that receives MCP tool names and generates agent instructions |
| `data_generator.py` | Generates realistic sample data as JSONL |
| `docs/demo_paths.md` | Scripted conversation flows for demos |
| `assets/logo.*` | Domain branding logo |

### DomainPack Protocol

```python
class DomainPack(Protocol):
    manifest: DomainManifest

    def get_entity_specs(self) -> tuple[EntitySpec, ...]
    def build_system_prompt(self, *, mcp_tools, runtime_config) -> str
    def get_internal_tool_definitions(self, *, runtime_config) -> Sequence[InternalToolDefinition]
    def execute_internal_tool(self, tool_name, arguments, settings) -> dict
    def write_dataset_meta(self, *, settings, records) -> dict
    def generate_demo_data(self, *, output_dir, seed, update_env_file) -> GeneratedDataset
    def validate(self) -> list[str]
```

### Agent Architecture

- **LangGraph `create_react_agent`** with a ReAct tool-calling loop.
- **Two tool sources**: internal (local Python functions defined by the domain) + MCP (auto-generated by Context Surfaces).
- MCP tools are fetched at startup via `ContextSurfaceService.list_tools()` → wraps each as a LangChain `StructuredTool`.
- Conversation state is persisted via `AsyncRedisSaver` (LangGraph Redis checkpointer).
- Responses stream to the frontend via **SSE** with structured events: `status`, `thinking-step`, `tool-call`, `tool-result`, `text-delta`, `done`, `error`.

### Two Modes

| Mode | Flow |
|---|---|
| **Context Surfaces** | User → LangGraph agent → calls 60+ MCP tools iteratively → structured real-time data |
| **Simple RAG** | User → embed query → vector search via MCP → single-shot LLM answer from retrieved docs |

---

## REST API Endpoints (Context Surfaces Cloud Service)

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/v1/keys` | Session | Create admin API key |
| `POST` | `/api/v1/keys/validate` | Any | Validate a key |
| `POST` | `/api/v1/context-surfaces` | Admin | Create a context surface (with data model + data source) |
| `GET` | `/api/v1/context-surfaces` | Admin | List surfaces |
| `GET` | `/api/v1/context-surfaces/{id}` | Admin | Get surface details |
| `PUT` | `/api/v1/context-surfaces/{id}` | Admin | Update surface |
| `DELETE` | `/api/v1/context-surfaces/{id}` | Admin | Delete surface |
| `POST` | `/api/v1/context-surfaces/{id}/agent-keys` | Admin | Create agent key |
| `GET` | `/api/v1/context-surfaces/{id}/agent-keys` | Admin | List agent keys |
| `POST` | `/api/v1/context-surfaces/{id}/data` | Admin | Import data records |
| `POST` | `/api/v1/redis-instances` | Admin | Register a Redis instance |
| `GET` | `/api/v1/redis-instances` | Admin | List Redis instances |
| `POST` | `/api/v1/redis-instances/test-connection` | Admin | Test Redis connection |
| `POST` | `/mcp` | Agent | JSON-RPC MCP endpoint (`initialize`, `tools/list`, `tools/call`) |

---

## MCP Protocol Details

The MCP server uses **JSON-RPC 2.0 over HTTP POST**.

### `tools/list` response (example)

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      {
        "name": "search_customer_by_text",
        "description": "Search Customer entities by text query",
        "inputSchema": {
          "type": "object",
          "properties": {
            "query": { "type": "string", "description": "Text search query" },
            "limit": { "type": "integer", "description": "Max results", "default": 10 }
          },
          "required": ["query"]
        }
      },
      {
        "name": "filter_order_by_customer_id",
        "description": "Filter Order entities by customer_id (TAG)",
        "inputSchema": {
          "type": "object",
          "properties": {
            "customer_id": { "type": "string" },
            "limit": { "type": "integer", "default": 10 }
          },
          "required": ["customer_id"]
        }
      }
    ]
  }
}
```

### Tool naming conventions

| Pattern | Generated from | Example |
|---|---|---|
| `search_{entity}_by_text` | Any entity with TEXT-indexed fields | `search_product_by_text` |
| `search_{entity}_by_{field}_similarity` | Fields with VECTOR index | `search_guide_by_content_embedding_similarity` |
| `filter_{entity}_by_{field}` | Fields with TAG or NUMERIC index | `filter_order_by_status` |
| `get_{entity}_by_{id_field}` | Entity key component field | `get_customer_by_customer_id` |

---

## What We Need for Integration

### For our suggestions tab / chatbot

To add Context Surfaces to our Redis Agent Memory Explorer, we would need:

1. **Admin key** — obtain from Redis Cloud console (`CTX_ADMIN_KEY`).
2. **Define a data model** — either as `ContextModel` Python classes (if using the Python SDK) or as a JSON data model (if using the TypeScript SDK + REST API directly).
3. **Create a surface** — `POST /api/v1/context-surfaces` with the data model and Redis connection config.
4. **Create an agent key** — `POST /api/v1/context-surfaces/{id}/agent-keys`.
5. **Import data** — `POST /api/v1/context-surfaces/{id}/data` with entity records.
6. **Use MCP tools at runtime** — the agent calls `tools/list` and `tools/call` via JSON-RPC to the MCP server with the agent key.

### TypeScript integration options

Since we are a TypeScript/Node.js project, we have multiple approaches:

| Option | Description | Effort |
|---|---|---|
| **A. Use TS SDK + thin MCP wrapper** | Use `@cloud-context-engine/client` for admin ops. Add a small wrapper for `POST /mcp` JSON-RPC calls and `POST .../data` imports. | Low |
| **B. Direct API calls only** | Skip the TS SDK entirely. Call all REST + MCP endpoints directly with `fetch`/`ky`/`httpx`. | Low |
| **C. Use a generic MCP client lib** | Use an existing TypeScript MCP client library (e.g. `@modelcontextprotocol/sdk`) for the JSON-RPC layer, combine with the TS SDK for admin. | Medium |

### What the TS SDK gives us today

- Create/manage surfaces via REST API (`createContextSurface`, `createAgentKey`).
- Manage Redis instances (register, test connection).
- JWT auth for dashboard-style UIs.
- Full Zod-validated type safety on all API responses.

### What the cloud API exposes that the TS SDK doesn't wrap yet

All of these are simple HTTP calls we can make directly:

- **MCP tool listing & calling** — `POST /mcp` with JSON-RPC 2.0 body, `X-API-Key: <agent_key>` header. Methods: `initialize`, `tools/list`, `tools/call`. The server runs on a separate port (`MCPPort`) from the admin API, and in production the MCP URL defaults to `https://gcp-us-east4.context-surfaces.redis.io/mcp`.
- **Data import** — `POST /api/v1/context-surfaces/{id}/data` with `X-API-Key: <admin_key>` header. Body: `{ entity, records, options: { on_conflict, on_error } }`.
- **Schema inference** — `POST /api/v1/context-surfaces/infer-schema` (LLM-based schema detection from existing Redis data).
- **Tool activity logs** — `GET /api/v1/context-surfaces/{id}/activity/tools/sessions` and related endpoints.

---

## Surface Creation Payload (for reference)

```json
{
  "name": "ElectroHub Commerce Surface",
  "description": "Electronics retail support demo",
  "data_model": {
    "title": "ElectroHub Commerce Surface",
    "description": "...",
    "entity_count": 10,
    "entities": [
      {
        "name": "Customer",
        "description": "...",
        "redis_key_template": "electrohub_customer:{customer_id}",
        "fields": [
          { "name": "customer_id", "type": "str", "description": "Unique ID", "is_key_component": true, "redis_indices": [] },
          { "name": "name", "type": "str", "description": "Full name", "redis_indices": [{ "type": "text", "weight": 2.0 }] },
          { "name": "city", "type": "str", "description": "City", "redis_indices": [{ "type": "tag" }] },
          { "name": "rating", "type": "float", "description": "Rating", "redis_indices": [{ "type": "numeric", "sortable": true }] }
        ],
        "relationships": [
          { "name": "orders", "target": "Order", "description": "Customer orders", "source_field": "customer_id" }
        ]
      }
    ]
  },
  "data_source": {
    "type": "redis",
    "name": "redis",
    "connection_config": {
      "addr": "redis-xxxxx.c1.us-east-1-2.ec2.redns.redis-cloud.com:12345",
      "username": "default",
      "password": "...",
      "db": 0,
      "tls_enabled": true,
      "pool_size": 10,
      "min_idle_conns": 2
    }
  }
}
```

---

## Configuration Required

| Variable | Source | Purpose |
|---|---|---|
| `CTX_ADMIN_KEY` | Redis Cloud console | Admin operations (create surface, import data, create agent keys) |
| `CTX_SURFACE_ID` | Auto-populated after surface creation | Identifies the active surface |
| `MCP_AGENT_KEY` | Auto-populated after agent key creation | Runtime auth for MCP tool calls |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | Your Redis Cloud instance | Where the actual data lives |
| `OPENAI_API_KEY` | OpenAI | LLM chat completions + embeddings |
| `CTX_API_URL` | Optional (has default) | Override the Context Surfaces REST API URL |
| `CTX_MCP_URL` | Optional (has default) | Override the MCP server URL |
