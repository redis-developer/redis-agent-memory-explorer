---
name: cau-context-surfaces
description: Typed wrapper for Redis Context Surfaces (surface CRUD, MCP tool calling, record loading). Use when working with Context Surfaces, structured data tools, or MCP-based AI agent integrations.
metadata:
  author: prasan
  version: "0.1.0"
  path: packages/cau-context-surfaces
  dest: packages/cau-context-surfaces
---

# cau-context-surfaces

Typed wrapper for Redis Context Surfaces -- surface management, MCP tool calling, and structured record loading.

For full API reference see [README.md](./README.md).

## When to Use

Use this package when the consumer needs:

- Surface CRUD (create, get, list, update, delete context surfaces)
- Agent key management (create, list keys for a surface)
- MCP tool interaction (list tools, call tools via JSON-RPC over HTTP)
- Structured data loading (push entity records into a surface)
- A unified client that handles dual auth (admin key for REST, agent key for MCP)

## Dependencies

Requires the vendored `@cloud-context-engine/client` SDK at `packages/context-surfaces-ts-sdk/`. Both packages must be present in the workspace.

## Quick Usage

```typescript
import { ContextSurfaces } from "cau-context-surfaces";

const cs = ContextSurfaces.create();

const surface = await cs.createSurface({
  name: "my-surface",
  dataModel: { title: "Demo", description: "...", entities: [...] },
  dataSource: { type: "redis", name: "redis", connectionConfig: { addr: "...", password: "..." } },
});

const agentKey = await cs.createAgentKey(surface.id, { name: "agent" });
cs.setAgentKey(agentKey.key);

await cs.loadRecords(surface.id, { entity: "Client", records: [...] });

const tools = await cs.listTools();
const result = await cs.callTool(tools[0].name, { query: "Morrison" });

await cs.close();
```

See [README.md](./README.md) for full API, config reference, and testing instructions.

## Rules

- Do NOT modify the vendored SDK at `packages/context-surfaces-ts-sdk/`.
- Connection strings and secrets must come from environment variables.
- The `operations/mcp/` folder contains all MCP-specific code. When the SDK adds MCP support, delete this folder and update `context-surfaces.ts` to delegate.
