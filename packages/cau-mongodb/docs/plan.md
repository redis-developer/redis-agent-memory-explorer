# cau-mongodb -- Design Plan

## Overview

A typed MongoDB CRUD utility package that wraps the native `mongodb` driver behind a generic, consumer-friendly API. All CRUD parameters are validated at runtime with **Zod schemas** and all operations are logged via **cau-logger**.

The package follows the **Singleton + factory** pattern (shared connection pool) consistent with `cau-logger` and `cau-api-server`.

---

## Goals

1. **Typed CRUD** -- expose `createOne`, `createMany`, `findOne`, `findMany`, `updateOne`, `updateMany`, `deleteOne`, `deleteMany` plus supplementary read utilities.
2. **Zod validation** -- every CRUD method accepts an optional Zod schema. Write operations validate input data before sending to MongoDB; read operations validate/transform returned documents.
3. **Logging** -- accept an optional `Logger` instance from `cau-logger`. If not provided, falls back to a default console-transport logger from `cau-logger`. Log connection lifecycle, every CRUD call (collection, operation, timing), and errors.
4. **Zero leakage** -- consumers never import from `mongodb` directly; all public types are package-owned.
5. **Connection management** -- connect, close, health-check, with configurable pool sizing and timeouts.
6. **Auto-managed fields** -- `createdAt`, `updatedAt`, and `status` are automatically injected on write operations so consumers never have to manage them manually.

---

## Folder Structure

```
packages/cau-mongodb/
  docs/
    plan.md
  src/
    helpers/
      validate-params.util.ts          # Zod-based param validation helpers
      validate-params.util.test.ts
      build-options.util.ts            # maps public option types to native driver options
      build-options.util.test.ts
      auto-fields.util.ts              # injects createdAt, updatedAt, status on write ops
      auto-fields.util.test.ts
    operations/
      connect.ts                       # connection lifecycle (connect, close, isConnected)
      connect.test.ts
      create.ts                        # createOne, createMany
      create.test.ts
      read.ts                          # findOne, findMany, countDocuments, distinct
      read.test.ts
      update.ts                        # updateOne, updateMany, findOneAndUpdate
      update.test.ts
      delete.ts                        # deleteOne, deleteMany, findOneAndDelete
      delete.test.ts
    constants.ts                       # UPPER_SNAKE_CASE defaults, string-literal const objects
    config.ts                          # dotenv + typed ENV
    types.ts                           # all public + internal types
    mongo-db.ts                        # thin public class -- delegates to operations/
    index.ts                           # barrel -- re-exports public API
  test.env
  vitest.setup.ts
  vitest.config.ts
  tsconfig.json
  package.json
  SKILL.md
  README.md
```

The `MongoDb` class in `mongo-db.ts` is intentionally thin -- it holds state (client, db, logger) and delegates every CRUD call to the matching function in `operations/`. Each operation file exports standalone functions that receive the `Db` handle and `Logger` as parameters, keeping files small and testable independently.

---

## Public Class -- `MongoDb`

### Pattern: Singleton + factory

```
MongoDb.create(config)       -> new instance with its own connection
MongoDb.getInstance(config?) -> singleton (lazy-created)
MongoDb.reset()              -> clear singleton
```

### Connection Lifecycle

| Method             | Description                                                                                           |
| ------------------ | ----------------------------------------------------------------------------------------------------- |
| `connect()`        | Opens the connection pool. Called automatically on first CRUD call if not already connected.          |
| `close()`          | Drains the pool and closes the connection.                                                            |
| `isConnected()`    | Returns `true` if the underlying client is connected.                                                 |
| `collection(name)` | Escape hatch -- returns the raw native `Collection` for advanced queries not covered by CRUD methods. |

### CRUD Methods

All methods are generic: `<T>` represents the document shape.

#### Create

| Method       | Signature                                                    |
| ------------ | ------------------------------------------------------------ |
| `createOne`  | `(params: CreateOneParams<T>) => Promise<CreateOneResult>`   |
| `createMany` | `(params: CreateManyParams<T>) => Promise<CreateManyResult>` |

#### Read

| Method           | Signature                                           |
| ---------------- | --------------------------------------------------- |
| `findOne`        | `(params: FindOneParams<T>) => Promise<T \| null>`  |
| `findMany`       | `(params: FindManyParams<T>) => Promise<T[]>`       |
| `countDocuments` | `(params: CountDocumentsParams) => Promise<number>` |
| `distinct`       | `(params: DistinctParams<T>) => Promise<T[]>`       |

#### Update

| Method             | Signature                                                    |
| ------------------ | ------------------------------------------------------------ |
| `updateOne`        | `(params: UpdateOneParams<T>) => Promise<UpdateOneResult>`   |
| `updateMany`       | `(params: UpdateManyParams<T>) => Promise<UpdateManyResult>` |
| `findOneAndUpdate` | `(params: FindOneAndUpdateParams<T>) => Promise<T \| null>`  |

#### Delete (soft delete -- sets `status: 0`, never removes documents)

| Method             | Signature                                                   |
| ------------------ | ----------------------------------------------------------- |
| `deleteOne`        | `(params: DeleteOneParams) => Promise<DeleteOneResult>`     |
| `deleteMany`       | `(params: DeleteManyParams) => Promise<DeleteManyResult>`   |
| `findOneAndDelete` | `(params: FindOneAndDeleteParams<T>) => Promise<T \| null>` |

---

## Zod Integration

### Strategy

Every CRUD params type includes an **optional** `schema` field of type `ZodType<T>`.

- **Create** (`createOne`, `createMany`): the `schema` validates and transforms input documents **before** insertion. If validation fails, throw a descriptive error without hitting MongoDB.
- **Read** (`findOne`, `findMany`, `findOneAndUpdate`, `findOneAndDelete`): the `schema` parses returned documents **after** retrieval. This strips unknown fields and applies Zod transforms, giving consumers clean typed output.
- **Update** (`updateOne`, `updateMany`, `findOneAndUpdate`): the `schema` validates the `$set` / replacement portion of the update payload before sending to MongoDB.

### Example

```typescript
import { z } from "zod";

const UserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().int().positive().optional(),
});

// createOne -- validates input
await db.createOne({
  collection: "users",
  doc: { name: "Alice", email: "alice@example.com", age: 30 },
  schema: UserSchema,
});

// findOne -- validates/transforms output
const user = await db.findOne({
  collection: "users",
  filter: { email: "alice@example.com" },
  schema: UserSchema,
});
```

### Validation Error Handling

When Zod validation fails:

1. Log the validation error via `cau-logger` (level: `error`, include collection name, operation, Zod issues).
2. Throw a `MongoDbValidationError` (custom error class) containing the Zod issues array and a human-readable message.
3. Never send invalid data to MongoDB.

---

## Auto-Managed Fields

Every document written through `cau-mongodb` automatically gets common bookkeeping fields. Consumers never have to set these manually.

### Fields

| Field       | Type     | On Create                          | On Update           | Description                                     |
| ----------- | -------- | ---------------------------------- | ------------------- | ----------------------------------------------- |
| `status`    | `number` | Set to `DocumentStatus.ACTIVE` (1) | Not touched         | Soft-delete flag. `1` = active, `0` = inactive. |
| `createdAt` | `Date`   | Set to `new Date()`                | Not touched         | Timestamp of document creation.                 |
| `updatedAt` | `Date`   | Set to `new Date()`                | Set to `new Date()` | Timestamp of last modification.                 |

### Constants

```typescript
const DocumentStatus = {
  ACTIVE: 1,
  INACTIVE: 0,
} as const;
type DocumentStatus = (typeof DocumentStatus)[keyof typeof DocumentStatus];
```

### Behavior by Operation

- **`createOne` / `createMany`** -- merges `{ status: DocumentStatus.ACTIVE, createdAt: new Date(), updatedAt: new Date() }` into each document before insertion. Consumer-supplied values for these fields are **not** overwritten (consumer wins).
- **`updateOne` / `updateMany` / `findOneAndUpdate`** -- injects `updatedAt: new Date()` into the `$set` portion of the update. Auto-adds `status: DocumentStatus.ACTIVE` to the filter so only active documents are updated. If the consumer already set `updatedAt` in their `$set`, the consumer value wins.
- **`deleteOne` / `deleteMany` / `findOneAndDelete`** -- these are **soft deletes**. Under the hood they set `{ $set: { status: DocumentStatus.INACTIVE, updatedAt: new Date() } }`. The document remains in the database.
- **`findOne` / `findMany` / `countDocuments` / `distinct`** -- auto-adds `status: DocumentStatus.ACTIVE` to the filter so soft-deleted documents are completely invisible.

### Soft Delete -- No Hard Deletes

All delete operations are soft deletes. Documents are never physically removed from MongoDB. This is a deliberate production-safety decision -- deleted data cannot be recovered from a hard delete. Admins can periodically clean up inactive documents directly via the `collection(name)` escape hatch or a database admin tool.

- `deleteOne` / `deleteMany` set `status: 0` (inactive) on matching documents.
- `findOneAndDelete` sets `status: 0` and returns the document after the status change.
- Soft-deleted documents are completely invisible to all CRUD methods -- no option to query them. Use the `collection(name)` escape hatch for direct access when needed.

### Helper

Auto-field injection lives in `src/helpers/auto-fields.util.ts` to keep it isolated and testable.

---

## Optimistic Concurrency Control (Conflict Detection)

A production-critical feature for update operations. Prevents silent data overwrites when two processes update the same document concurrently.

### How It Works

Standard optimistic locking via the filter. The consumer includes `_id` + `updatedAt` in the filter -- both values come from the last read. No special params needed; it's just part of the normal filter.

1. **Consumer reads a document** -- gets back `{ _id: "abc", name: "Alice", updatedAt: 2026-03-04T10:00:00Z }`.
2. **Consumer updates** -- includes both `_id` and `updatedAt` in the filter:
   ```typescript
   await db.updateOne({
     collection: "users",
     filter: { _id: "abc", updatedAt: new Date("2026-03-04T10:00:00Z") },
     update: { $set: { name: "Bob" } },
   });
   ```
3. **No conflict** -- filter matches (both `_id` and `updatedAt` match the current doc), document is updated, new `updatedAt` is auto-set by auto-fields.
4. **Conflict** -- another process already updated the document (changing its `updatedAt`), so the filter matches zero docs (`matchedCount: 0`). The package detects `updatedAt` in the filter and throws `MongoDbConflictError`.

### No Conflict Check (Force Overwrite)

If the consumer does not want conflict detection, they simply omit `updatedAt` from the filter:

```typescript
await db.updateOne({
  collection: "users",
  filter: { _id: "abc" },
  update: { $set: { name: "Bob" } },
});
```

No `updatedAt` in filter = no conflict check. The update goes through unconditionally.

### Package Behavior

The package checks if `updatedAt` is present in the consumer's filter:

- **`updatedAt` in filter + `matchedCount === 0`** -- the document was modified by another process since the consumer last read it. Throw `MongoDbConflictError`.
- **`updatedAt` in filter + `matchedCount > 0`** -- no conflict, update succeeded normally.
- **`updatedAt` not in filter** -- no conflict detection; normal update, return result as-is.

### Applies To

| Method             | Conflict detection                       | Rationale                                                                           |
| ------------------ | ---------------------------------------- | ----------------------------------------------------------------------------------- |
| `updateOne`        | Yes (auto-detects `updatedAt` in filter) | Single-doc update, classic conflict scenario.                                       |
| `findOneAndUpdate` | Yes (auto-detects `updatedAt` in filter) | Same as updateOne but returns the updated document.                                 |
| `updateMany`       | No                                       | Bulk updates target many docs by query; per-doc concurrency check is not practical. |

### Custom Error Class

```typescript
class MongoDbConflictError extends Error {
  collection: string;
  operation: string; // "updateOne" or "findOneAndUpdate"
  filter: Record<string, unknown>;
}
```

The error message states that the document was modified by another process since the consumer last read it, and suggests re-reading the document and retrying.

### Logging

| Event             | Log Level | Data                                   |
| ----------------- | --------- | -------------------------------------- |
| Conflict detected | `warn`    | collection, operation, filter, message |

### Flow Summary

```
updatedAt in filter?
  ├─ No  -> normal update, return result
  └─ Yes
       ├─ execute update
       ├─ matchedCount > 0  -> success, return result
       └─ matchedCount === 0  -> throw MongoDbConflictError
```

---

## Types (`types.ts`)

### Config

```typescript
type MongoDbConfig = {
  uri: string;
  database: string;
  logger?: Logger;
  connectTimeoutMs?: number;
  maxPoolSize?: number;
  minPoolSize?: number;
};
```

### CRUD Param Types

Each param type follows a consistent shape:

```typescript
type CreateOneParams<T> = {
  collection: string;
  doc: T;
  schema?: ZodType<T>;
};

type CreateManyParams<T> = {
  collection: string;
  docs: T[];
  schema?: ZodType<T>;
  ordered?: boolean;
};

type FindOneParams<T> = {
  collection: string;
  filter: Record<string, unknown>;
  projection?: Record<string, 0 | 1>;
  schema?: ZodType<T>;
};

type FindManyParams<T> = {
  collection: string;
  filter: Record<string, unknown>;
  projection?: Record<string, 0 | 1>;
  sort?: Record<string, 1 | -1>;
  limit?: number;
  skip?: number;
  schema?: ZodType<T>;
};

type CountDocumentsParams = {
  collection: string;
  filter?: Record<string, unknown>;
};

type DistinctParams<T> = {
  collection: string;
  field: string;
  filter?: Record<string, unknown>;
  schema?: ZodType<T>;
};

type UpdateOneParams<T> = {
  collection: string;
  filter: Record<string, unknown>; // include updatedAt for conflict detection
  update: Record<string, unknown>;
  schema?: ZodType<T>;
  upsert?: boolean; //default: false
};

type UpdateManyParams<T> = {
  collection: string;
  filter: Record<string, unknown>;
  update: Record<string, unknown>;
  schema?: ZodType<T>;
  upsert?: boolean; //default: false
};

// findOneAndUpdate always returns the document *after* the mutation.
type FindOneAndUpdateParams<T> = {
  collection: string;
  filter: Record<string, unknown>; // include updatedAt for conflict detection
  update: Record<string, unknown>; // supports $set for patch updates
  schema?: ZodType<T>;
  upsert?: boolean;
};

// Soft delete -- sets status: 0,updatedAt: new Date() does NOT remove the document.
type DeleteOneParams = {
  collection: string;
  filter: Record<string, unknown>;
};

type DeleteManyParams = {
  collection: string;
  filter: Record<string, unknown>;
};

// Soft delete -- sets status: 0,updatedAt: new Date() and returns the document after the change.
type FindOneAndDeleteParams<T> = {
  collection: string;
  filter: Record<string, unknown>;
  schema?: ZodType<T>;
};
```

### Result Types

```typescript
type CreateOneResult = {
  insertedId: string;
  acknowledged: boolean;
};

type CreateManyResult = {
  insertedIds: string[];
  insertedCount: number;
  acknowledged: boolean;
};

type UpdateOneResult = {
  matchedCount: number;
  modifiedCount: number;
  upsertedId: string | null;
  acknowledged: boolean;
};

type UpdateManyResult = {
  matchedCount: number;
  modifiedCount: number;
  upsertedCount: number;
  acknowledged: boolean;
};

// Soft delete results -- "deletedCount" means "documents marked inactive"
type DeleteOneResult = {
  deletedCount: number; // 0 or 1 -- docs set to status: 0
  acknowledged: boolean;
};

type DeleteManyResult = {
  deletedCount: number; // docs set to status: 0
  acknowledged: boolean;
};
```

---

## Constants (`constants.ts`)

```typescript
const DEFAULT_CONNECT_TIMEOUT_MS = 10000;
const DEFAULT_MAX_POOL_SIZE = 10;
const DEFAULT_MIN_POOL_SIZE = 1;

const DocumentStatus = {
  ACTIVE: 1,
  INACTIVE: 0,
} as const;
type DocumentStatus = (typeof DocumentStatus)[keyof typeof DocumentStatus];
```

---

## Helpers (`src/helpers/`)

### `validate-params.util.ts`

- `validateWithSchema<T>(data: unknown, schema: ZodType<T>, context: ValidationContext): T` -- runs `schema.parse(data)`, catches `ZodError`, wraps it in `MongoDbValidationError`, logs via logger.
- `validateManyWithSchema<T>(docs: unknown[], schema: ZodType<T>, context: ValidationContext): T[]` -- validates an array of documents, collects all errors.

### `build-options.util.ts`

- `buildFindOptions(params: FindManyParams<unknown>): FindOptions` -- maps `projection`, `sort`, `limit`, `skip` to native driver `FindOptions`.
- `buildUpdateOptions(params: { upsert?: boolean }): UpdateOptions` -- maps upsert flag.

### `auto-fields.util.ts`

- `applyCreateFields<T>(doc: T): T & AutoFields` -- merges `status`, `createdAt`, `updatedAt` into a document for insertion. Consumer-supplied values are preserved (consumer wins).
- `applyCreateFieldsMany<T>(docs: T[]): (T & AutoFields)[]` -- same as above for an array.
- `applyUpdateFields(update: Record<string, unknown>): Record<string, unknown>` -- injects `updatedAt: new Date()` into the `$set` portion of an update document. Creates `$set` if not present.
- `applyActiveFilter(filter: Record<string, unknown>): Record<string, unknown>` -- merges `status: DocumentStatus.ACTIVE` into the filter. Applied to all read, update, and delete operations.
- `buildSoftDeleteUpdate(): Record<string, unknown>` -- returns `{ $set: { status: DocumentStatus.INACTIVE, updatedAt: new Date() } }` for soft-delete operations.

---

## Error Handling

### Custom Error Classes

```typescript
class MongoDbValidationError extends Error {
  issues: ZodIssue[];
  collection: string;
  operation: string; // plain method name, e.g. "createOne", "findMany"
}

class MongoDbConflictError extends Error {
  collection: string;
  operation: string; // "updateOne" or "findOneAndUpdate"
  filter: Record<string, unknown>;
}
```

### Logging Strategy

| Event                  | Log Level | Data                                               |
| ---------------------- | --------- | -------------------------------------------------- |
| Connection opened      | `info`    | uri (redacted), database                           |
| Connection closed      | `info`    | database                                           |
| Connection error       | `error`   | error message                                      |
| CRUD operation start   | `debug`   | collection, operation, filter (if applicable)      |
| CRUD operation success | `debug`   | collection, operation, duration ms, affected count |
| CRUD operation error   | `error`   | collection, operation, error message               |
| Validation failure     | `warn`    | collection, operation, Zod issues                  |
| Conflict detected      | `warn`    | collection, operation, filter (with updatedAt)     |

---

## Config (`config.ts`)

```typescript
const ENV = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  MONGODB_URI: process.env.MONGODB_URI ?? "mongodb://localhost:27017",
  MONGODB_DATABASE: process.env.MONGODB_DATABASE ?? "test",
} as const;
```

---

## Dependencies

### `package.json`

```json
{
  "name": "cau-mongodb",
  "version": "0.1.0",
  "dependencies": {
    "mongodb": "^6.12.0",
    "zod": "^3.24.0",
    "dotenv": "^16.4.5",
    "cau-logger": "file:../cau-logger"
  },
  "devDependencies": {
    "@types/node": "^25.3.3",
    "typescript": "^5.9.3",
    "vitest": "^4.0.18"
  }
}
```

- `mongodb` -- the native driver (direct dependency since this package is all about MongoDB).
- `zod` -- runtime validation (direct dependency; core to the CRUD contract).
- `cau-logger` -- direct dependency. If consumer does not pass a `Logger` instance in config, `MongoDb` creates a default console-transport logger internally via `Logger.create({ context: "MongoDb", transports: [{ type: "console" }] })`.

---

## Testing Strategy

### Prerequisites

- A local MongoDB instance (or Docker container) accessible at the URI in `test.env`.
- Tests use a dedicated test database that is cleaned between runs.

### `test.env`

```env
MONGODB_URI=mongodb://localhost:27017
MONGODB_DATABASE=cau_mongodb_test
```

### Test Plan

| Area             | Test File                              | What to test                                                                                                                                                                                                                                     |
| ---------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Connection       | `operations/connect.test.ts`           | connect/close lifecycle, isConnected, singleton behavior, lazy connect                                                                                                                                                                           |
| Create           | `operations/create.test.ts`            | createOne, createMany with real MongoDB, Zod validation pass/fail, auto-fields injected                                                                                                                                                          |
| Read             | `operations/read.test.ts`              | findOne, findMany, countDocuments, distinct with real MongoDB, Zod output parsing, soft-deleted docs completely invisible                                                                                                                        |
| Update           | `operations/update.test.ts`            | updateOne, updateMany, findOneAndUpdate (patch via $set), auto updatedAt injection, only active docs updated, conflict detection (updatedAt in filter + matchedCount 0 throws MongoDbConflictError), no updatedAt in filter skips conflict check |
| Delete           | `operations/delete.test.ts`            | deleteOne sets status: 0 (doc still in DB), deleteMany marks multiple inactive, findOneAndDelete returns doc after soft-delete, soft-deleted doc invisible to subsequent reads                                                                   |
| Param validation | `helpers/validate-params.util.test.ts` | valid data passes, invalid data throws `MongoDbValidationError` with correct issues                                                                                                                                                              |
| Option builders  | `helpers/build-options.util.test.ts`   | correctly maps public types to native driver options                                                                                                                                                                                             |
| Auto fields      | `helpers/auto-fields.util.test.ts`     | createdAt/updatedAt/status injected on create, updatedAt on update, consumer values preserved, active-status filter injection, soft-delete update builder                                                                                        |

### Docker Command for Tests

```bash
docker run -d --name cau-mongodb-test -p 27017:27017 mongo:7
```

---

## Implementation Order

1. **Scaffold** -- create folder structure, `package.json`, `tsconfig.json`, `vitest.config.ts`, `vitest.setup.ts`, `test.env`, `config.ts`.
2. **Constants** -- `constants.ts` with defaults, `DocumentStatus`.
3. **Types** -- `types.ts` with all CRUD param types, result types, config type.
4. **Helpers** -- `validate-params.util.ts`, `build-options.util.ts`, `auto-fields.util.ts` + their tests.
5. **Operations** -- `connect.ts`, `create.ts`, `read.ts`, `update.ts`, `delete.ts` + their tests.
6. **MongoDb class** -- thin `mongo-db.ts` that holds state and delegates to operations.
7. **Barrel** -- `index.ts` re-exporting public API.
8. **Docs** -- `SKILL.md`, `README.md`.
9. **Register** -- add entry to `PACKAGE_INDEX.md`.

---

## Decisions (Resolved)

| #   | Question                                                         | Decision                                                                                                                                                                                                                                                                                                                               |
| --- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Should `connect()` be auto-called on first CRUD operation?       | **Yes** -- lazy connect via singleton connection. Explicit `connect()` available for eager init.                                                                                                                                                                                                                                       |
| 2   | Should `cau-logger` be a peer dep or direct dep?                 | **Direct dep** -- if consumer does not pass a `Logger`, the package creates a default console-transport logger internally.                                                                                                                                                                                                             |
| 3   | Should we expose a raw `collection(name)` escape hatch?          | **Yes** -- exposed from v0.1 for advanced queries not covered by CRUD methods.                                                                                                                                                                                                                                                         |
| 4   | Should Zod be a peer dep?                                        | **No** -- direct dep, core to the CRUD validation contract.                                                                                                                                                                                                                                                                            |
| 5   | Should `findMany` support cursor/pagination helpers?             | **v0.1 uses `skip`/`limit`** -- cursor-based pagination can be added later.                                                                                                                                                                                                                                                            |
| 6   | Is `CrudOperation` constant needed?                              | **No** -- just use plain method name strings in error messages. Removed.                                                                                                                                                                                                                                                               |
| 7   | Should `findOneAndUpdate` support `returnDocument` before/after? | **No** -- always returns "after". No option, no confusion.                                                                                                                                                                                                                                                                             |
| 8   | How to handle concurrent update conflicts?                       | **Optimistic concurrency** via filter. Consumer includes `updatedAt` in the filter (from last read). Package auto-detects it: `matchedCount === 0` throws `MongoDbConflictError`. Omit `updatedAt` from filter to skip the check. No separate params needed.                                                                           |
| 9   | Hard delete or soft delete?                                      | **Soft delete only.** `deleteOne`/`deleteMany`/`findOneAndDelete` set `status: 0`, never remove documents. All reads and updates auto-filter by `status: 1` (active). Soft-deleted docs are completely invisible to CRUD methods -- no option to query them. Admins clean up periodically via `collection()` escape hatch or DB tools. |
