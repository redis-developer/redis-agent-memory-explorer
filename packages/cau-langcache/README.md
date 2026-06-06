# cau-langcache

Typed wrapper for [Redis LangCache](https://redis.io/docs/latest/develop/ai/langcache/) — Redis' managed semantic cache. Wraps the `@redis-ai/langcache` beta SDK behind a generic, singleton interface so consumers never depend on SDK types directly.

## Install

```bash
npm install cau-langcache
```

Underlying dependency (installed transitively): `@redis-ai/langcache` (pinned to `0.11.1`; beta SDK, may have breaking changes between minor versions).

## Quick Start

```typescript
import { LangCache } from "cau-langcache";

// Initialize once per process (reads LANGCACHE_* env if no overrides given).
LangCache.create({
  serverURL: process.env.LANGCACHE_SERVER_URL!,
  cacheId: process.env.LANGCACHE_CACHE_ID,
  apiKey: process.env.LANGCACHE_API_KEY,
});

const cache = LangCache.getInstance();

const hit = await cache.search({
  prompt: "What happened in the Feb 26 2026 client review?",
  similarityThreshold: 0.9,
  attributes: { feature: "chatbot", userId: "sarah-chen", namespace: "wealth-advisor" },
});

if (hit) {
  console.log(hit.response, hit.similarity); // cached answer + closeness
} else {
  const answer = await runAgent();
  await cache.set({
    prompt: "What happened in the Feb 26 2026 client review?",
    response: answer,
    attributes: { feature: "chatbot", userId: "sarah-chen", namespace: "wealth-advisor" },
    ttlMillis: 600_000,
  });
}
```

## Singleton

`LangCache` uses a process-wide singleton (mirroring `cau-ram`):

- `LangCache.create(configOverride?)` — builds the SDK and stores the singleton. Missing fields fall back to `LANGCACHE_*` env vars.
- `LangCache.getInstance()` — returns the singleton; throws if `create()` was not called.
- `LangCache.resetInstance()` — clears the singleton (mainly for tests).

Each process (e.g. a LangGraph server and an API server) initializes its own singleton.

## API

| Method | Signature | Description |
|---|---|---|
| `search` | `(params: CacheSearchParams) => Promise<CacheHit \| null>` | Vector search; returns the best entry at/above the threshold, or `null` on a miss. |
| `set` | `(params: CacheSetParams) => Promise<string>` | Stores an entry (append-only); returns the `entryId`. |
| `deleteByAttributes` | `(attributes: Record<string,string>) => Promise<number>` | Deletes all entries matching the attributes; returns the deleted count. |
| `deleteById` | `(entryId: string) => Promise<void>` | Deletes a single entry by id. |
| `flush` | `() => Promise<void>` | Removes all entries from the cache. |
| `health` | `() => Promise<boolean>` | Probes the service; `true` if reachable, `false` otherwise. |

### Types

```typescript
type LangCacheConfig   = { serverURL: string; cacheId?: string; apiKey?: string };
type CacheSetParams    = { prompt: string; response: string; attributes?: Record<string,string>; ttlMillis?: number };
type CacheSearchParams = { prompt: string; similarityThreshold?: number; attributes?: Record<string,string> };
type CacheHit          = { id: string; prompt: string; response: string; attributes: Record<string,string>; similarity: number };
```

## Config Reference

`LangCache.create()` reads these env vars when the corresponding field is not passed:

| Env var | Field | Required | Description |
|---|---|---|---|
| `LANGCACHE_SERVER_URL` | `serverURL` | Yes | LangCache service URL |
| `LANGCACHE_CACHE_ID` | `cacheId` | For real ops | Cache id (provisioned in Redis Cloud) |
| `LANGCACHE_API_KEY` | `apiKey` | For cloud | LangCache API key |

Defaults exported for consumers: `DEFAULT_SIMILARITY_THRESHOLD` (`0.9`), `DEFAULT_TTL_MILLIS` (`600000`).

## Attributes & the attribute schema

`attributes` is a `string → string` map used as **exact-match filters** that partition the cache. They are passed to both `search` and `set`.

> A provisioned cache may enforce an **attribute schema** — an allow-list of permitted attribute keys. Sending a key outside that list returns a `400 Invalid Request`. For example, a cache provisioned with `feature, userId, namespace` will reject any other attribute key. Keep your attributes within the provisioned schema.

`similarity` is normalized cosine similarity where **higher = closer** (a hit requires `similarity >= similarityThreshold`).

## Testing

Tests are zero-mock and run against a real LangCache service. They are skipped automatically when `LANGCACHE_SERVER_URL` / `LANGCACHE_CACHE_ID` are not set.

```bash
npm test -w packages/cau-langcache
```

`vitest.config.ts` loads `backend/.env` then the repo-root `.env` so `LANGCACHE_*` credentials are available. Test entries are isolated under a unique `namespace` and bulk-deleted in cleanup.
