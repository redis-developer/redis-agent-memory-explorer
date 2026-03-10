---
name: cau-redis-agent-memory
description: Typed wrapper for Redis Agent Memory Server (working memory, long-term memory, summary views, memory prompt, lifecycle). Use when the user needs agent memory management via the Redis Agent Memory Server REST API.
metadata:
  author: prasan
  version: "0.1.0"
  repo: git@github.com:PrasanKumar93/custom-agent-utils.git
  path: packages/cau-redis-agent-memory
  dest: packages/cau-redis-agent-memory
---

# cau-redis-agent-memory

Typed singleton wrapper around the `agent-memory-client` SDK for the Redis Agent Memory Server REST API.

For full API reference see [README.md](./README.md).

## When to Use

Vendor this package when the user needs:

- Working memory management (session-scoped conversation state with auto-summarization)
- Long-term memory CRUD with semantic search (episodic, semantic, message types)
- Memory prompt hydration (inject relevant context into LLM prompts)
- Forget policies for memory lifecycle management
- Summary views for aggregated memory insights
- Background task management for async operations

## Vendoring

Sparse checkout + copy. The `--branch` flag accepts a git tag (preferred) or `main`.

```bash
CAU_REF="<git-tag-or-main>"
TMPDIR=$(mktemp -d)
git clone --depth 1 --branch "$CAU_REF" --filter=blob:none --sparse \
  git@github.com:PrasanKumar93/custom-agent-utils.git "$TMPDIR"
cd "$TMPDIR" && git sparse-checkout set packages/cau-redis-agent-memory
cp -r "$TMPDIR/packages/cau-redis-agent-memory" <your-project>/packages/cau-redis-agent-memory
rm -rf "$TMPDIR"
```

### After vendoring

```bash
cd packages/cau-redis-agent-memory
npm install
npm run build
```

### Provenance file

After vendoring, create `packages/cau-redis-agent-memory/.vendor.json`:

```json
{
  "source": "git@github.com:PrasanKumar93/custom-agent-utils.git",
  "package": "packages/cau-redis-agent-memory",
  "tag": "<git-tag-or-main>",
  "vendoredAt": "<ISO-8601 date>",
  "forked": false
}
```

### Updating

Re-run the sparse checkout commands above with the new `CAU_REF`, then:

```bash
cd packages/cau-redis-agent-memory && npm install && npm run build
```

Update `.vendor.json` with the new `tag` and `vendoredAt`.

## Quick usage (vendored path)

```typescript
import { AgentMemory } from "cau-redis-agent-memory";

const mem = AgentMemory.create({ baseUrl: "http://localhost:8000" });

const { memory } = await mem.getOrCreateWorkingMemory("session-1");
await mem.putWorkingMemory("session-1", {
  messages: [{ role: "user", content: "Hello" }],
});

const results = await mem.searchLongTermMemory({ text: "user preferences" });
await mem.close();
```

See [README.md](./README.md) for full API tables, config reference, search filters, summary views, and testing setup.

## Rules

- Do NOT modify vendored code. Extend via adapters or wrappers.
- If you must modify, update `.vendor.json` to mark `"forked": true`.
- Connection strings / secrets must come from environment variables.
