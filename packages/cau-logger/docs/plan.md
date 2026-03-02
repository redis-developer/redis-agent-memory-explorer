# cau-logger -- Design Plan (v3 -- Final)

## Goal

Create an **opinionated logger wrapper** around [Pino](https://github.com/pinojs/pino) as the first package in the `packages/` monorepo (`packages/cau-logger`). A single `createLogger()` call declaratively wires console, file, MongoDB, and SQL transports. The public interface (`CauLogger`) is **library-agnostic** -- Pino is an implementation detail, swappable without breaking consumers. Vendored as `utils/cau-logger`.

---

## 1. Why Pino + Wrapper (not from scratch)

### What Pino gives us (free, battle-tested)

- **Fastest Node.js logger** -- native JSON serialization, low-overhead level checks
- Structured JSON output by default
- Child loggers with merged context
- Built-in redaction (path-based field masking)
- Error serializer with configurable depth
- Worker-thread transport architecture (`pino.transport()`) -- logging never blocks the main thread
- Pretty-printing via `pino-pretty` (dev mode)
- Massive community, constant improvements

### What we build on top

| Gap                                   | Our addition                                             |
| ------------------------------------- | -------------------------------------------------------- |
| No file transport with rotation       | Wire `pino-roll` (Pino ecosystem)                        |
| No MongoDB transport                  | Custom `mongo.transport.ts` with batched inserts         |
| No SQL transport                      | Custom `sql.transport.ts` with batched Knex inserts      |
| No declarative multi-transport config | `createLogger(config?)` wires everything from one object |
| Pino types leak to consumers          | `CauLogger` interface abstracts the engine entirely      |
| No sensible zero-config default       | `createLogger()` works with zero args                    |

### What we write vs what we reuse

| Layer                          | LOC (approx) | Source             |
| ------------------------------ | ------------ | ------------------ |
| Core logging engine            | 0            | Pino               |
| Console (JSON + pretty)        | 0            | Pino + pino-pretty |
| File transport + rotation      | 0            | pino-roll          |
| Mongo transport                | ~70          | **Our code**       |
| SQL transport                  | ~85          | **Our code**       |
| Wrapper / factory + wrapLogger | ~80          | **Our code**       |
| Types + constants              | ~100         | **Our code**       |
| Config mapper (build-targets)  | ~90          | **Our code**       |
| **Total custom code**          | **~425**     | --                 |

---

## 2. Architecture Overview

```
createLogger(config?)                    [packages/cau-logger]
  |
  |-- config defaults: level="info", transports=[{type:"console"}]
  |
  |-- buildTargets(config.transports) --> pino target[]
  |
  |-- pino.transport({ targets }) --> worker threads
  |     |-- "pino-pretty"              (console pretty -- dev)
  |     |-- "pino/file"                (console JSON -- prod)
  |     |-- "pino-roll"                (file + rotation)
  |     |-- "./mongo.transport.js"     (batched Mongo inserts)
  |     |-- "./sql.transport.js"       (batched SQL inserts)
  |
  |-- pino(options, transport) --> PinoLogger
  |
  |-- wrapLogger(pinoLogger, transport) --> CauLogger
       (library-agnostic interface -- Pino is hidden)
```

### Library-agnostic interface

`CauLogger` is our own type. **No Pino types appear in the public API.** The `wrapLogger` function is the abstraction boundary -- it wraps a Pino instance into our interface. If we swap Pino for Winston or a custom engine, only `logger.ts` changes; consumers don't touch a line.

```typescript
type LogMethod = {
  (msg: string, ...args: unknown[]): void;
  (obj: Record<string, unknown>, msg?: string, ...args: unknown[]): void;
};

type CauLogger = {
  trace: LogMethod;
  debug: LogMethod;
  info: LogMethod;
  warn: LogMethod;
  error: LogMethod;
  fatal: LogMethod;

  child: (bindings: Record<string, unknown>) => CauLogger;

  level: LogLevel; // get + set (runtime change)
  isLevelEnabled: (level: LogLevel) => boolean;

  flush: () => Promise<void>;
  close: () => Promise<void>;
};
```

### Defaults-first config

Every field in `LoggerConfig` is optional. `createLogger()` with zero args works:

```typescript
type LoggerConfig = {
  level?: LogLevel; // default: "info"
  context?: string; // default: none
  redact?: string[]; // default: none
  transports?: TransportConfig[]; // default: [{ type: "console" }]
  timestamp?: boolean; // default: true
};
```

### Transport design

**Console + File** -- delegated entirely to Pino ecosystem packages (`pino-pretty`, `pino/file`, `pino-roll`). Zero custom code.

**Mongo + SQL** -- custom worker-thread transport modules using `pino-abstract-transport`:

- Receive parsed log objects via async iterable
- Batch inserts: flush every **N records** or **M ms** (whichever first)
- Mongo: `insertMany({ ordered: false })` for max throughput
- SQL: `knex(table).insert(rows)` -- DB-agnostic (PG, MySQL, SQLite, MSSQL)
- Connection created inside worker (can't share across threads)
- On failure: retry once, drop batch + stderr warning (logger never crashes the app)
- Dynamic `import()` for peer deps (mongodb, knex) -- ESM + CJS compatible

---

## 3. Public API

### Exports

```typescript
// Runtime
export { createLogger };

// Types
export type {
  LogLevel,
  LogMethod,
  CauLogger,
  ConsoleTransportConfig,
  FileTransportConfig,
  MongoTransportConfig,
  SqlTransportConfig,
  TransportConfig,
  LoggerConfig,
};
```

### Usage

```typescript
// Zero config -- just works
const logger = createLogger();

// Override what you need
const logger = createLogger({ level: "debug" });

// Full multi-transport
const logger = createLogger({
  level: "debug",
  context: "OrderService",
  redact: ["password"],
  transports: [
    { type: "console", pretty: false },
    { type: "file", path: "./logs/app.log", frequency: "daily", maxFiles: 7 },
    { type: "mongo", uri: MONGO_URI, database: "myapp" },
    {
      type: "sql",
      knexConfig: { client: "pg", connection: PG_URL },
      table: "logs",
    },
  ],
});

// Child loggers
const reqLogger = logger.child({ requestId: req.id });

// Graceful shutdown
await logger.close();
```

---

## 4. Folder Structure

```
packages/
  cau-logger/
    src/
      index.ts                          -- barrel: createLogger + types
      logger.ts                         -- createLogger + wrapLogger
      logger.types.ts                   -- CauLogger, LogMethod, configs
      logger.constants.ts               -- defaults
      helpers/
        build-targets.util.ts           -- TransportConfig[] -> pino targets
        build-targets.util.test.ts      -- 12 tests
      transports/
        mongo.transport.ts              -- pino worker transport (MongoDB)
        mongo.transport.test.ts         -- 4 tests (real MongoDB)
        sql.transport.ts                -- pino worker transport (SQL/Knex)
        sql.transport.test.ts           -- 4 tests (real PostgreSQL)
      logger.test.ts                    -- 10 tests (core + console + file)
    package.json
    tsconfig.json
    vitest.config.ts
    SKILL.md                            -- agent vendoring instructions
    README.md                           -- full API reference
```

---

## 5. Dependencies

| Dependency                | Purpose                               | Type                |
| ------------------------- | ------------------------------------- | ------------------- |
| `pino`                    | Core engine (hidden behind CauLogger) | **prod**            |
| `pino-pretty`             | Pretty console output (dev)           | **prod**            |
| `pino-roll`               | File transport with rotation          | **prod**            |
| `pino-abstract-transport` | Base for custom transports            | **prod**            |
| `mongodb`                 | Mongo transport driver                | **peer** (optional) |
| `knex` + DB driver        | SQL transport                         | **peer** (optional) |
| `typescript`              | Build                                 | dev                 |
| `vitest`                  | Test runner                           | dev                 |
| `mongodb`                 | Mongo transport tests                 | dev                 |
| `knex` + `pg`             | SQL transport tests (PostgreSQL)      | dev                 |

---

## 6. Testing

### Strategy

Per `js-testing` skill: **zero mocks, real execution, real databases.**

| Test file                    | Tests  | What it hits                                                            |
| ---------------------------- | ------ | ----------------------------------------------------------------------- |
| `build-targets.util.test.ts` | 12     | Pure function -- config to pino targets mapping                         |
| `logger.test.ts`             | 10     | Real Pino logger, real file I/O, interface contract                     |
| `mongo.transport.test.ts`    | 4      | Real MongoDB (`MONGO_URI` env var, default `localhost:27017`)           |
| `sql.transport.test.ts`      | 4      | Real PostgreSQL (`PG_CONNECTION_URL` env var, default `localhost:5432`) |
| **Total**                    | **30** | **All passing**                                                         |

### Environment

| Env var             | Default                                        | Purpose               |
| ------------------- | ---------------------------------------------- | --------------------- |
| `MONGO_URI`         | `mongodb://localhost:27017`                    | Mongo transport tests |
| `PG_CONNECTION_URL` | `postgres://test:test@localhost:5432/cau_test` | SQL transport tests   |

### Docker commands for test databases

```bash
# MongoDB (if not already running)
docker run -d --name cau-mongo -p 27017:27017 mongo:7

# PostgreSQL
docker run -d --name cau-postgres \
  -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test -e POSTGRES_DB=cau_test \
  -p 5432:5432 postgres:17-alpine
```

---

## 7. Agentic Files

### `packages/cau-logger/SKILL.md`

Agent vendoring instructions per agentskills.io spec. Contains:

- Package identity (repo, path, destination)
- Version pinning rules
- Vendor command (git subtree or sparse checkout)
- `.vendor.json` schema for provenance tracking
- Post-vendor steps (npm install, env vars for DB transports)
- "Do not modify vendored code" policy

### `docs/SKILLS_INDEX.md` (repo root)

Maps agent capabilities to package paths:

- "structured logging" -> `packages/cau-logger`
- Future: "redis client" -> `packages/cau-redis`, etc.

Agents consult this index to decide which package to vendor.

---

## 8. Delivery Status

| Phase                        | Status | Details                                                                        |
| ---------------------------- | ------ | ------------------------------------------------------------------------------ |
| 1. Scaffold + Core + Console | DONE   | package.json, tsconfig, types, constants, createLogger, barrel                 |
| 2. File Transport            | DONE   | pino-roll wired via build-targets, tested with real file I/O                   |
| 3. Mongo Transport           | DONE   | Worker-thread transport, batched inserts, 4 tests against real MongoDB         |
| 4. SQL Transport             | DONE   | Worker-thread transport, batched Knex inserts, 4 tests against real PostgreSQL |
| 5. Interface Abstraction     | DONE   | CauLogger (library-agnostic), LogMethod, wrapLogger, defaults-first config     |
| 6. Agentic Files             | DONE   | SKILL.md (vendoring), SKILLS_INDEX.md (discovery)                              |
| 7. Plan + README             | DONE   | Plan updated, README with full API reference + SQL schema                      |

---

## 9. Resolved Questions

| Question                   | Resolution                                                                                   |
| -------------------------- | -------------------------------------------------------------------------------------------- |
| Custom logger vs Pino?     | Pino -- less code, battle-tested, community maintained                                       |
| Package prefix?            | `cau-` (custom-agent-utils) -- collision-proof, scannable                                    |
| Zero deps?                 | No -- dependencies are fine; agent-vendorable means self-contained entrypoint, not zero deps |
| Worker thread offloading?  | Pino does this by default for all transports                                                 |
| Log redaction?             | Pino's built-in `redact` option, exposed via config                                          |
| Error serialization depth? | Pino's `err` serializer handles it                                                           |
| File rotation?             | pino-roll (daily/hourly/size-based)                                                          |
| Pino types leaking?        | Solved -- CauLogger is our own interface, wrapLogger hides Pino                              |
| Config verbosity?          | Solved -- all fields optional, `createLogger()` works with zero args                         |
| Mongo connection pooling?  | MongoDB driver defaults (maxPoolSize=100), override via URI params                           |
| SQL schema?                | Documented in README, consumer creates the table                                             |
