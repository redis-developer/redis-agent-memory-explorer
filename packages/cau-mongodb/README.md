# cau-mongodb

Typed MongoDB CRUD utility with Zod validation, auto-managed fields, soft deletes, and optimistic concurrency control. Built on the native `mongodb` driver.

## Install

```bash
npm install cau-mongodb
```

Dependencies installed automatically: `mongodb`, `zod`, `cau-logger`.

## Quick Start

```typescript
import { z } from "zod";
import { MongoDb } from "cau-mongodb";

const instance = MongoDb.create({
  uri: "mongodb://localhost:27017",
  database: "myapp",
});

const UserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

// Insert a document (auto-adds createdAt, updatedAt, status)
const { insertedId } = await instance.createOne({
  collection: "users",
  doc: { name: "Alice", email: "alice@example.com" },
  schema: UserSchema,
});

// Find a document (only active documents are returned)
const user = await instance.findOne({
  collection: "users",
  filter: { email: "alice@example.com" },
});

// Close when done
await instance.close();
```

## Singleton

```typescript
// Bootstrap: create() initializes and stores the singleton.
const instance = MongoDb.create({
  uri: process.env.MONGODB_URI!,
  database: process.env.MONGODB_DATABASE!,
});

// Elsewhere in the app -- retrieve the same instance.
const same = MongoDb.getInstance();
```

## Full API

### Connection Lifecycle

| Method | Signature | Description |
|---|---|---|
| `connect` | `() => Promise<void>` | Opens the connection pool. Auto-called on first CRUD operation if not already connected. |
| `close` | `() => Promise<void>` | Drains the pool and closes the connection. |
| `isConnected` | `() => boolean` | Returns `true` if the client is connected. |
| `collection` | `(name: string) => Collection` | Escape hatch -- returns the raw native `Collection` for advanced queries. |

### Create

| Method | Signature | Description |
|---|---|---|
| `createOne` | `<T>(params: CreateOneParams<T>) => Promise<CreateOneResult>` | Insert a single document. |
| `createMany` | `<T>(params: CreateManyParams<T>) => Promise<CreateManyResult>` | Insert multiple documents. |

### Read

| Method | Signature | Description |
|---|---|---|
| `findOne` | `<T>(params: FindOneParams<T>) => Promise<T \| null>` | Find a single document. |
| `findMany` | `<T>(params: FindManyParams<T>) => Promise<T[]>` | Find multiple documents with sort/limit/skip. |
| `countDocuments` | `(params: CountDocumentsParams) => Promise<number>` | Count matching active documents. |
| `distinct` | `<T>(params: DistinctParams<T>) => Promise<T[]>` | Get distinct values for a field. |

### Update

| Method | Signature | Description |
|---|---|---|
| `updateOne` | `<T>(params: UpdateOneParams<T>) => Promise<UpdateOneResult>` | Update a single document. |
| `updateMany` | `<T>(params: UpdateManyParams<T>) => Promise<UpdateManyResult>` | Update multiple documents. |
| `findOneAndUpdate` | `<T>(params: FindOneAndUpdateParams<T>) => Promise<T \| null>` | Update and return the document (always returns "after"). |

### Delete (Soft Delete)

All delete operations set `status: 0` -- documents are never physically removed.

| Method | Signature | Description |
|---|---|---|
| `deleteOne` | `(params: DeleteOneParams) => Promise<DeleteOneResult>` | Soft-delete a single document. |
| `deleteMany` | `(params: DeleteManyParams) => Promise<DeleteManyResult>` | Soft-delete multiple documents. |
| `findOneAndDelete` | `<T>(params: FindOneAndDeleteParams<T>) => Promise<T \| null>` | Soft-delete and return the document. |

## Config Reference

| Field | Type | Default | Description |
|---|---|---|---|
| `uri` | `string` | -- (required) | MongoDB connection string. |
| `database` | `string` | -- (required) | Database name. |
| `logger` | `Logger` | Console logger | Optional `cau-logger` instance. |
| `connectTimeoutMs` | `number` | `10000` | Connection timeout in milliseconds. |
| `maxPoolSize` | `number` | `10` | Maximum connection pool size. |
| `minPoolSize` | `number` | `1` | Minimum connection pool size. |

## Auto-Managed Fields

| Field | Type | On Create | On Update | Description |
|---|---|---|---|---|
| `status` | `number` | `1` (active) | Not touched | Soft-delete flag. `1` = active, `0` = inactive. |
| `createdAt` | `Date` | `new Date()` | Not touched | Timestamp of document creation. |
| `updatedAt` | `Date` | `new Date()` | `new Date()` | Timestamp of last modification. |

Consumer-supplied values for these fields are preserved (consumer wins).

## Zod Validation

Pass an optional `schema` to any CRUD method:

- **Create**: validates input documents before insertion.
- **Read**: validates/transforms returned documents after retrieval.
- **Update**: validates the `$set` portion of the update payload.

```typescript
import { z } from "zod";

const UserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

await instance.createOne({
  collection: "users",
  doc: { name: "Alice", email: "alice@example.com" },
  schema: UserSchema,
});
```

Validation failures throw `MongoDbValidationError` with Zod issues.

## Optimistic Concurrency

Include `updatedAt` in the filter for conflict detection:

```typescript
await instance.updateOne({
  collection: "users",
  filter: { _id: "abc", updatedAt: lastReadDate },
  update: { $set: { name: "Bob" } },
});
```

If the document was modified since `lastReadDate`, throws `MongoDbConflictError`. Omit `updatedAt` to skip the check.

## Error Classes

| Class | When Thrown |
|---|---|
| `MongoDbValidationError` | Zod schema validation fails (contains `.issues`, `.collection`, `.operation`). |
| `MongoDbConflictError` | Optimistic concurrency conflict detected (contains `.collection`, `.operation`, `.filter`). |

## Test Docker

```bash
docker run -d --name cau-mongodb-test -p 27017:27017 mongo:7
```

## License

MIT
