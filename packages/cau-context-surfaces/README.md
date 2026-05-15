# cau-context-surfaces

Typed wrapper for Redis Context Surfaces -- surface CRUD, MCP tool calling, and record loading.

Wraps the `@cloud-context-engine/client` SDK (vendored) and adds custom implementations for MCP JSON-RPC operations and data loading that the SDK doesn't yet provide.

## Install

```bash
npm install  # from monorepo root -- workspace resolution handles linking
```

## Quick Start

```typescript
import { ContextSurfaces } from "cau-context-surfaces";

// Reads CTX_ADMIN_KEY, CTX_MCP_URL, CTX_ADMIN_API_URL from .env
const cs = ContextSurfaces.create();

// Create a surface with a data model
const surface = await cs.createSurface({
  name: "my-surface",
  dataModel: { title: "Demo", description: "...", entities: [...] },
  dataSource: { type: "redis", name: "redis", connectionConfig: { addr: "...", password: "..." } },
});

// Create an agent key and set it for MCP calls
const agentKey = await cs.createAgentKey(surface.id, { name: "my-agent" });
cs.setAgentKey(agentKey.key);

// Load structured records
await cs.loadRecords(surface.id, { entity: "Client", records: [...] });

// Call MCP tools
const tools = await cs.listTools();
const result = await cs.callTool("search_client_by_text", { query: "Morrison" });

// Cleanup
await cs.deleteSurface(surface.id);
await cs.close();
```

## Singleton Pattern

```typescript
// First call creates the instance
ContextSurfaces.create({ adminKey: "...", mcpUrl: "..." });

// Subsequent calls retrieve the same instance
const cs = ContextSurfaces.getInstance();
```

## Full API

### Surface Management (Admin Key)

| Method          | Signature                                                            | Description                                            |
| --------------- | -------------------------------------------------------------------- | ------------------------------------------------------ |
| `createSurface` | `(input: CreateSurfaceInput) => Promise<Surface>`                    | Create a context surface with data model + data source |
| `getSurface`    | `(surfaceId: string) => Promise<Surface>`                            | Get surface details                                    |
| `listSurfaces`  | `(options?: ListOptions) => Promise<ListSurfacesResult>`             | List surfaces with pagination                          |
| `updateSurface` | `(surfaceId: string, input: UpdateSurfaceInput) => Promise<Surface>` | Update surface name/description/metadata               |
| `deleteSurface` | `(surfaceId: string) => Promise<void>`                               | Delete a surface                                       |

### Agent Key Management (Admin Key)

| Method           | Signature                                                                    | Description                            |
| ---------------- | ---------------------------------------------------------------------------- | -------------------------------------- |
| `createAgentKey` | `(surfaceId: string, input: CreateAgentKeyInput) => Promise<AgentKey>`       | Create an agent key for a surface      |
| `listAgentKeys`  | `(surfaceId: string, options?: ListOptions) => Promise<ListAgentKeysResult>` | List agent keys                        |
| `setAgentKey`    | `(agentKey: string) => void`                                                 | Set/update the agent key for MCP calls |

### MCP Tools (Agent Key)

| Method          | Signature                                                                  | Description                                 |
| --------------- | -------------------------------------------------------------------------- | ------------------------------------------- |
| `initializeMcp` | `() => Promise<McpInitResult>`                                             | Initialize MCP session (protocol handshake) |
| `listTools`     | `() => Promise<McpTool[]>`                                                 | List available MCP tools for the surface    |
| `callTool`      | `(name: string, args?: Record<string, unknown>) => Promise<McpToolResult>` | Call an MCP tool by name                    |

### Data Loading (Admin Key)

| Method        | Signature                                                                    | Description                                   |
| ------------- | ---------------------------------------------------------------------------- | --------------------------------------------- |
| `loadRecords` | `(surfaceId: string, input: LoadRecordsInput) => Promise<LoadRecordsResult>` | Push structured entity records into a surface |

### Utility

| Method        | Signature                      | Description            |
| ------------- | ------------------------------ | ---------------------- |
| `validateKey` | `() => Promise<KeyValidation>` | Validate the admin key |
| `health`      | `() => Promise<HealthResult>`  | Check service health   |
| `close`       | `() => Promise<void>`          | Clear singleton        |

## Config

| Env Variable        | Config Key   | Default                                              | Required            |
| ------------------- | ------------ | ---------------------------------------------------- | ------------------- |
| `CTX_ADMIN_API_URL` | `adminApiUrl`| `https://cloud.redis.io/context-surfaces`            | No                  |
| `CTX_MCP_URL`       | `mcpUrl`     | `https://gcp-us-east4.context-surfaces.redis.io/mcp` | No                  |
| `CTX_ADMIN_KEY`     | `adminKey`   | --                                                   | Yes (for admin ops) |
| `MCP_AGENT_KEY`     | `agentKey`   | --                                                   | Yes (for MCP ops)   |

Config resolves: explicit constructor values > env variables > defaults.

## Usage Example

See `examples/usage-example.ts` for a full runnable lifecycle demo (schema definition, surface creation, record loading, MCP tool calls, cleanup).

```bash
npx tsx examples/usage-example.ts
```

## Testing

```bash
# Pure function tests (no network)
npm test -w packages/cau-context-surfaces

# Integration tests require CTX_ADMIN_KEY, CTX_MCP_URL, REDIS_URL in .env
```
