---
name: cau-langcache
description: Typed wrapper for Redis LangCache (managed semantic cache) with singleton pattern and a generic search/set/delete/flush interface. Use when the user needs semantic caching of LLM/agent responses.
metadata:
  author: prasan
  version: "0.1.0"
  repo: git@github.com:PrasanKumar93/custom-agent-utils.git
  path: packages/cau-langcache
  dest: packages/cau-langcache
---

# cau-langcache

Typed facade over the `@redis-ai/langcache` SDK with a singleton pattern, so consumers never import the SDK directly and the underlying beta SDK can be swapped/upgraded without touching call sites.

For full API reference see [README.md](./README.md).

## When to Use

Vendor this package when the user needs:

- Semantic caching of LLM / agent responses (return a cached answer for a semantically similar prompt)
- A vector-search read (`search`) that returns the best match above a similarity threshold, or null on a miss
- Append-only writes (`set`) with optional attribute filters and TTL
- Attribute-scoped invalidation (`deleteByAttributes`), single-entry delete (`deleteById`), or full `flush`
- A `health()` probe for the cache service

## Vendoring

Sparse checkout + copy. The `--branch` flag accepts a git tag (preferred) or `main`.

```bash
CAU_REF="<git-tag-or-main>"
TMPDIR=$(mktemp -d)
git clone --depth 1 --branch "$CAU_REF" --filter=blob:none --sparse \
  git@github.com:PrasanKumar93/custom-agent-utils.git "$TMPDIR"
cd "$TMPDIR" && git sparse-checkout set packages/cau-langcache
cp -r "$TMPDIR/packages/cau-langcache" <your-project>/packages/cau-langcache
rm -rf "$TMPDIR"
```

### After vendoring

```bash
cd packages/cau-langcache
npm install
npm run build
```

### Provenance file

After vendoring, create `packages/cau-langcache/.vendor.json`:

```json
{
  "source": "git@github.com:PrasanKumar93/custom-agent-utils.git",
  "package": "packages/cau-langcache",
  "tag": "<git-tag-or-main>",
  "vendoredAt": "<ISO-8601 date>",
  "forked": false
}
```

### Updating

Re-run the sparse checkout commands above with the new `CAU_REF`, then:

```bash
cd packages/cau-langcache && npm install && npm run build
```

Update `.vendor.json` with the new `tag` and `vendoredAt`.

## Quick usage (vendored path)

```typescript
import { LangCache } from "cau-langcache";

LangCache.create({
  serverURL: process.env.LANGCACHE_SERVER_URL!,
  cacheId: process.env.LANGCACHE_CACHE_ID,
  apiKey: process.env.LANGCACHE_API_KEY,
});

const cache = LangCache.getInstance();

const hit = await cache.search({
  prompt: "What did James say about bonds in the Feb 26 2026 meeting?",
  similarityThreshold: 0.9,
  attributes: { feature: "chatbot", userId: "sarah-chen", namespace: "wealth-advisor" },
});

if (!hit) {
  await cache.set({
    prompt: "What did James say about bonds in the Feb 26 2026 meeting?",
    response: "<agent answer>",
    attributes: { feature: "chatbot", userId: "sarah-chen", namespace: "wealth-advisor" },
    ttlMillis: 600_000,
  });
}
```

See [README.md](./README.md) for the full API table, config reference, attribute-schema notes, and testing setup.

## Rules

- Do NOT modify vendored code. Extend via adapters or wrappers.
- If you must modify, update `.vendor.json` to mark `"forked": true`.
- Connection strings / secrets must come from environment variables.
- The provisioned cache may enforce an **attribute schema** (an allow-list of attribute keys). Sending an attribute outside that schema returns a `400`. Keep attributes to the keys the cache was provisioned with.
- `similarity` is higher = closer (normalized cosine). Do not reuse distance-based (lower = closer) logic from older SDKs.
