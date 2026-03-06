# cau-redis -- Design Plan (v1)

## Goal

Create a **typed Redis client wrapper** around [node-redis](https://github.com/redis/node-redis) (v5) as a utility package in `packages/cau-redis`. The package provides connection management, CRUD operations on **String** and **JSON** data types, hash operations, key management, pipelining, pub/sub helpers, and health checks. The wrapper adds structured logging and a singleton pattern on top of node-redis. A `getClient()` escape hatch exposes the raw node-redis client for any command we haven't wrapped. A `buildKey()` utility helps users follow colon-separated key naming conventions.

---

## 1. Why node-redis + Wrapper (not from scratch)

### What node-redis gives us (free, battle-tested)

- **Official Redis client** -- maintained by Redis Ltd., first-class support for Redis Stack modules
- Native **RedisJSON** support (`JSON.SET`, `JSON.GET`, `JSON.DEL`, `JSON.MGET`, partial path updates)
- Native **RediSearch** module support (future extensibility)
- Auto-reconnect with configurable retry strategies
- Connection pooling via `createClientPool` (or manual pooling)
- Cluster + Sentinel support
- `MULTI` / pipeline support for batched commands
- TypeScript-first with full type definitions

### What we build on top

| Gap                                         | Our addition                                                   |
| ------------------------------------------- | -------------------------------------------------------------- |
| No singleton pattern for shared connections | `RedisDb.create()` / `RedisDb.getInstance()` singleton factory |
| Library types leak to consumers             | `RedisDb` class with own types from `types.ts`                 |
| No escape hatch for uncommon commands       | `getClient()` exposes raw node-redis client for power users    |
| No typed CRUD params / results              | Typed param objects for common operations (like `cau-mongodb`) |
| No default config with sensible defaults    | Zero-arg `RedisDb.create()` connects to `localhost:6379`       |
| No structured logging integration           | Optional `cau-logger` integration                              |
| No key naming helper                        | `buildKey()` utility for colon-separated key conventions       |
| Pipeline API is low-level                   | Simplified `executePipeline()` with typed command array        |
| Pub/Sub wiring is verbose                   | `subscribe()` / `publish()` helpers with typed callbacks       |

### What we write vs what we reuse

| Layer                     | LOC (approx) | Source       |
| ------------------------- | ------------ | ------------ |
| Core Redis engine         | 0            | node-redis   |
| Connection + reconnect    | 0            | node-redis   |
| JSON module commands      | 0            | node-redis   |
| Wrapper / factory class   | ~80          | **Our code** |
| String operations         | ~60          | **Our code** |
| JSON operations           | ~80          | **Our code** |
| Hash operations           | ~60          | **Our code** |
| Key management operations | ~50          | **Our code** |
| Pipeline helper           | ~40          | **Our code** |
| Pub/Sub helpers           | ~50          | **Our code** |
| buildKey helper           | ~5           | **Our code** |
| Types + constants         | ~110         | **Our code** |
| Config + env loading      | ~20          | **Our code** |
| **Total custom code**     | **~545**     | --           |

---

## 2. Architecture Overview

```
RedisDb.create(config?)                   [packages/cau-redis]
  |
  |-- config defaults: url="redis://localhost:6379"
  |
  |-- createClient(options) --> RedisClientType
  |     |-- socket.connectTimeout
  |     |-- socket.reconnectStrategy (exponential backoff)
  |
  |-- RedisDb wraps client behind typed interface
       |
       |-- Wrapped ops (add structured logging on every call):
       |     |-- String:    set, get, getSet, setEx, mSet, mGet, incr, decr, append
       |     |-- JSON:      jsonSet, jsonGet, jsonDel, jsonMGet, jsonArrAppend, jsonNumIncrBy
       |     |-- Hash:      hSet, hGet, hGetAll, hDel, hExists, hKeys, hVals, hIncrBy
       |     |-- Key:       exists, del, expire, ttl, pExpire, pTtl, rename, type, scan
       |     |-- Pipeline:  executePipeline(commands[])
       |     |-- Pub/Sub:   subscribe, publish, unsubscribe
       |     |-- Health:    ping, dbSize, info
       |
       |-- Escape hatch:
       |     |-- getClient() --> raw node-redis client for any unwrapped command
       |
       |-- Lifecycle:  connect, close, isConnected (explicit, no lazy connect)
```

### Library-agnostic interface

`RedisDb` is our own class. All param and result types for wrapped operations are defined in `types.ts`. The `getClient()` method returns the raw node-redis client for any command we haven't wrapped (LRANGE, SINTER, Lua scripts, etc.) -- this intentionally leaks the node-redis type, which is fine since we're committed to node-redis as the underlying library.

### Defaults-first config

Every field in `RedisDbConfig` is optional. `RedisDb.create()` with zero args connects to `redis://localhost:6379`:

```typescript
type RedisDbConfig = {
  url?: string; // default: "redis://localhost:6379"
  connectTimeoutMs?: number; // default: 5000
  maxRetries?: number; // default: 10
  retryDelayMs?: number; // default: 200 (base for exponential backoff)
  disableOfflineQueue?: boolean; // default: false (queue commands during reconnect)
  logger?: Logger; // optional cau-logger instance (else create logger instance with console)
};
```

### Connection lifecycle

Connection is **explicit** -- the consumer must call `connect()` before using any operation. If an operation is called on an unconnected client, node-redis throws `ClientClosedError` immediately (no hang, no silent retry). This makes connection failures visible at the right time rather than hiding them behind lazy magic.

```
RedisDb.create(config) --> instance (not connected yet)
    |
    await instance.connect() --> TCP connection established
    |
    instance.set / get / jsonSet / ... --> works
    |
    await instance.close() --> connection closed
```

### Reconnect and offline queue behavior

node-redis v5 has a built-in `socket.reconnectStrategy` that auto-reconnects when the connection drops _after_ it was established. Our `build-reconnect-strategy.util.ts` helper configures exponential backoff using `maxRetries` and `retryDelayMs` from config:

```
backoff = min(retryDelayMs * 2^attempt, RETRY_MAX_DELAY_MS)
```

When the connection is temporarily down and the client is reconnecting, the `disableOfflineQueue` config controls command behavior:

| `disableOfflineQueue` | During reconnect                                   | Use case                                             |
| --------------------- | -------------------------------------------------- | ---------------------------------------------------- |
| `false` (default)     | Commands queue in memory, execute when reconnected | Background workers, queues -- tolerate brief outages |
| `true`                | Commands throw `ClientClosedError` immediately     | API servers -- fail fast, return 503 to caller       |

The `connect()` method also registers an `error` event listener that logs connection errors via the optional `cau-logger` instance (instead of crashing the process with an unhandled error).

**Why we don't need the manual reconnect pattern from [redis-starter-js](https://github.com/redis-developer/redis-starter-js/blob/main/server/redis.ts):** that code manually destroys and recreates the client on error -- this was common in node-redis v4 but is unnecessary in v5 where `socket.reconnectStrategy` handles it natively. Our approach delegates reconnection to node-redis internals, which is simpler and more reliable.

### Key naming -- `buildKey()` utility

No automatic key prefixing. The user owns their keys entirely. We provide a simple `buildKey()` helper that joins segments with colons, following the `data-key-naming` best practice from the redis-development skill:

```typescript
const buildKey = (...segments: string[]): string => segments.join(":");

// Usage
buildKey("myapp", "user", "123");   // => "myapp:user:123"
buildKey("session", sessionId);      // => "session:abc-def"
```

This works consistently everywhere -- wrapped methods, pipeline, pub/sub, and `getClient()`. No hidden prefixing, no edge cases, no inconsistency between different code paths.

### What each wrapper adds over raw node-redis

Every wrapped method does one thing beyond forwarding the call:

1. **Logging** -- structured debug log of the operation via optional `cau-logger`

That's it. No key prefixing, no `ensureConnected`, no retry logic, no error transformation. If the client isn't connected, node-redis throws `ClientClosedError` immediately. If you need a command we haven't wrapped, use `getClient()` and call it directly.

---

## 3. Operations Design

### 3a. String Operations (`operations/string.ts`)

| Method   | Redis Command | Params                                | Returns               |
| -------- | ------------- | ------------------------------------- | --------------------- |
| `set`    | `SET`         | `{ key, value, ttlSec?, nx?, xx? }`   | `boolean`             |
| `get`    | `GET`         | `{ key }`                             | `string \| null`      |
| `getSet` | `GETSET`      | `{ key, value }`                      | `string \| null`      |
| `setEx`  | `SETEX`       | `{ key, value, ttlSec }`              | `boolean`             |
| `mSet`   | `MSET`        | `{ entries: Record<string, string> }` | `boolean`             |
| `mGet`   | `MGET`        | `{ keys: string[] }`                  | `(string \| null)[]`  |
| `incr`   | `INCRBY`      | `{ key, by? }`                        | `number`              |
| `decr`   | `DECRBY`      | `{ key, by? }`                        | `number`              |
| `append` | `APPEND`      | `{ key, value }`                      | `number` (new length) |

### 3b. JSON Operations (`operations/json.ts`)

Requires RedisJSON module (Redis Stack or Redis 7.2+ with modules).

| Method          | Redis Command    | Params                            | Returns                  |
| --------------- | ---------------- | --------------------------------- | ------------------------ |
| `jsonSet`       | `JSON.SET`       | `{ key, path?, value, nx?, xx? }` | `boolean`                |
| `jsonGet`       | `JSON.GET`       | `{ key, path? }`                  | `T \| null`              |
| `jsonDel`       | `JSON.DEL`       | `{ key, path? }`                  | `number` (deleted count) |
| `jsonMGet`      | `JSON.MGET`      | `{ keys, path? }`                 | `(T \| null)[]`          |
| `jsonArrAppend` | `JSON.ARRAPPEND` | `{ key, path, values }`           | `number` (new length)    |
| `jsonNumIncrBy` | `JSON.NUMINCRBY` | `{ key, path, by }`               | `number`                 |

All JSON operations default `path` to `$` (root).

### 3c. Hash Operations (`operations/hash.ts`)

| Method    | Redis Command | Params                                    | Returns                   |
| --------- | ------------- | ----------------------------------------- | ------------------------- |
| `hSet`    | `HSET`        | `{ key, fields: Record<string, string> }` | `number` (fields added)   |
| `hGet`    | `HGET`        | `{ key, field }`                          | `string \| null`          |
| `hGetAll` | `HGETALL`     | `{ key }`                                 | `Record<string, string>`  |
| `hDel`    | `HDEL`        | `{ key, fields: string[] }`               | `number` (fields removed) |
| `hExists` | `HEXISTS`     | `{ key, field }`                          | `boolean`                 |
| `hKeys`   | `HKEYS`       | `{ key }`                                 | `string[]`                |
| `hVals`   | `HVALS`       | `{ key }`                                 | `string[]`                |
| `hIncrBy` | `HINCRBY`     | `{ key, field, by }`                      | `number`                  |

### 3d. Key Management Operations (`operations/key.ts`)

| Method    | Redis Command | Params                          | Returns                               |
| --------- | ------------- | ------------------------------- | ------------------------------------- |
| `exists`  | `EXISTS`      | `{ key }`                       | `boolean`                             |
| `del`     | `DEL`         | `{ keys: string[] }`            | `number` (deleted count)              |
| `expire`  | `EXPIRE`      | `{ key, ttlSec }`               | `boolean`                             |
| `ttl`     | `TTL`         | `{ key }`                       | `number` (-1 no expiry, -2 not found) |
| `pExpire` | `PEXPIRE`     | `{ key, ttlMs }`                | `boolean`                             |
| `pTtl`    | `PTTL`        | `{ key }`                       | `number`                              |
| `rename`  | `RENAME`      | `{ key, newKey }`               | `boolean`                             |
| `type`    | `TYPE`        | `{ key }`                       | `string`                              |
| `scan`    | `SCAN`        | `{ pattern?, count?, cursor? }` | `{ cursor: number, keys: string[] }`  |

### 3e. Pipeline (`operations/pipeline.ts`)

Batch multiple commands in a single round trip using `MULTI`/`EXEC`:

```typescript
type PipelineCommand =
  | { op: "set"; params: StringSetParams }
  | { op: "get"; params: StringGetParams }
  | { op: "del"; params: KeyDelParams }
  | { op: "jsonSet"; params: JsonSetParams }
  | { op: "jsonGet"; params: JsonGetParams }
  | { op: "hSet"; params: HashSetParams }
  | { op: "hGet"; params: HashGetParams }
  | { op: "expire"; params: KeyExpireParams };

type PipelineResult = {
  results: unknown[];
  aborted: boolean;
};
```

### 3f. Pub/Sub (`operations/pubsub.ts`)

| Method        | Redis Command | Params                   | Returns              |
| ------------- | ------------- | ------------------------ | -------------------- |
| `subscribe`   | `SUBSCRIBE`   | `{ channel, onMessage }` | `void`               |
| `publish`     | `PUBLISH`     | `{ channel, message }`   | `number` (receivers) |
| `unsubscribe` | `UNSUBSCRIBE` | `{ channel }`            | `void`               |

Pub/Sub uses a dedicated subscriber client (node-redis requires separate connections for subscribe mode).

### 3g. Health & Info

| Method    | Redis Command | Returns   |
| --------- | ------------- | --------- |
| `ping`    | `PING`        | `boolean` |
| `dbSize`  | `DBSIZE`      | `number`  |
| `info`    | `INFO`        | `string`  |
| `flushDb` | `FLUSHDB`     | `boolean` |

---

## 4. Public API

### Exports

```typescript
// Runtime
export { RedisDb, buildKey };

// Types
export type {
  RedisDbConfig,
  StringSetParams,
  StringGetParams,
  StringSetExParams,
  StringMSetParams,
  StringMGetParams,
  StringIncrParams,
  StringDecrParams,
  StringAppendParams,
  JsonSetParams,
  JsonGetParams,
  JsonDelParams,
  JsonMGetParams,
  JsonArrAppendParams,
  JsonNumIncrByParams,
  HashSetParams,
  HashGetParams,
  HashGetAllParams,
  HashDelParams,
  HashExistsParams,
  HashKeysParams,
  HashValsParams,
  HashIncrByParams,
  KeyExistsParams,
  KeyDelParams,
  KeyExpireParams,
  KeyTtlParams,
  KeyPExpireParams,
  KeyPTtlParams,
  KeyRenameParams,
  KeyTypeParams,
  KeyScanParams,
  KeyScanResult,
  PipelineCommand,
  PipelineResult,
  SubscribeParams,
  PublishParams,
  UnsubscribeParams,
};
```

### Usage

```typescript
import { RedisDb, buildKey } from "cau-redis";

// Zero config -- connects to localhost:6379
const redis = RedisDb.create();
await redis.connect();

// Custom config
const redis = RedisDb.create({
  url: process.env.REDIS_URL,
  logger: myLogger,
});
await redis.connect();

// Key naming -- user controls the full key, buildKey is a convenience helper
const userKey = buildKey("myapp", "user", "1");       // "myapp:user:1"
const sessionKey = buildKey("myapp", "session", "abc"); // "myapp:session:abc"

// String CRUD
await redis.set({ key: buildKey("myapp", "user", "1", "name"), value: "Alice", ttlSec: 3600 });
const name = await redis.get({ key: buildKey("myapp", "user", "1", "name") });

// JSON CRUD (requires Redis Stack)
await redis.jsonSet({ key: userKey, value: { name: "Alice", age: 30 } });
const user = await redis.jsonGet<{ name: string; age: number }>({ key: userKey });
await redis.jsonSet({ key: userKey, path: "$.age", value: 31 });

// Hash CRUD
await redis.hSet({ key: sessionKey, fields: { userId: "1", role: "admin" } });
const role = await redis.hGet({ key: sessionKey, field: "role" });

// Pipeline -- same keys, no prefix inconsistency
const result = await redis.executePipeline([
  { op: "set", params: { key: buildKey("myapp", "a"), value: "1" } },
  { op: "set", params: { key: buildKey("myapp", "b"), value: "2" } },
  { op: "get", params: { key: buildKey("myapp", "a") } },
]);

// Pub/Sub
await redis.subscribe({
  channel: "events",
  onMessage: (message) => console.log(message),
});
await redis.publish({ channel: "events", message: "hello" });

// Escape hatch -- raw node-redis client for unwrapped commands
const client = redis.getClient();
await client.lPush(buildKey("myapp", "list"), "item1");
await client.sAdd(buildKey("myapp", "set"), "member1");

// Cleanup
await redis.close();
```

### Singleton access

```typescript
import { RedisDb, buildKey } from "cau-redis";

// In setup / bootstrap
RedisDb.create({ url: process.env.REDIS_URL });

// Anywhere else
const redis = RedisDb.getInstance();
await redis.set({ key: buildKey("myapp", "foo"), value: "bar" });
```

---

## 5. Folder Structure

```
packages/
  cau-redis/
    docs/
      plan.md                       # this file
    src/
      helpers/
        build-key.util.ts           # join segments with colon separator
        build-key.util.test.ts
        build-reconnect-strategy.util.ts  # exponential backoff builder
        build-reconnect-strategy.util.test.ts
      operations/
        connect.ts                  # connect, close, isConnected (no lazy/ensureConnected)
        connect.test.ts
        string.ts                   # set, get, getSet, setEx, mSet, mGet, incr, decr, append
        string.test.ts
        json.ts                     # jsonSet, jsonGet, jsonDel, jsonMGet, jsonArrAppend, jsonNumIncrBy
        json.test.ts
        hash.ts                     # hSet, hGet, hGetAll, hDel, hExists, hKeys, hVals, hIncrBy
        hash.test.ts
        key.ts                      # exists, del, expire, ttl, pExpire, pTtl, rename, type, scan
        key.test.ts
        pipeline.ts                 # executePipeline
        pipeline.test.ts
        pubsub.ts                   # subscribe, publish, unsubscribe
        pubsub.test.ts
        health.ts                   # ping, dbSize, info, flushDb
        health.test.ts
      constants.ts                  # defaults, key separator, etc.
      config.ts                     # env loading via dotenv
      types.ts                      # all public + internal types
      redis-db.ts                   # the public interface class (RedisDb)
      redis-db.test.ts              # main class integration tests
      index.ts                      # barrel re-exports
    test.env                        # env overrides for tests
    vitest.setup.ts                 # imports config.ts
    vitest.config.ts                # vitest configuration
    tsconfig.json
    package.json
    SKILL.md                        # agent vendoring instructions
    README.md                       # full API reference
```

---

## 6. Dependencies

| Dependency    | Purpose                           | Type                              |
| ------------- | --------------------------------- | --------------------------------- |
| `redis`       | Core Redis client (node-redis v5) | **prod**                          |
| `dotenv`      | Environment variable loading      | **prod**                          |
| `cau-logger`  | Structured logging (optional)     | **prod** (peer-like, `*` version) |
| `typescript`  | Build                             | dev                               |
| `@types/node` | Node.js type definitions          | dev                               |
| `vitest`      | Test runner                       | dev                               |

---

## 7. Constants

```typescript
const DEFAULT_REDIS_URL = "redis://localhost:6379";
const DEFAULT_CONNECT_TIMEOUT_MS = 5000;
const DEFAULT_MAX_RETRIES = 10;
const DEFAULT_RETRY_DELAY_MS = 200;
const DEFAULT_RETRY_MAX_DELAY_MS = 5000;
const DEFAULT_DISABLE_OFFLINE_QUEUE = false;
const KEY_SEPARATOR = ":";
const DEFAULT_JSON_PATH = "$";
const DEFAULT_SCAN_COUNT = 100;
```

---

## 8. Testing

### Strategy

Per `js-testing` skill: **zero mocks, real execution, real Redis.**

| Test file                               | Tests (approx) | What it hits                                                   |
| --------------------------------------- | -------------- | -------------------------------------------------------------- |
| `build-key.util.test.ts`                | 4              | Pure function -- colon-joined key building                     |
| `build-reconnect-strategy.util.test.ts` | 4              | Pure function -- backoff calculation                           |
| `connect.test.ts`                       | 5              | Real Redis -- connect, close, ClientClosedError on unconnected |
| `string.test.ts`                        | 10             | Real Redis -- all string operations                            |
| `json.test.ts`                          | 8              | Real Redis Stack -- all JSON operations                        |
| `hash.test.ts`                          | 9              | Real Redis -- all hash operations                              |
| `key.test.ts`                           | 10             | Real Redis -- key management                                   |
| `pipeline.test.ts`                      | 4              | Real Redis -- batched commands                                 |
| `pubsub.test.ts`                        | 4              | Real Redis -- subscribe/publish                                |
| `health.test.ts`                        | 4              | Real Redis -- ping, dbSize, info                               |
| `redis-db.test.ts`                      | 6              | Integration -- singleton, create, lifecycle                    |
| **Total**                               | **~68**        | **All against real Redis**                                     |

### Environment

| Env var     | Default                  | Purpose                      |
| ----------- | ------------------------ | ---------------------------- |
| `REDIS_URL` | `redis://localhost:6379` | Connection URL for all tests |

### Docker command for test Redis

```bash
# Redis Stack (includes RedisJSON module needed for JSON operations)
docker run -d --name cau-redis -p 6379:6379 redis/redis-stack-server:latest
```

Using `redis-stack-server` instead of plain `redis` because JSON operations require the RedisJSON module.

---

## 9. Redis Best Practices Applied

Following the `redis-development` skill guidelines:

| Rule                   | How applied                                                                  |
| ---------------------- | ---------------------------------------------------------------------------- |
| `data-key-naming`      | `buildKey()` utility for colon-separated keys; user controls full key        |
| `ram-ttl`              | All `set` operations accept optional `ttlSec` / `ttlMs`                      |
| `conn-pooling`         | node-redis uses multiplexing by default; pool config exposed                 |
| `conn-timeouts`        | `connectTimeoutMs` in config with sensible default                           |
| `conn-pipelining`      | `executePipeline()` wraps `MULTI`/`EXEC` for batched commands                |
| `json-partial-updates` | JSON operations support `path` parameter for partial reads/writes            |
| `json-vs-hash`         | Both Hash and JSON operations provided; README documents when to use which   |
| `security-auth`        | URL-based auth (`redis://user:pass@host:port`); no plaintext password fields |

---

## 10. Delivery Phases

| Phase                | Scope                                                             | Status  |
| -------------------- | ----------------------------------------------------------------- | ------- |
| 1. Scaffold + Config | package.json, tsconfig, vitest, config, constants, types, barrel  | PENDING |
| 2. Connect + Health  | connect, close, isConnected, getClient, ping, dbSize, info        | PENDING |
| 3. String Operations | set, get, getSet, setEx, mSet, mGet, incr, decr, append           | PENDING |
| 4. JSON Operations   | jsonSet, jsonGet, jsonDel, jsonMGet, jsonArrAppend, jsonNumIncrBy | PENDING |
| 5. Hash Operations   | hSet, hGet, hGetAll, hDel, hExists, hKeys, hVals, hIncrBy         | PENDING |
| 6. Key Management    | exists, del, expire, ttl, pExpire, pTtl, rename, type, scan       | PENDING |
| 7. Pipeline          | executePipeline with MULTI/EXEC                                   | PENDING |
| 8. Pub/Sub           | subscribe, publish, unsubscribe with dedicated client             | PENDING |
| 9. Main Class        | RedisDb singleton + factory wiring all operations                 | PENDING |
| 10. Tests            | All test files, real Redis execution                              | PENDING |
| 11. Docs + Agentic   | SKILL.md, README.md, PACKAGE_INDEX.md entry                       | PENDING |

---

## 11. Resolved Questions

| Question                          | Resolution                                                                                                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| node-redis vs ioredis?            | node-redis -- official client, first-class RedisJSON support, maintained by Redis Ltd. Committed to this library (no abstraction swap planned).                                 |
| node-redis v4 vs v5?              | v5 -- latest stable, better TypeScript support, ESM-ready                                                                                                                       |
| Connection pool vs multiplexing?  | node-redis uses multiplexing by default (single TCP connection, pipelined). Pool option documented for high-throughput scenarios.                                               |
| Lazy connect vs explicit?         | **Explicit only.** Consumer must call `connect()` before operations. No `ensureConnected` magic. node-redis throws `ClientClosedError` immediately if not connected (no hang).  |
| Why wrap simple ops like set/get? | Wrappers add structured logging on every call. For anything we haven't wrapped, `getClient()` returns the raw node-redis client.                                                 |
| JSON module required?             | JSON operations require Redis Stack or RedisJSON module. Package works without it (string/hash/key ops still function). JSON ops throw descriptive error if module unavailable. |
| Pub/Sub separate client?          | Yes -- node-redis requires a dedicated client for subscribe mode. Created lazily on first `subscribe()` call.                                                                   |
| Key prefix automatic?             | **No.** Dropped auto-prefix to avoid edge cases (mSet record keys, scan pattern stripping, rename both keys, pipeline prefixing, getClient inconsistency). Replaced with `buildKey()` utility the user calls explicitly -- works identically everywhere. |
| Cluster support?                  | Not in v1 -- single-node focus. Cluster support is a future extension.                                                                                                          |
| Lua scripting?                    | Not in v1 -- use `getClient().evalSha()` directly via the escape hatch.                                                                                                         |
