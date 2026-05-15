# cau-context-surfaces Package Plan

## Purpose

A reusable TypeScript package under `packages/cau-context-surfaces/` that provides a unified client for Redis Context Surfaces. It wraps the existing TypeScript SDK (`@cloud-context-engine/client`) for admin/management operations and adds custom API wrappers for the MCP JSON-RPC protocol (tool listing, tool calling) and record loading -- the gaps that the current SDK doesn't cover.

This package is analogous to `cau-ram` -- a clean facade that any demo or app can import without caring about the underlying SDK or HTTP details. It follows the same singleton + factory pattern, same file conventions, and same code style rules.

---

## What It Wraps

### Delegated to vendored `@cloud-context-engine/client` SDK

| Capability       | SDK Method                         | Our Method                          |
| ---------------- | ---------------------------------- | ----------------------------------- |
| Create surface   | `createContextSurface(data)`       | `createSurface(input)`              |
| Get surface      | `getContextSurface(id)`            | `getSurface(surfaceId)`             |
| List surfaces    | `listContextSurfaces(params)`      | `listSurfaces(options)`             |
| Update surface   | `updateContextSurface(id, data)`   | `updateSurface(surfaceId, input)`   |
| Delete surface   | `deleteContextSurface(id)`         | `deleteSurface(surfaceId)`          |
| Create agent key | `createAgentKey(surfaceId, data)`  | `createAgentKey(surfaceId, input)`  |
| List agent keys  | `listAgentKeys(surfaceId, params)` | `listAgentKeys(surfaceId, options)` |
| Validate key     | `validateAdminKey()`               | `validateKey()`                     |
| Health           | `getHealth()`                      | `health()`                          |

### Custom code in `cau-context-surfaces` (not in SDK yet)

| Capability             | HTTP Call                                 | Our Method                      |
| ---------------------- | ----------------------------------------- | ------------------------------- |
| Initialize MCP session | `POST /mcp` (JSON-RPC: `initialize`)      | `initializeMcp()`               |
| List MCP tools         | `POST /mcp` (JSON-RPC: `tools/list`)      | `listTools()`                   |
| Call MCP tool          | `POST /mcp` (JSON-RPC: `tools/call`)      | `callTool(name, args)`          |
| Load records           | `POST /api/v1/context-surfaces/{id}/data` | `loadRecords(surfaceId, input)` |

---

## Architecture: Vendor the SDK

The `@cloud-context-engine/client` SDK is **not published to npm** yet. We vendor it as a workspace package -- the same pattern used for `agent-memory-ts-sdk` (before `@redis-iris/agent-memory` was published to npm):

1. **Copy** `cce/typescript-client/` into `packages/context-surfaces-ts-sdk/`
2. **Keep it untouched** -- no modifications to vendored code
3. **Reference by package name** in `cau-context-surfaces/package.json`: `"@cloud-context-engine/client": "*"` (npm workspace resolution)
4. **Import by package name**: `import { CloudContextSurfaceClient } from "@cloud-context-engine/client"`
5. **When SDK is published to npm**, remove `packages/context-surfaces-ts-sdk/` and switch the dependency to the npm version (same migration path as `agent-memory-ts-sdk` → `@redis-iris/agent-memory`)

| Component                                                              | Analogy                                                                  |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `packages/agent-memory-ts-sdk/` → now `@redis-iris/agent-memory` (npm) | `packages/context-surfaces-ts-sdk/` → vendored (npm TBD)                 |
| `packages/cau-ram/` (wraps SDK + adds intelligence)                    | `packages/cau-context-surfaces/` (wraps SDK + adds MCP + record loading) |

### What the vendored SDK already provides

`CloudContextSurfaceClient` handles surface CRUD, agent key management, admin key management, Redis instance management, JWT auth, and health checks -- all with `ky` HTTP client and `zod` runtime validation. `cau-context-surfaces` delegates these operations to the vendored SDK.

### What `cau-context-surfaces` adds on top

Only the features missing from the SDK:

- **MCP JSON-RPC client** (`initializeMcp`, `listTools`, `callTool`) -- uses Node `fetch` directly since it's a different protocol (JSON-RPC over HTTP to a separate MCP server)
- **Record loading** (`loadRecords`) -- pushes structured entity records into a surface via `POST /api/v1/context-surfaces/{id}/data`, not yet in SDK
- **Singleton + factory pattern** -- consistent with `cau-ram`
- **Config from environment** -- `CTX_ADMIN_KEY`, `MCP_AGENT_KEY`, `CTX_MCP_URL`, etc.
- **Dual auth** -- admin key for SDK operations, agent key for MCP operations

---

## Folder Structure

### Vendored SDK (untouched)

```
packages/context-surfaces-ts-sdk/       # Vendored from cce/typescript-client/
  src/
    client.ts                           # CloudContextSurfaceClient class
    schemas.ts                          # Zod schemas + inferred types
    errors.ts                           # Typed error classes
    utils/
      fetch.ts                          # ky-based HTTP client factory
    generated/
      api-types.ts                      # Auto-generated from OpenAPI spec
    index.ts                            # Barrel exports
  package.json                          # name: "@cloud-context-engine/client"
  tsconfig.json
  ...                                   # Other SDK files (tests, config, etc.)
```

### Wrapper Package (our code)

```
packages/cau-context-surfaces/
  docs/
    plan.md                             # This document (symlinked or copied)
  src/
    operations/
      mcp/
        json-rpc.util.ts                # JSON-RPC 2.0 request builder + response parser
        json-rpc.util.test.ts
        index.ts                        # initializeMcp, listTools, callTool (NEW -- not in SDK)
        index.test.ts
      data-loader/
        index.ts                        # loadRecords (NEW -- not in SDK)
        index.test.ts
    constants.ts                        # URLs, timeouts, JSON-RPC version, MCP protocol version
    config.ts                           # ENV loading (CTX_ADMIN_KEY, CTX_MCP_URL, etc.)
    types.ts                            # All public + internal types (re-exports SDK types where needed)
    context-surfaces.ts                 # Main public class (singleton + factory, delegates to SDK + MCP)
    context-surfaces.test.ts
    index.ts                            # Barrel exports
  examples/
    usage-example.ts                    # Full runnable flow: schema → surface → load records → tools → query
  vitest.setup.ts
  vitest.config.ts
  tsconfig.json
  package.json                          # deps: "@cloud-context-engine/client": "*", "dotenv"
  SKILL.md
  README.md
```

Note: `operations/surfaces/` and `operations/agent-keys/` are NOT needed -- the vendored SDK already provides those via `CloudContextSurfaceClient`. The `ContextSurfaces` class delegates directly to the SDK for those calls.

---

## Public API Design

### Class: `ContextSurfaces`

Singleton + factory pattern (matches `cau-ram`'s `RedisAgentMemory`).

```typescript
ContextSurfaces.create({
  adminApiUrl: "https://cloud.redis.io/context-surfaces",
  mcpUrl: "https://gcp-us-east4.context-surfaces.redis.io/mcp",
  adminKey: "ak_...",
  agentKey: "agt_...", // optional at creation, required for MCP calls
  timeout: 30000,
  retries: 3,
});

const cs = ContextSurfaces.getInstance();
```

Two auth contexts coexist:

- **Admin key** (`X-API-Key: <adminKey>`) -- for REST API calls (surface CRUD, record loading, key management)
- **Agent key** (`X-API-Key: <agentKey>`) -- for MCP calls (listTools, callTool)

The consumer can provide both at creation time, or set the agent key later via `setAgentKey()` after creating a surface and minting an agent key programmatically.

### Methods

#### Surface Management (Admin Key)

| Method          | Signature                                                            | Description                                            |
| --------------- | -------------------------------------------------------------------- | ------------------------------------------------------ |
| `createSurface` | `(input: CreateSurfaceInput) => Promise<Surface>`                    | Create a context surface with data model + data source |
| `getSurface`    | `(surfaceId: string) => Promise<Surface>`                            | Get surface details                                    |
| `listSurfaces`  | `(options?: ListOptions) => Promise<ListSurfacesResult>`             | List surfaces with pagination                          |
| `updateSurface` | `(surfaceId: string, input: UpdateSurfaceInput) => Promise<Surface>` | Update surface name/description/metadata               |
| `deleteSurface` | `(surfaceId: string) => Promise<void>`                               | Delete a surface                                       |

#### Agent Key Management (Admin Key)

| Method           | Signature                                                                    | Description                            |
| ---------------- | ---------------------------------------------------------------------------- | -------------------------------------- |
| `createAgentKey` | `(surfaceId: string, input: CreateAgentKeyInput) => Promise<AgentKey>`       | Create an agent key for a surface      |
| `listAgentKeys`  | `(surfaceId: string, options?: ListOptions) => Promise<ListAgentKeysResult>` | List agent keys                        |
| `setAgentKey`    | `(agentKey: string) => void`                                                 | Set/update the agent key for MCP calls |

#### MCP Tools (Agent Key)

| Method          | Signature                                                                  | Description                                 |
| --------------- | -------------------------------------------------------------------------- | ------------------------------------------- |
| `initializeMcp` | `() => Promise<McpInitResult>`                                             | Initialize MCP session (protocol handshake) |
| `listTools`     | `() => Promise<McpTool[]>`                                                 | List available MCP tools for the surface    |
| `callTool`      | `(name: string, args?: Record<string, unknown>) => Promise<McpToolResult>` | Call an MCP tool by name                    |

#### Data Loading (Admin Key)

| Method        | Signature                                                                    | Description                                   |
| ------------- | ---------------------------------------------------------------------------- | --------------------------------------------- |
| `loadRecords` | `(surfaceId: string, input: LoadRecordsInput) => Promise<LoadRecordsResult>` | Push structured entity records into a surface |

#### Utility

| Method        | Signature                      | Description            |
| ------------- | ------------------------------ | ---------------------- |
| `validateKey` | `() => Promise<KeyValidation>` | Validate the admin key |
| `health`      | `() => Promise<HealthResult>`  | Check service health   |
| `close`       | `() => Promise<void>`          | Clear singleton        |

---

## Key Types

```typescript
// ── Config ──

type ContextSurfacesConfig = {
  adminApiUrl?: string; // default: DEFAULT_ADMIN_API_URL
  mcpUrl?: string; // default: DEFAULT_MCP_URL
  adminKey?: string; // from env or explicit
  agentKey?: string; // from env or explicit
  timeout?: number; // default: DEFAULT_TIMEOUT_MS
  retries?: number; // default: DEFAULT_MAX_RETRIES
};

// ── Data Model ──

type DataModel = {
  title: string;
  description: string;
  entities: EntityDescription[];
  entityCount?: number;
};

type EntityDescription = {
  name: string;
  description: string;
  redisKeyTemplate?: string;
  fields?: FieldDescription[];
  relationships?: RelationshipDescription[];
};

type FieldDescription = {
  name: string;
  type: string;
  description: string;
  mutable?: boolean;
  isKeyComponent?: boolean;
  redisIndices?: RedisIndexConfig[];
};

type RedisIndexConfig = {
  type: IndexType;
  weight?: number;
  noStem?: boolean;
  sortable?: boolean;
  vectorDim?: number;
  distanceMetric?: DistanceMetric;
};

type RelationshipDescription = {
  name: string;
  target: string;
  description: string;
  sourceField: string;
};

// ── Surfaces ──

type CreateSurfaceInput = {
  name: string;
  description?: string;
  dataModel?: DataModel;
  dataSource?: DataSourceConfig;
  metadata?: Record<string, string>;
};

type DataSourceConfig = {
  type: "redis";
  name: string;
  connectionConfig: RedisConnectionConfig;
};

type RedisConnectionConfig = {
  addr: string;
  username?: string;
  password?: string;
  db?: number;
  tlsEnabled?: boolean;
  poolSize?: number;
  minIdleConns?: number;
};

type Surface = {
  id: string;
  name: string;
  description?: string;
  owner: string;
  tools?: string[];
  dataModel?: DataModel;
  metadata?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
};

type ListSurfacesResult = {
  surfaces: Surface[];
  pagination?: Pagination;
};

// ── Agent Keys ──

type CreateAgentKeyInput = {
  name: string;
  description?: string;
  expiresAt?: string;
  metadata?: Record<string, string>;
};

type AgentKey = {
  id: string;
  key: string;
  name: string;
  contextSurfaceId: string;
  description?: string;
  metadata?: Record<string, string>;
  createdAt: string;
  expiresAt?: string;
};

type ListAgentKeysResult = {
  agentKeys: AgentKey[];
  pagination?: Pagination;
};

// ── MCP ──

type McpTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

type McpToolResult = {
  content?: Array<{ type: string; text?: string }>;
  isError?: boolean;
};

type McpInitResult = {
  protocolVersion: string;
  capabilities: Record<string, unknown>;
  serverInfo: { name: string; version: string };
};

// ── Data Loading ──

type LoadRecordsInput = {
  entity: string;
  records: Record<string, unknown>[];
  options?: {
    onConflict?: OnConflict;
    onError?: OnError;
  };
};

type LoadRecordsResult = {
  loaded: number;
  errors?: Array<{ index: number; message: string }>;
};

// ── Pagination ──

type Pagination = {
  page?: number;
  pageSize?: number;
  totalCount?: number;
  totalPages?: number;
  hasNext?: boolean;
  hasPrev?: boolean;
};

type ListOptions = {
  page?: number;
  pageSize?: number;
};
```

---

## Constants

```typescript
const DEFAULT_ADMIN_API_URL = "https://cloud.redis.io/context-surfaces";
const DEFAULT_MCP_URL = "https://gcp-us-east4.context-surfaces.redis.io/mcp";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 3;
const JSONRPC_VERSION = "2.0";
const MCP_PROTOCOL_VERSION = "2024-11-05";
const MCP_CLIENT_NAME = "cau-context-surfaces";
const MCP_CLIENT_VERSION = "0.1.0";

const IndexType = {
  TEXT: "text",
  TAG: "tag",
  NUMERIC: "numeric",
  VECTOR: "vector",
} as const;

const DistanceMetric = {
  COSINE: "cosine",
  EUCLIDEAN: "euclidean",
  INNER_PRODUCT: "inner_product",
} as const;

const OnConflict = {
  OVERWRITE: "overwrite",
  SKIP: "skip",
  ERROR: "error",
} as const;

const OnError = {
  ABORT: "abort",
  SKIP: "skip",
} as const;

const McpMethod = {
  INITIALIZE: "initialize",
  TOOLS_LIST: "tools/list",
  TOOLS_CALL: "tools/call",
} as const;
```

---

## Config (Environment Variables)

| Variable            | Config Key                            | Default                                              | Required            |
| ------------------- | ------------------------------------- | ---------------------------------------------------- | ------------------- |
| `CTX_ADMIN_API_URL` | `adminApiUrl`                         | `https://cloud.redis.io/context-surfaces`            | No                  |
| `CTX_MCP_URL`       | `mcpUrl`                              | `https://gcp-us-east4.context-surfaces.redis.io/mcp` | No                  |
| `CTX_ADMIN_KEY`     | `adminKey`                            | --                                                   | Yes (for admin ops) |
| `MCP_AGENT_KEY`     | `agentKey`                            | --                                                   | Yes (for MCP ops)   |
| `CTX_SURFACE_ID`    | (not in config -- stored by consumer) | --                                                   | No                  |

Config merges explicit constructor values over env values over defaults.

---

## Internal Helpers

### `operations/mcp/json-rpc.util.ts`

Builds JSON-RPC 2.0 request bodies and parses responses. Pure functions, no side effects. Co-located with `operations/mcp/` so the entire MCP folder can be deleted when the SDK adds MCP support.

| Function               | Signature                                                                           | Description                        |
| ---------------------- | ----------------------------------------------------------------------------------- | ---------------------------------- |
| `buildJsonRpcRequest`  | `(method: string, params?: Record<string, unknown>, id?: number) => JsonRpcRequest` | Builds a request body              |
| `parseJsonRpcResponse` | `(body: unknown) => JsonRpcResult`                                                  | Extracts result or throws on error |

No separate HTTP client helper is needed -- the vendored SDK's `CloudContextSurfaceClient` handles REST API calls (with `ky` retries, Zod validation, error mapping). MCP operations use Node 18+ `fetch` directly since they go to a different server (MCP URL) with a different protocol (JSON-RPC) and different auth (agent key). The JSON-RPC helper lives inside `operations/mcp/` rather than a top-level `helpers/` folder so everything MCP-related is self-contained and deletable as a unit.

---

## Dependencies

```json
{
  "dependencies": {
    "@cloud-context-engine/client": "*",
    "dotenv": "^16.4.5"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.8.3",
    "vitest": "^4.0.18"
  }
}
```

`"@cloud-context-engine/client": "*"` resolves to the vendored `packages/context-surfaces-ts-sdk/` via npm workspaces. The SDK brings `ky` and `zod` transitively. MCP operations use Node 18+ built-in `fetch` (no additional HTTP dependency needed for JSON-RPC calls). When the SDK is published to npm, swap `"*"` for a pinned version and remove the vendored folder.

---

## Operations Breakdown

### SDK-delegated operations (no custom code needed)

These are handled entirely by the vendored `CloudContextSurfaceClient`. The `ContextSurfaces` class holds a private `#sdkClient` instance and delegates directly:

| Our Method                          | SDK Method                                   | Notes                                            |
| ----------------------------------- | -------------------------------------------- | ------------------------------------------------ |
| `createSurface(input)`              | `sdkClient.createContextSurface(data)`       | Pass-through with camelCase → snake_case mapping |
| `getSurface(id)`                    | `sdkClient.getContextSurface(id)`            | Direct delegation                                |
| `listSurfaces(options)`             | `sdkClient.listContextSurfaces(params)`      | Direct delegation                                |
| `updateSurface(id, input)`          | `sdkClient.updateContextSurface(id, data)`   | Direct delegation                                |
| `deleteSurface(id)`                 | `sdkClient.deleteContextSurface(id)`         | Direct delegation                                |
| `createAgentKey(surfaceId, input)`  | `sdkClient.createAgentKey(surfaceId, data)`  | Direct delegation                                |
| `listAgentKeys(surfaceId, options)` | `sdkClient.listAgentKeys(surfaceId, params)` | Direct delegation                                |
| `validateKey()`                     | `sdkClient.validateAdminKey()`               | Direct delegation                                |
| `health()`                          | `sdkClient.getHealth()`                      | Direct delegation                                |

### `operations/mcp/index.ts` (NEW -- adds missing capability)

- `initializeMcp` sends the protocol handshake (`initialize` method with client info)
- `listTools` returns parsed `McpTool[]` from the JSON-RPC response
- `callTool` sends `tools/call` with name + arguments, returns the content array
- All methods use the **agent key** for auth (different from SDK's admin key)
- All methods POST to the **MCP URL** (separate server from the admin API)
- Uses co-located `json-rpc.util.ts` for request building and response parsing
- Uses Node `fetch` directly (not the SDK's `ky` client, since it's a different base URL and auth)

### `operations/data-loader/index.ts` (NEW -- adds missing capability)

- `loadRecords` pushes entity name + records array to `POST /api/v1/context-surfaces/{id}/data`
- The surface server writes these records into the connected Redis instance and indexes them according to the data model
- Supports `onConflict` (overwrite/skip/error) and `onError` (abort/skip) options
- Uses the **admin key** for auth
- Uses the SDK's base URL but calls the endpoint directly via `fetch` (since SDK doesn't expose this method yet)
- When the SDK adds a `loadRecords`/`importData` method, this can be refactored to delegate like the other operations

---

## Testing Strategy

All tests follow the `js-testing` skill: **zero mocking, real execution, co-located files, explicit assertions**. No stubs, spies, or in-memory fakes.

Two categories of tests:

1. **Pure function tests** (no network) -- `operations/mcp/json-rpc.util.test.ts`
2. **Integration tests** (real network calls) -- everything else, runs against a real Context Surfaces deployment

SDK-delegated operations (surface CRUD, agent keys) are tested by the vendored SDK's own test suite -- we don't re-test them.

### Test Environment

Tests use the root `.env` file (which already has `CTX_ADMIN_KEY`, `CTX_ADMIN_API_URL`, `CTX_MCP_URL`). No separate `test.env` needed -- vitest setup loads `dotenv` pointing at the repo root `.env`, same as running the demo itself.

Vitest config: `fileParallelism: false`, `sequence: { concurrent: false }`, `testTimeout: 60000` (network-dependent tests need generous timeouts, same as `cau-ram`).

---

### `operations/mcp/json-rpc.util.test.ts` -- Pure Function Tests (no network)

```
describe("buildJsonRpcRequest")
  - should build a request with method, params, and auto-incremented id
  - should build a request with empty params when none provided
  - should use the explicit id when provided
  - should always include jsonrpc version "2.0"

describe("parseJsonRpcResponse")
  - should extract result from a successful response
  - should throw when response contains a JSON-RPC error object
  - should throw with error code and message from the error object
  - should throw when response body is null or undefined
  - should throw when response body has no result and no error
  - should handle result that is an empty object
  - should handle result that contains nested objects and arrays
```

---

### `operations/mcp/index.test.ts` -- Integration Tests (real MCP server)

Requires: a surface with data already loaded, and a valid agent key.

Setup: `beforeAll` creates a surface, loads sample records, and mints an agent key using the SDK client directly. `afterAll` deletes the surface.

```
describe("initializeMcp")
  - should return protocol version, server info, and capabilities
  - should return serverInfo with a name and version string
  - should throw when agent key is missing or invalid

describe("listTools")
  - should return an array of tools with name, description, and inputSchema
  - should return at least one tool for a surface with indexed entities
  - should include expected tool name patterns (search_*, filter_*, get_*)
  - each tool inputSchema should have type "object" and a properties key
  - should throw when agent key is invalid

describe("callTool")
  - should return a result with content array when calling a valid tool
  - should return matching records when calling a search tool with a known query
  - should return a single record when calling a get-by-id tool with a known id
  - should return empty results when calling a search tool with a non-matching query
  - should throw when calling a tool name that does not exist
  - should throw when required arguments are missing
  - should throw when agent key is invalid
```

---

### `operations/data-loader/index.test.ts` -- Integration Tests (real API)

Requires: a surface already created. Uses admin key auth.

Setup: `beforeAll` creates a test surface with a simple entity schema (e.g., one entity with text + tag fields). `afterAll` deletes the surface.

```
describe("loadRecords")
  - should load a batch of records and return the loaded count
  - should load with onConflict "overwrite" without error
  - should load with onConflict "skip" and not overwrite existing records
  - should return errors array when a record has invalid fields
  - should load records for different entities in separate calls
  - should throw when surface id does not exist
  - should throw when admin key is invalid
  - should throw when entity name does not match the data model
```

---

### `context-surfaces.test.ts` -- Singleton + End-to-End Tests

```
describe("ContextSurfaces singleton")
  - should throw when getInstance is called before create
  - should return the instance after create is called
  - should return the same instance on subsequent getInstance calls
  - should accept config from explicit values
  - should fall back to environment variables when explicit values are omitted
  - should allow close to clear the singleton
  - should throw on getInstance after close

describe("ContextSurfaces end-to-end flow")
  -- This is a sequential test that exercises the full lifecycle:

  - should create a surface with a data model and data source
    → assert surface has id, name, tools array
  - should create an agent key for the surface
    → assert agentKey has key and contextSurfaceId matching the surface
  - should set the agent key via setAgentKey
  - should load records into the surface
    → assert loadResult.loaded equals the number of records sent
  - should list tools via MCP after data is loaded
    → assert tools array is non-empty and contains expected tool names
  - should call a search tool and get results
    → assert result.content is an array with at least one entry
  - should call a get-by-id tool and get the specific record
    → assert the returned record matches the loaded data
  - should delete the surface (cleanup)
    → assert no error, subsequent getSurface throws NotFoundError

describe("setAgentKey")
  - should update the agent key used for MCP calls
  - should throw on listTools when agent key has not been set
```

---

### Test Data

Tests use a minimal entity schema designed for testability:

```typescript
const TEST_DATA_MODEL = {
  title: "Test Surface",
  description: "Integration test surface",
  entities: [
    {
      name: "TestItem",
      description: "Simple test entity",
      redisKeyTemplate: "test_item:{item_id}",
      fields: [
        {
          name: "item_id",
          type: "str",
          description: "Unique ID",
          isKeyComponent: true,
        },
        {
          name: "title",
          type: "str",
          description: "Item title",
          redisIndices: [{ type: "text" }],
        },
        {
          name: "category",
          type: "str",
          description: "Category",
          redisIndices: [{ type: "tag" }],
        },
        {
          name: "score",
          type: "float",
          description: "Score",
          redisIndices: [{ type: "numeric", sortable: true }],
        },
      ],
    },
  ],
};

const TEST_RECORDS = [
  {
    item_id: "item-001",
    title: "Redis Vector Search Guide",
    category: "database",
    score: 9.5,
  },
  {
    item_id: "item-002",
    title: "LangGraph Agent Tutorial",
    category: "ai",
    score: 8.7,
  },
  {
    item_id: "item-003",
    title: "Context Surfaces Overview",
    category: "database",
    score: 9.1,
  },
];
```

### Test Timing

Integration tests may need delays between surface creation and MCP tool availability (index building is async). Use polling with timeout rather than fixed `sleep` -- poll `listTools()` until it returns a non-empty array or a 30-second timeout is reached.

---

## Runnable Example (`examples/usage-example.ts`)

A single runnable file that demonstrates the complete lifecycle end-to-end. Run with `npx tsx examples/usage-example.ts` (requires env vars set). This serves as both documentation and a smoke test.

### What it covers (in order)

```
1. Initialize       → ContextSurfaces.create() with env config
2. Define schema    → Build a DataModel with 5 entities (Client, Holding, FinancialGoal, Meeting, ActionItem)
3. Create surface   → cs.createSurface() with data model + Redis connection
4. Create agent key → cs.createAgentKey() + cs.setAgentKey()
5. Load records     → cs.loadRecords() for each entity (1 client, 6 holdings, 4 goals, 5 meetings, 5 action items)
6. Wait for index   → Poll cs.listTools() until tools appear
7. List tools       → Print all auto-generated tool names
8. Search by text   → cs.callTool("search_client_by_text", { query: "Morrison" })
9. Filter by tag    → cs.callTool("filter_holding_by_asset_class", { asset_class: "equities" })
10. Get by ID       → cs.callTool("get_client_by_client_id", { client_id: "james-morrison" })
11. Filter meetings → cs.callTool("filter_meeting_by_sentiment", { sentiment: "anxious" })
12. Search actions  → cs.callTool("filter_action_item_by_status", { status: "pending" })
13. Cross-entity    → Get client → filter holdings → filter goals → filter pending action items
14. Cleanup         → cs.deleteSurface() to tear down
```

### Entity schema used in the example

5 entities covering the full wealth-advisor relationship: client profile, portfolio, goals, meeting history, and action items.

```typescript
const CLIENT_ENTITY = {
  name: "Client",
  description: "Wealth management client profile",
  redisKeyTemplate: "wa_client:{client_id}",
  fields: [
    {
      name: "client_id",
      type: "str",
      description: "Unique client identifier",
      isKeyComponent: true,
    },
    {
      name: "name",
      type: "str",
      description: "Full name",
      redisIndices: [{ type: "text", weight: 2.0 }],
    },
    {
      name: "age",
      type: "int",
      description: "Age in years",
      redisIndices: [{ type: "numeric", sortable: true }],
    },
    {
      name: "organization",
      type: "str",
      description: "Employer or company",
      redisIndices: [{ type: "tag" }],
    },
    {
      name: "risk_profile",
      type: "str",
      description: "Investment risk tolerance level",
      redisIndices: [{ type: "tag" }],
    },
    {
      name: "total_aum",
      type: "float",
      description: "Total assets under management in USD",
      redisIndices: [{ type: "numeric", sortable: true }],
    },
  ],
  relationships: [
    {
      name: "holdings",
      target: "Holding",
      description: "Portfolio holdings",
      sourceField: "client_id",
    },
    {
      name: "goals",
      target: "FinancialGoal",
      description: "Financial goals",
      sourceField: "client_id",
    },
    {
      name: "meetings",
      target: "Meeting",
      description: "Meeting history",
      sourceField: "client_id",
    },
    {
      name: "action_items",
      target: "ActionItem",
      description: "Action items",
      sourceField: "client_id",
    },
  ],
};

const HOLDING_ENTITY = {
  name: "Holding",
  description: "Portfolio position in an asset class",
  redisKeyTemplate: "wa_holding:{holding_id}",
  fields: [
    {
      name: "holding_id",
      type: "str",
      description: "Unique holding identifier",
      isKeyComponent: true,
    },
    {
      name: "client_id",
      type: "str",
      description: "Owner client ID",
      redisIndices: [{ type: "tag" }],
    },
    {
      name: "asset_class",
      type: "str",
      description: "Asset class category",
      redisIndices: [{ type: "tag" }],
    },
    {
      name: "allocation_percent",
      type: "float",
      description: "Portfolio allocation percentage",
      redisIndices: [{ type: "numeric", sortable: true }],
    },
    {
      name: "current_value",
      type: "float",
      description: "Current market value in USD",
      redisIndices: [{ type: "numeric", sortable: true }],
    },
  ],
};

const FINANCIAL_GOAL_ENTITY = {
  name: "FinancialGoal",
  description: "Client financial planning goal",
  redisKeyTemplate: "wa_goal:{goal_id}",
  fields: [
    {
      name: "goal_id",
      type: "str",
      description: "Unique goal identifier",
      isKeyComponent: true,
    },
    {
      name: "client_id",
      type: "str",
      description: "Owner client ID",
      redisIndices: [{ type: "tag" }],
    },
    {
      name: "type",
      type: "str",
      description: "Goal category",
      redisIndices: [{ type: "tag" }],
    },
    {
      name: "target_amount",
      type: "float",
      description: "Target dollar amount",
      redisIndices: [{ type: "numeric", sortable: true }],
    },
    {
      name: "target_year",
      type: "int",
      description: "Target completion year",
      redisIndices: [{ type: "numeric", sortable: true }],
    },
    {
      name: "status",
      type: "str",
      description: "Current goal status",
      redisIndices: [{ type: "tag" }],
    },
    {
      name: "description",
      type: "str",
      description: "Goal details and context",
      redisIndices: [{ type: "text" }],
    },
  ],
};

const MEETING_ENTITY = {
  name: "Meeting",
  description: "Record of a client-advisor meeting",
  redisKeyTemplate: "wa_meeting:{meeting_id}",
  fields: [
    {
      name: "meeting_id",
      type: "str",
      description: "Unique meeting identifier",
      isKeyComponent: true,
    },
    {
      name: "client_id",
      type: "str",
      description: "Client who attended",
      redisIndices: [{ type: "tag" }],
    },
    {
      name: "date",
      type: "str",
      description: "Meeting date (YYYY-MM-DD)",
      redisIndices: [{ type: "tag" }],
    },
    {
      name: "type",
      type: "str",
      description: "Meeting format",
      redisIndices: [{ type: "tag" }],
    },
    {
      name: "duration_minutes",
      type: "int",
      description: "Duration in minutes",
      redisIndices: [{ type: "numeric", sortable: true }],
    },
    {
      name: "sentiment",
      type: "str",
      description: "Overall client sentiment",
      redisIndices: [{ type: "tag" }],
    },
    {
      name: "summary",
      type: "str",
      description: "Meeting summary",
      redisIndices: [{ type: "text" }],
    },
    {
      name: "key_decisions",
      type: "str",
      description: "Decisions made during meeting",
      redisIndices: [{ type: "text" }],
    },
  ],
  relationships: [
    {
      name: "action_items",
      target: "ActionItem",
      description: "Action items from this meeting",
      sourceField: "meeting_id",
    },
  ],
};

const ACTION_ITEM_ENTITY = {
  name: "ActionItem",
  description: "Follow-up task from a meeting",
  redisKeyTemplate: "wa_action:{action_id}",
  fields: [
    {
      name: "action_id",
      type: "str",
      description: "Unique action item identifier",
      isKeyComponent: true,
    },
    {
      name: "meeting_id",
      type: "str",
      description: "Source meeting ID",
      redisIndices: [{ type: "tag" }],
    },
    {
      name: "client_id",
      type: "str",
      description: "Related client ID",
      redisIndices: [{ type: "tag" }],
    },
    {
      name: "assignee",
      type: "str",
      description: "Person responsible",
      redisIndices: [{ type: "tag" }],
    },
    {
      name: "description",
      type: "str",
      description: "Action item details",
      redisIndices: [{ type: "text" }],
    },
    {
      name: "status",
      type: "str",
      description: "Current status",
      redisIndices: [{ type: "tag" }],
    },
    {
      name: "due_date",
      type: "str",
      description: "Due date (YYYY-MM-DD)",
      redisIndices: [{ type: "tag" }],
    },
  ],
};
```

### Sample data used in the example

Structured data authored to reflect the facts established across the 5 wealth-advisor transcripts. This is **not** extracted from the transcripts -- it's hand-authored structured data that represents the current state of the client relationship as of the latest meeting (2026-02-26).

```typescript
const CLIENT_RECORDS = [
  {
    client_id: "james-morrison",
    name: "James Morrison",
    age: 52,
    organization: "Meridian Technologies",
    risk_profile: "moderate",
    total_aum: 2400000,
  },
];

const HOLDING_RECORDS = [
  // Post-rebalance state (Feb 2026): REITs reduced from 15% to ~9%, shifted to bonds + dividend ETF
  {
    holding_id: "h-001",
    client_id: "james-morrison",
    asset_class: "equities",
    allocation_percent: 45,
    current_value: 1080000,
  },
  {
    holding_id: "h-002",
    client_id: "james-morrison",
    asset_class: "fixed-income",
    allocation_percent: 30,
    current_value: 720000,
  },
  {
    holding_id: "h-003",
    client_id: "james-morrison",
    asset_class: "reits",
    allocation_percent: 9,
    current_value: 210000,
  },
  {
    holding_id: "h-004",
    client_id: "james-morrison",
    asset_class: "cash",
    allocation_percent: 10,
    current_value: 240000,
  },
  {
    holding_id: "h-005",
    client_id: "james-morrison",
    asset_class: "short-duration-bonds",
    allocation_percent: 4,
    current_value: 100000,
  },
  {
    holding_id: "h-006",
    client_id: "james-morrison",
    asset_class: "dividend-etf",
    allocation_percent: 2,
    current_value: 50000,
  },
];

const GOAL_RECORDS = [
  {
    goal_id: "g-001",
    client_id: "james-morrison",
    type: "retirement",
    target_amount: 3000000,
    target_year: 2031,
    status: "active",
    description:
      "Retire at 57 with $3M liquid, moderate risk tolerance, $50-75K annual contributions",
  },
  {
    goal_id: "g-002",
    client_id: "james-morrison",
    type: "education",
    target_amount: 200000,
    target_year: 2029,
    status: "planning",
    description:
      "529 plan for daughter Emily, college in ~3 years, needs session with spouse Maya",
  },
  {
    goal_id: "g-003",
    client_id: "james-morrison",
    type: "tax-optimization",
    target_amount: 40000,
    target_year: 2025,
    status: "completed",
    description:
      "Year-end tax loss harvesting from underperforming REIT and international positions",
  },
  {
    goal_id: "g-004",
    client_id: "james-morrison",
    type: "retirement",
    target_amount: 0,
    target_year: 2027,
    status: "planning",
    description:
      "Model dual-retirement scenario -- spouse Maya considering early retirement in 2027",
  },
];

const MEETING_RECORDS = [
  {
    meeting_id: "meeting-001",
    client_id: "james-morrison",
    date: "2025-09-14",
    type: "phone",
    duration_minutes: 28,
    sentiment: "positive",
    summary:
      "Initial introduction call. Reviewed $2.4M portfolio, set $3M retirement target by 2031, agreed quarterly cadence",
    key_decisions:
      "Set retirement target at $3M liquid by 2031; agreed on quarterly review cadence",
  },
  {
    meeting_id: "meeting-002",
    client_id: "james-morrison",
    date: "2025-10-28",
    type: "phone",
    duration_minutes: 8,
    sentiment: "anxious",
    summary:
      "Unscheduled call during market correction. Client worried about 2% daily drop. Reassured, decided to stay the course",
    key_decisions: "No changes -- stay the course",
  },
  {
    meeting_id: "meeting-003",
    client_id: "james-morrison",
    date: "2025-12-02",
    type: "google-meet",
    duration_minutes: 35,
    sentiment: "neutral-positive",
    summary:
      "Year-end review. Agreed to harvest $40K in tax losses. Started 529 plan research for daughter Emily",
    key_decisions:
      "Harvest $40K in tax losses; start 529 plan research for Emily",
  },
  {
    meeting_id: "meeting-004",
    client_id: "james-morrison",
    date: "2026-01-15",
    type: "phone",
    duration_minutes: 18,
    sentiment: "anxious",
    summary:
      "Client concerned about REIT exposure after commercial property default news. Sarah to prepare rebalancing proposal",
    key_decisions:
      "Sarah to research REIT alternatives; 529 deferred until Maya available",
  },
  {
    meeting_id: "meeting-005",
    client_id: "james-morrison",
    date: "2026-02-26",
    type: "google-meet",
    duration_minutes: 22,
    sentiment: "positive",
    summary:
      "Executed REIT rebalance: $150K from REITs split to $100K short-duration bonds + $50K dividend ETF. Maya may retire 2027",
    key_decisions:
      "Rebalance $150K from REITs; James prefers bond fund over individual bonds; model dual-retirement scenario",
  },
];

const ACTION_ITEM_RECORDS = [
  {
    action_id: "a-001",
    meeting_id: "meeting-005",
    client_id: "james-morrison",
    assignee: "sarah-chen",
    description:
      "Execute REIT to bond/ETF rebalance ($100K short-duration bonds, $50K dividend aristocrats ETF)",
    status: "completed",
    due_date: "2026-03-07",
  },
  {
    action_id: "a-002",
    meeting_id: "meeting-005",
    client_id: "james-morrison",
    assignee: "sarah-chen",
    description:
      "Model dual-retirement income scenario with Maya retiring in 2027",
    status: "pending",
    due_date: "2026-03-15",
  },
  {
    action_id: "a-003",
    meeting_id: "meeting-005",
    client_id: "james-morrison",
    assignee: "sarah-chen",
    description: "Schedule dedicated education fund session with Maya present",
    status: "pending",
    due_date: "2026-03-31",
  },
  {
    action_id: "a-004",
    meeting_id: "meeting-003",
    client_id: "james-morrison",
    assignee: "sarah-chen",
    description: "Prepare 529 plan comparison report",
    status: "pending",
    due_date: "2026-02-01",
  },
  {
    action_id: "a-005",
    meeting_id: "meeting-001",
    client_id: "james-morrison",
    assignee: "sarah-chen",
    description: "Prepare detailed asset allocation proposal",
    status: "completed",
    due_date: "2025-10-15",
  },
];
```

### Expected output

The example prints step-by-step output so the user can follow the flow:

```
[1/14] Initializing ContextSurfaces client...
[2/14] Defining data model: 5 entities (Client, Holding, FinancialGoal, Meeting, ActionItem)
[3/14] Creating surface "Wealth Advisor Demo"...
       Surface created: id=cs_abc123
[4/14] Creating agent key...
       Agent key created: agt_xyz789
[5/14] Loading records into surface...
       Client: 1 record loaded
       Holding: 6 records loaded
       FinancialGoal: 4 records loaded
       Meeting: 5 records loaded
       ActionItem: 5 records loaded
[6/14] Waiting for MCP tools to become available...
       Tools ready (22 tools available)
[7/14] Available tools:
       - search_client_by_text
       - get_client_by_client_id
       - filter_holding_by_client_id
       - filter_holding_by_asset_class
       - filter_financial_goal_by_type
       - filter_financial_goal_by_status
       - search_meeting_by_text
       - filter_meeting_by_sentiment
       - filter_meeting_by_type
       - filter_action_item_by_status
       - filter_action_item_by_assignee
       - search_action_item_by_text
       - ...
[8/14] Search: "Morrison" → 1 result
       James Morrison | age 52 | Meridian Technologies | moderate risk | $2.4M AUM
[9/14] Filter holdings by asset_class="equities" → 1 result
       h-001 | equities | 45% | $1,080,000
[10/14] Get client by ID "james-morrison" → direct lookup
       James Morrison | age 52 | moderate risk | $2,400,000 AUM
[11/14] Filter meetings by sentiment="anxious" → 2 results
       meeting-002 | 2025-10-28 | Market correction panic call
       meeting-004 | 2026-01-15 | REIT exposure concern
[12/14] Filter action items by status="pending" → 3 results
       a-002 | Model dual-retirement scenario | due 2026-03-15
       a-003 | Schedule education fund session with Maya | due 2026-03-31
       a-004 | Prepare 529 plan comparison report | due 2026-02-01
[13/14] Cross-entity: james-morrison → 6 holdings, 4 goals, 3 pending actions
[14/14] Cleanup: deleting surface cs_abc123...
       Done.
```

### Why a single file

- **Self-contained** -- copy this file into any project, set env vars, run it
- **Documents the real API** -- no stale snippets, the example either runs or it doesn't
- **Doubles as a smoke test** -- CI can run it against a test deployment to verify the package works end-to-end
- **Uses realistic data from the demo context** -- client profile, portfolio, goals, meetings, and action items are all authored to match the James Morrison / Sarah Chen wealth-advisor story from the 5 transcripts, so the example data can later be reused in the actual demo integration (see `context-surfaces-integration.md`)

---

## Comparison with cau-ram

| Aspect          | cau-ram                                                  | cau-context-surfaces                                                        |
| --------------- | -------------------------------------------------------- | --------------------------------------------------------------------------- |
| SDK source      | `@redis-iris/agent-memory` (npm)                         | `@cloud-context-engine/client` (vendored, npm TBD)                          |
| Wraps           | SDK + adds intelligence (token budgeting, summarization) | SDK + adds MCP client + record loading                                      |
| Pattern         | Singleton + factory                                      | Singleton + factory                                                         |
| Auth            | Single API key                                           | Dual: admin key (REST via SDK) + agent key (MCP via fetch)                  |
| Data flow       | Session events → auto LTM extraction                     | Explicit schema definition → load records into Redis → auto tool generation |
| Query interface | `searchLongTermMemory`, `buildMemoryPrompt`              | `listTools`, `callTool` (MCP JSON-RPC)                                      |
| Intelligence    | Token budgeting, summarization, context assembly         | None (raw tool results)                                                     |
| Data shape      | Semi-structured (text + metadata)                        | Fully structured (typed entities with indexed fields)                       |

---

## Implementation Order

| Phase                 | Deliverables                                                                                                                                               | Effort |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| **1. Vendor SDK**     | Copy `cce/typescript-client/` → `packages/context-surfaces-ts-sdk/`, add to root workspaces, verify `npm install && npm run build` works                   | Low    |
| **2. Foundation**     | `cau-context-surfaces/` scaffolding: `config.ts`, `constants.ts`, `types.ts`, `package.json` (with `"@cloud-context-engine/client": "*"`), `tsconfig.json` | Low    |
| **3. MCP operations** | `operations/mcp/` -- `json-rpc.util.ts` (pure helper), `initializeMcp`, `listTools`, `callTool` + all tests                                                | Low    |
| **4. Data loader**    | `operations/data-loader/` -- `loadRecords` (simple REST call)                                                                                              | Low    |
| **5. Main class**     | `context-surfaces.ts` -- singleton, SDK delegation, MCP wiring, dual-auth, config merging                                                                  | Low    |
| **6. Tests**          | Integration tests against real endpoint                                                                                                                    | Medium |
| **7. Usage example**  | `examples/usage-example.ts` -- full lifecycle runnable file                                                                                                | Low    |
| **8. Docs**           | `README.md`, `SKILL.md`, update `PACKAGE_INDEX.md`, update root `build:packages` script                                                                    | Low    |

Total estimated effort: **1-2 days** for a senior dev. Most of the work is in phase 3 (the MCP layer). Phases 1-2, 4-5 are mostly boilerplate/delegation.

### Workspace Registration

After creating both packages, update the root `package.json`:

```diff
  "build:packages": "npm run build
    -w packages/cau-logger
    -w packages/cau-redis
    -w packages/cau-api-server
    -w packages/agent-memory-ts-sdk
    -w packages/cau-ram
+   -w packages/context-surfaces-ts-sdk
+   -w packages/cau-context-surfaces"
```

Both packages are auto-discovered by the `"workspaces": ["packages/*"]` glob, but the `build:packages` script needs explicit ordering (vendored SDK before wrapper, since the wrapper depends on it).

---

## Open Questions (for manager discussion)

(None remaining -- all resolved below.)

## Resolved Decisions (from open questions)

1. **Data model authoring** -- JSON is sufficient. No need to build a TypeScript equivalent of Python's `ContextModel`/`ContextField` class hierarchy unless the SDK adds one. Consumers define their data model as a plain `DataModel` JSON object and pass it to `createSurface()`.

2. **Surface ID + Agent Key lifecycle** -- both are **one-time setup** artifacts:
   - **Surface ID**: created once via `createSurface()`, persists until explicitly deleted. Reusable across runs.
   - **Agent Key**: created once via `createAgentKey()`, tied to a specific surface. Has an **optional** `expiresAt` -- if omitted, the key is permanent (no expiry). Reusable forever for that surface.
   - **For this package**: methods return the values -- the package never writes to `.env` or any file. The consumer decides how to persist:
     - **During Demo integration**: a setup script calls `createSurface()` + `createAgentKey()`, saves the returned IDs to `.env`, and subsequent runs read from `.env`.
     - **Usage example**: creates surface + agent key, stores them in local variables, uses them for the full flow, then deletes the surface at the end. Fully self-contained, no file I/O.

3. **Generic package, no hardcoded entities** -- confirmed. All entity schemas, sample data, and demo-specific logic live in the consuming app, not in `cau-context-surfaces`. The package is a generic Context Surfaces client that accepts any `DataModel` and any records.

## Resolved Decisions

1. **Vendor the SDK** -- confirmed. Copy `cce/typescript-client/` into `packages/context-surfaces-ts-sdk/` and reference via workspace resolution (`"@cloud-context-engine/client": "*"`). When the SDK is published to npm (like `@redis-iris/agent-memory` was for agent memory), swap the dependency and remove the vendored folder.

---

## Vendored SDK Issues (to report to SDK team)

Issues found in `@cloud-context-engine/client` while building `cau-context-surfaces`. These should be reported upstream so the SDK team can address them in future releases.

### 1. `createContextSurface` does not accept `data_model` or `data_source`

**Severity**: High -- blocks primary use case

The SDK's `createContextSurface` method only supports creating a surface linked to a pre-existing `redis_instance_id` (a separate resource). It does not accept `data_model` or `data_source.connection_config` in the request body.

However, the REST API endpoint (`POST /api/v1/context-surfaces`) **does** accept both fields -- the Python SDK and the Python demo use this embedded approach to create a surface with a data model and an inline Redis connection in a single call.

**Workaround**: `cau-context-surfaces` calls the API directly via `fetch` for `createSurface`, bypassing the SDK. All other methods delegate to the SDK normally.

**Fix**: Add optional `data_model` and `data_source` parameters to `createContextSurface` in the SDK client.

### 2. `ContextSurfaceSchema` missing `status` and `status_reason` fields

**Severity**: Medium -- breaks lifecycle polling

The Zod schema `ContextSurfaceSchema` does not include `status` or `status_reason` fields. The API returns these fields on every surface response (values like `provisioning`, `provisioning_indices`, `active`, `failed`, `indices_failed`, `deleting`).

Because Zod's default `.parse()` strips unknown keys, consumers cannot read the surface's provisioning status after creation, making it impossible to poll for readiness before loading data.

**Workaround**: Added `status: z.string().optional().nullable()` and `status_reason: z.string().optional().nullable()` to the vendored schema.

**Fix**: Add both fields to `ContextSurfaceSchema` in the SDK.

### 3. Several Zod schemas reject `null` for optional array/object fields

**Severity**: Medium -- causes runtime `ZodError` on `getSurface`

The API returns `null` (not `undefined`) for optional fields like `redis_indices`, `relationships`, `entities`, `tools`, `data_model`, `metadata`, `redis_key_template`, and `entity_count`. The SDK schemas use `.optional()` which accepts `undefined` but rejects `null`, causing `ZodError` at runtime.

**Workaround**: Added `.nullable()` to all affected fields in the vendored `schemas.ts`.

**Fix**: Change `.optional()` to `.optional().nullable()` (or `.nullish()`) for all fields that the API may return as `null`.

### 4. SDK does not expose MCP operations or data loading

**Severity**: Info -- known gap, not a bug

The SDK only wraps admin REST endpoints (surfaces, agent keys, health). It does not provide methods for:

- MCP tool invocation (`tools/list`, `tools/call` via JSON-RPC)
- Data loading (`POST /api/v1/context-surfaces/{id}/data`)

**Workaround**: `cau-context-surfaces` implements both via direct `fetch` calls in `src/operations/mcp/` and `src/operations/data-loader/`. These are co-located so they can be removed when the SDK adds support.

**Note**: The Python SDK (`context-surfaces`) provides both `import_data` and MCP methods via `UnifiedClient`. Parity in the TypeScript SDK would eliminate the need for these custom implementations.

### 5. No combined multi-field filter

1. NO combined multi-field filter: to find "pending action items for

- james-morrison", the agent calls filter_actionitem_by_client_id AND
- filter_actionitem_by_status separately, then intersects in-context.
