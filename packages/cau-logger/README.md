# cau-logger

Fast, multi-transport logger built on [Pino](https://github.com/pinojs/pino) for [custom-agent-utils](https://github.com/maakrupa/custom-agent-utils).

`Logger` is a singleton-friendly class that declaratively wires console, file, MongoDB, and SQL transports. All heavy I/O runs in Pino worker threads -- logging never blocks the main thread.

## Install

```bash
npm install cau-logger
```

If you use the MongoDB or SQL transports, install the corresponding peer dependency:

```bash
npm install mongodb   # for mongo transport
npm install knex pg   # for sql transport (pg, mysql2, better-sqlite3, etc.)
```

## Quick Start

```typescript
import { Logger } from "cau-logger";

const logger = Logger.create({
  level: "info",
  context: "AppBootstrap",
  transports: [{ type: "console", format: "pretty" }],
});

logger.info("Server started on port 3000");
logger.error("Unhandled rejection", { err });
```

## Singleton

```typescript
import { Logger } from "cau-logger";

// First call creates the instance; subsequent calls return the same one.
const logger = Logger.getInstance({
  level: "info",
  transports: [{ type: "console", format: "pretty" }],
});

// Elsewhere in the app -- same instance, no config needed.
const logger = Logger.getInstance();
```

## Multi-Transport

```typescript
import { Logger } from "cau-logger";

const logger = Logger.create({
  level: "debug",
  redact: ["password", "req.headers.authorization"],
  transports: [
    { type: "console", format: "json" },
    { type: "file", path: "./logs/app.log", rotation: "daily", maxFiles: 7 },
    {
      type: "mongo",
      uri: "mongodb://localhost:27017",
      database: "myapp",
      collection: "logs",
      batchSize: 100,
      flushInterval: 5000,
    },
    {
      type: "sql",
      connection: { client: "pg", connection: process.env.DATABASE_URL },
      table: "app_logs",
      batchSize: 50,
      flushInterval: 5000,
    },
  ],
});
```

## Child Loggers

```typescript
const reqLogger = logger.child({ requestId: req.id, userId: req.user?.id });
reqLogger.info("Processing order");
reqLogger.warn("Inventory low", { sku: "WIDGET-42", remaining: 3 });
// => { ..., requestId: "abc-123", userId: "u-42", sku: "WIDGET-42", remaining: 3, msg: "Inventory low" }
```

## Graceful Shutdown

```typescript
process.on("SIGTERM", async () => {
  await logger.close();
  process.exit(0);
});
```

## API

### `Logger` class

| Method / Property | Signature | Description |
| --- | --- | --- |
| `Logger.create(config?)` | `(config?: LoggerConfig) => Logger` | Creates a new logger instance |
| `Logger.getInstance(config?)` | `(config?: LoggerConfig) => Logger` | Returns (or creates) the singleton instance |
| `Logger.reset()` | `() => void` | Clears the singleton (useful in tests) |
| `trace`, `debug`, `info`, `warn`, `error`, `fatal` | `(msg: string, data?: Record<string, unknown>) => void` | Standard log-level methods |
| `child(bindings)` | `(bindings: Record<string, unknown>) => Logger` | Creates a child logger with merged bindings |
| `level` | `LogLevel` (get/set) | Read or change the minimum log level at runtime |
| `isLevelEnabled(level)` | `(level: LogLevel) => boolean` | Check if a level would produce output |
| `flush()` | `() => Promise<void>` | Flushes buffered logs |
| `close()` | `() => Promise<void>` | Flushes all transports and ends the transport stream |

**LoggerConfig:**

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `level` | `LogLevel` | `"info"` | Minimum log level |
| `context` | `string` | -- | Persistent context label added to every log |
| `redact` | `string[]` | -- | Paths to redact (e.g. `["password"]`) |
| `transports` | `TransportConfig[]` | -- | Array of transport configurations |
| `timestamp` | `boolean` | `true` | Include epoch-ms timestamp |

## Transport Reference

### Console

```typescript
{ type: "console", format?: "pretty" | "json", colorize?: boolean, destination?: "stdout" | "stderr", level?: LogLevel }
```

- `format` defaults to `"pretty"` when `NODE_ENV !== 'production'`, `"json"` otherwise.
- `colorize` only applies when `format` is `"pretty"`. Defaults to `true`.

### File

```typescript
{ type: "file", path: string, rotation?: "daily" | "hourly" | number, maxSize?: string | number, maxFiles?: number, mkdir?: boolean, level?: LogLevel }
```

- Writes JSON lines with automatic rotation.
- `rotation` defaults to `"daily"`. Can be `"hourly"` or a millisecond interval.
- `maxSize` accepts strings like `"10m"`, `"1g"` or byte numbers.
- `mkdir` defaults to `true` (creates log directory if missing).

### MongoDB

```typescript
{ type: "mongo", uri: string, database: string, collection?: string, batchSize?: number, flushInterval?: number, level?: LogLevel }
```

- Requires `mongodb` as a peer dependency.
- Batches inserts for throughput: flushes every `batchSize` (default 100) records or `flushInterval` (default 5000ms).
- Uses `insertMany({ ordered: false })` for maximum write speed.
- On failure: retries once, then drops the batch and writes a warning to stderr.

### SQL

```typescript
{ type: "sql", connection: object, table?: string, batchSize?: number, flushInterval?: number, level?: LogLevel }
```

- Requires `knex` + a database driver as peer dependencies.
- DB-agnostic: works with PostgreSQL, MySQL, SQLite, MSSQL.
- Same batching strategy as MongoDB.

**Expected table schema:**

```sql
CREATE TABLE logs (
  id          SERIAL PRIMARY KEY,
  level       INTEGER NOT NULL,
  timestamp   TIMESTAMP NOT NULL,
  message     TEXT NOT NULL,
  context     TEXT,
  data        JSONB NOT NULL
);
```

Adjust column types for your database dialect (e.g. `TEXT` instead of `JSONB` for MySQL/SQLite).

## Log Levels

| Level | Numeric | Usage |
| --- | --- | --- |
| `trace` | 10 | Fine-grained debugging |
| `debug` | 20 | Debugging information |
| `info` | 30 | Normal operation |
| `warn` | 40 | Potential issues |
| `error` | 50 | Errors that need attention |
| `fatal` | 60 | Unrecoverable errors |
| `silent` | -- | Disables logging |

## Test Dockers

```sh
docker run -d --name cau-postgres -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test -e POSTGRES_DB=cau_test -p 5432:5432 postgres:17-alpine

# Mongodb without authentication
docker run -d --name cau-mongodb -p 27017:27017 mongo:7.1.0
```
