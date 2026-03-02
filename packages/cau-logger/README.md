# cau-logger

Fast, multi-transport logger built on [Pino](https://github.com/pinojs/pino) for [custom-agent-utils](https://github.com/maakrupa/custom-agent-utils).

Provides a single `createLogger` call that declaratively wires console, file, MongoDB, and SQL transports. All heavy I/O runs in Pino worker threads -- logging never blocks the main thread.

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
import { createLogger } from "cau-logger";

const logger = createLogger({
  level: "info",
  context: "AppBootstrap",
  transports: [{ type: "console", pretty: true }],
});

logger.info("Server started on port 3000");
logger.error({ err }, "Unhandled rejection");
```

## Multi-Transport

```typescript
import { createLogger } from "cau-logger";

const logger = createLogger({
  level: "debug",
  redact: ["password", "req.headers.authorization"],
  transports: [
    { type: "console", pretty: false },
    { type: "file", path: "./logs/app.log", frequency: "daily", maxFiles: 7 },
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
      knexConfig: { client: "pg", connection: process.env.DATABASE_URL },
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
// => { ..., requestId: "abc-123", userId: "u-42", msg: "Processing order" }
```

## Graceful Shutdown

```typescript
process.on("SIGTERM", async () => {
  await logger.close();
  process.exit(0);
});
```

## API

### `createLogger(config: LoggerConfig): CauLogger`

Creates a Pino logger with the given transports.

**LoggerConfig:**

| Field        | Type                | Default  | Description                                 |
| ------------ | ------------------- | -------- | ------------------------------------------- |
| `level`      | `LogLevel`          | `"info"` | Minimum log level                           |
| `context`    | `string`            | --       | Persistent context label added to every log |
| `redact`     | `string[]`          | --       | Paths to redact (e.g. `["password"]`)       |
| `transports` | `TransportConfig[]` | --       | Array of transport configurations           |
| `timestamp`  | `boolean`           | `true`   | Include epoch-ms timestamp                  |

### `flushAsync(logger: Logger): Promise<void>`

Promisified wrapper around Pino's callback-based `flush()`.

### `CauLogger`

Extends Pino's `Logger` with:

- `close(): Promise<void>` -- flushes all transports and ends the transport stream.

All standard Pino methods are available: `trace`, `debug`, `info`, `warn`, `error`, `fatal`, `child`, `flush`, `isLevelEnabled`, etc.

## Transport Reference

### Console

```typescript
{ type: "console", pretty?: boolean, colorize?: boolean, destination?: "stdout" | "stderr", level?: LogLevel }
```

- `pretty` defaults to `true` when `NODE_ENV !== 'production'`, `false` otherwise.
- Uses `pino-pretty` for human-readable output, raw JSON via `pino/file` otherwise.

### File

```typescript
{ type: "file", path: string, frequency?: "daily" | "hourly" | number, maxSize?: string | number, maxFiles?: number, mkdir?: boolean, level?: LogLevel }
```

- Powered by `pino-roll`. Writes JSON lines.
- `frequency` defaults to `"daily"`. Can be `"hourly"` or milliseconds.
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

### SQL (via Knex)

```typescript
{ type: "sql", knexConfig: object, table?: string, batchSize?: number, flushInterval?: number, level?: LogLevel }
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

| Level    | Numeric | Usage                      |
| -------- | ------- | -------------------------- |
| `trace`  | 10      | Fine-grained debugging     |
| `debug`  | 20      | Debugging information      |
| `info`   | 30      | Normal operation           |
| `warn`   | 40      | Potential issues           |
| `error`  | 50      | Errors that need attention |
| `fatal`  | 60      | Unrecoverable errors       |
| `silent` | --      | Disables logging           |

## Test Dockers

```sh
docker run -d --name cau-postgres -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test -e POSTGRES_DB=cau_test -p 5432:5432 postgres:17-alpine

# Mongodb without authentication
docker run -d --name cau-mongodb -p 27017:27017 mongo:7.1.0
```
