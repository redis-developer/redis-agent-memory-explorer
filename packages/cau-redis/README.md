# cau-redis

Typed Redis client wrapper around [node-redis](https://github.com/redis/node-redis) (v5) with singleton pattern, structured logging, and a `getClient()` escape hatch for any unwrapped command.

## Install

```bash
cd packages/cau-redis
npm install
npm run build
```

JSON operations require **Redis Stack** (or RedisJSON module). String, hash, key, pipeline, and pub/sub operations work with plain Redis.

## Quick Start

```typescript
import { RedisDb, buildKey } from "cau-redis";

const redis = RedisDb.create({ url: process.env.REDIS_URL });
await redis.connect();

// String
await redis.set({
  key: buildKey("app", "user", "1"),
  value: "Alice",
  ttlSec: 3600,
});
const name = await redis.get({ key: buildKey("app", "user", "1") });

// JSON (Redis Stack)
await redis.jsonSet({
  key: buildKey("app", "profile", "1"),
  value: { name: "Alice", age: 30 },
});
const profile = await redis.jsonGet({ key: buildKey("app", "profile", "1") });

// Hash
await redis.hSet({
  key: buildKey("app", "session", "abc"),
  fields: { userId: "1", role: "admin" },
});

// Escape hatch
const client = redis.getClient();
await client.lPush("mylist", "item");

await redis.close();
```

## Singleton

```typescript
// At bootstrap
RedisDb.create({ url: process.env.REDIS_URL });

// Anywhere else
const redis = RedisDb.getInstance();
```

## Full API

### Lifecycle

| Method                    | Returns           | Description                                     |
| ------------------------- | ----------------- | ----------------------------------------------- |
| `RedisDb.create(config?)` | `RedisDb`         | Create instance and set as singleton            |
| `RedisDb.getInstance()`   | `RedisDb`         | Retrieve singleton (throws if not created)      |
| `connect()`               | `Promise<void>`   | Open connection                                 |
| `close()`                 | `Promise<void>`   | Close connection and clear singleton            |
| `isConnected()`           | `boolean`         | Check if connected                              |
| `getClient()`             | `RedisClientType` | Raw node-redis client (throws if not connected) |

### String Operations

| Method   | Params                                | Returns                       |
| -------- | ------------------------------------- | ----------------------------- |
| `set`    | `{ key, value, ttlSec?, nx?, xx? }`   | `Promise<boolean>`            |
| `get`    | `{ key }`                             | `Promise<string \| null>`     |
| `getSet` | `{ key, value }`                      | `Promise<string \| null>`     |
| `setEx`  | `{ key, value, ttlSec }`              | `Promise<boolean>`            |
| `mSet`   | `{ entries: Record<string, string> }` | `Promise<boolean>`            |
| `mGet`   | `{ keys: string[] }`                  | `Promise<(string \| null)[]>` |
| `incr`   | `{ key, by? }`                        | `Promise<number>`             |
| `decr`   | `{ key, by? }`                        | `Promise<number>`             |
| `append` | `{ key, value }`                      | `Promise<number>`             |

### JSON Operations (Redis Stack)

| Method          | Params                            | Returns                  |
| --------------- | --------------------------------- | ------------------------ |
| `jsonSet`       | `{ key, path?, value, nx?, xx? }` | `Promise<boolean>`       |
| `jsonGet<T>`    | `{ key, path? }`                  | `Promise<T \| null>`     |
| `jsonDel`       | `{ key, path? }`                  | `Promise<number>`        |
| `jsonMGet<T>`   | `{ keys, path? }`                 | `Promise<(T \| null)[]>` |
| `jsonArrAppend` | `{ key, path, values }`           | `Promise<number>`        |
| `jsonNumIncrBy` | `{ key, path, by }`               | `Promise<number>`        |

### Hash Operations

| Method    | Params                                    | Returns                           |
| --------- | ----------------------------------------- | --------------------------------- |
| `hSet`    | `{ key, fields: Record<string, string> }` | `Promise<number>`                 |
| `hGet`    | `{ key, field }`                          | `Promise<string \| null>`         |
| `hGetAll` | `{ key }`                                 | `Promise<Record<string, string>>` |
| `hDel`    | `{ key, fields: string[] }`               | `Promise<number>`                 |
| `hExists` | `{ key, field }`                          | `Promise<boolean>`                |
| `hKeys`   | `{ key }`                                 | `Promise<string[]>`               |
| `hVals`   | `{ key }`                                 | `Promise<string[]>`               |
| `hIncrBy` | `{ key, field, by }`                      | `Promise<number>`                 |

### Key Management

| Method    | Params                          | Returns                  |
| --------- | ------------------------------- | ------------------------ |
| `exists`  | `{ key }`                       | `Promise<boolean>`       |
| `del`     | `{ keys: string[] }`            | `Promise<number>`        |
| `expire`  | `{ key, ttlSec }`               | `Promise<boolean>`       |
| `ttl`     | `{ key }`                       | `Promise<number>`        |
| `pExpire` | `{ key, ttlMs }`                | `Promise<boolean>`       |
| `pTtl`    | `{ key }`                       | `Promise<number>`        |
| `rename`  | `{ key, newKey }`               | `Promise<boolean>`       |
| `type`    | `{ key }`                       | `Promise<string>`        |
| `scan`    | `{ pattern?, count?, cursor? }` | `Promise<KeyScanResult>` |

### Pipeline

```typescript
const result = await redis.executePipeline([
  { op: "set", params: { key: "a", value: "1" } },
  { op: "get", params: { key: "a" } },
  { op: "hSet", params: { key: "h", fields: { f: "v" } } },
  { op: "expire", params: { key: "a", ttlSec: 60 } },
]);
// result.results: unknown[], result.aborted: boolean
```

Supported pipeline ops: `set`, `get`, `del`, `jsonSet`, `jsonGet`, `hSet`, `hGet`, `expire`.

### Pub/Sub

| Method        | Params                                      | Returns           |
| ------------- | ------------------------------------------- | ----------------- |
| `subscribe`   | `{ channel, onMessage: (msg, ch) => void }` | `Promise<void>`   |
| `publish`     | `{ channel, message }`                      | `Promise<number>` |
| `unsubscribe` | `{ channel }`                               | `Promise<void>`   |

Pub/Sub uses a dedicated subscriber connection created lazily on first `subscribe()` call.

### Health

| Method      | Returns            |
| ----------- | ------------------ |
| `ping()`    | `Promise<boolean>` |
| `dbSize()`  | `Promise<number>`  |
| `info()`    | `Promise<string>`  |
| `flushDb()` | `Promise<boolean>` |

### Utility

| Function   | Signature                           | Description                      |
| ---------- | ----------------------------------- | -------------------------------- |
| `buildKey` | `(...segments: string[]) => string` | Join segments with `:` separator |

## Config Reference

| Field                 | Type      | Default                    | Description                                                 |
| --------------------- | --------- | -------------------------- | ----------------------------------------------------------- |
| `url`                 | `string`  | `"redis://localhost:6379"` | Redis connection URL                                        |
| `connectTimeoutMs`    | `number`  | `5000`                     | TCP connect timeout                                         |
| `maxRetries`          | `number`  | `10`                       | Max reconnect attempts                                      |
| `retryDelayMs`        | `number`  | `200`                      | Base delay for exponential backoff                          |
| `disableOfflineQueue` | `boolean` | `false`                    | If true, commands throw during reconnect instead of queuing |
| `logger`              | `Logger`  | Console logger             | Optional cau-logger instance                                |

## Connection Behavior

- `connect()` must be called before any operation
- If not connected, operations throw immediately (no hang)
- Auto-reconnect on connection drop via exponential backoff (`retryDelayMs * 2^attempt`, capped at 5s)
- `disableOfflineQueue: false` (default) queues commands during reconnect
- `disableOfflineQueue: true` throws immediately during reconnect (fail-fast for API servers)

## JSON vs Hash: When to Use Which

| Use Case                                     | Recommendation                   |
| -------------------------------------------- | -------------------------------- |
| Nested objects, arrays, partial path updates | JSON (`jsonSet`, `jsonGet`)      |
| Flat key-value fields, counters              | Hash (`hSet`, `hGet`, `hIncrBy`) |
| Need to query/search documents               | JSON + RediSearch                |
| Simple session storage                       | Hash                             |

## Test Setup

```bash
# Redis Stack (includes RedisJSON for JSON operations)
docker run -d --name cau-redis -p 6379:6379 redis/redis-stack-server:latest
```

```bash
cd packages/cau-redis
npm test
```

| Env var     | Default                  | Purpose                  |
| ----------- | ------------------------ | ------------------------ |
| `REDIS_URL` | `redis://localhost:6379` | Connection URL for tests |
