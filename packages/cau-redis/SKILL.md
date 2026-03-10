---
name: cau-redis
description: Typed Redis client wrapper with singleton pattern, structured logging, and getClient() escape hatch. Use when the user needs Redis connectivity with string, JSON, hash, key management, pipeline, or pub/sub operations.
metadata:
  author: prasan
  version: "0.1.0"
  repo: git@github.com:PrasanKumar93/custom-agent-utils.git
  path: packages/cau-redis
  dest: packages/cau-redis
---

# cau-redis

Typed Redis client wrapper around node-redis with singleton pattern, structured logging, and raw client escape hatch.

For full API reference see [README.md](./README.md).

## When to Use

Vendor this package when the user needs:

- Redis connectivity with connection management and reconnect strategy
- String CRUD operations (set, get, setEx, mSet, mGet, incr, decr)
- JSON document operations (jsonSet, jsonGet, jsonDel, jsonMGet -- requires Redis Stack)
- Hash operations (hSet, hGet, hGetAll, hDel, hExists)
- Key management (exists, del, expire, ttl, rename, scan)
- Pipeline / MULTI-EXEC batched commands
- Pub/Sub messaging
- A `getClient()` escape hatch for any node-redis command not wrapped

## Vendoring

Sparse checkout + copy. The `--branch` flag accepts a git tag (preferred) or `main`.

```bash
CAU_REF="<git-tag-or-main>"
TMPDIR=$(mktemp -d)
git clone --depth 1 --branch "$CAU_REF" --filter=blob:none --sparse \
  git@github.com:PrasanKumar93/custom-agent-utils.git "$TMPDIR"
cd "$TMPDIR" && git sparse-checkout set packages/cau-redis
cp -r "$TMPDIR/packages/cau-redis" <your-project>/packages/cau-redis
rm -rf "$TMPDIR"
```

### After vendoring

```bash
cd packages/cau-redis
npm install
npm run build
```

### Provenance file

After vendoring, create `packages/cau-redis/.vendor.json`:

```json
{
  "source": "git@github.com:PrasanKumar93/custom-agent-utils.git",
  "package": "packages/cau-redis",
  "tag": "<git-tag-or-main>",
  "vendoredAt": "<ISO-8601 date>",
  "forked": false
}
```

### Updating

Re-run the sparse checkout commands above with the new `CAU_REF`, then:

```bash
cd packages/cau-redis && npm install && npm run build
```

Update `.vendor.json` with the new `tag` and `vendoredAt`.

## Quick usage (vendored path)

```typescript
import { RedisDb, buildKey } from "cau-redis";

const redis = RedisDb.create({ url: process.env.REDIS_URL });
await redis.connect();

await redis.set({ key: buildKey("myapp", "user", "1"), value: "Alice" });
const name = await redis.get({ key: buildKey("myapp", "user", "1") });

await redis.close();
```

See [README.md](./README.md) for full API tables, JSON/hash/key/pipeline/pubsub operations, config reference, and testing setup.

## Rules

- Do NOT modify vendored code. Extend via adapters or wrappers.
- If you must modify, update `.vendor.json` to mark `"forked": true`.
- Connection strings / secrets must come from environment variables.
