---
name: cau-mongodb
description: Typed MongoDB CRUD utility with Zod validation, auto-managed fields, soft deletes, and optimistic concurrency. Use when the application needs a MongoDB data layer.
metadata:
  author: prasan
  version: "0.1.0"
  repo: git@github.com:PrasanKumar93/custom-agent-utils.git
  path: packages/cau-mongodb
  dest: packages/cau-mongodb
---

# cau-mongodb

Typed MongoDB CRUD utility with Zod validation, auto-managed fields (`createdAt`, `updatedAt`, `status`), soft deletes, and optimistic concurrency control.

For full API reference see [README.md](./README.md).

## When to Use

Vendor this package when the user needs:
- A typed MongoDB CRUD layer with `createOne`, `createMany`, `findOne`, `findMany`, `updateOne`, `updateMany`, `deleteOne`, `deleteMany`
- Zod schema validation on write and read operations
- Auto-managed `createdAt`, `updatedAt`, and `status` fields
- Soft deletes (documents are never physically removed)
- Optimistic concurrency control via `updatedAt` in the filter

## Vendoring

Sparse checkout + copy. The `--branch` flag accepts a git tag (preferred) or `main`.

```bash
CAU_REF="<git-tag-or-main>"
TMPDIR=$(mktemp -d)
git clone --depth 1 --branch "$CAU_REF" --filter=blob:none --sparse \
  git@github.com:PrasanKumar93/custom-agent-utils.git "$TMPDIR"
cd "$TMPDIR" && git sparse-checkout set packages/cau-mongodb packages/cau-logger
cp -r "$TMPDIR/packages/cau-mongodb" <your-project>/packages/cau-mongodb
cp -r "$TMPDIR/packages/cau-logger" <your-project>/packages/cau-logger
rm -rf "$TMPDIR"
```

### After vendoring

```bash
cd packages/cau-logger && npm install && npm run build && cd ../..
cd packages/cau-mongodb && npm install && npm run build
```

### Provenance file

After vendoring, create `packages/cau-mongodb/.vendor.json`:

```json
{
  "source": "git@github.com:PrasanKumar93/custom-agent-utils.git",
  "package": "packages/cau-mongodb",
  "tag": "<git-tag-or-main>",
  "vendoredAt": "<ISO-8601 date>",
  "forked": false
}
```

### Updating

Re-run the sparse checkout commands above with the new `CAU_REF`, then:

```bash
cd packages/cau-mongodb && npm install && npm run build
```

Update `.vendor.json` with the new `tag` and `vendoredAt`.

## Quick usage (vendored path)

```typescript
import { MongoDb } from "cau-mongodb";

const db = MongoDb.create({
  uri: process.env.MONGODB_URI!,
  database: process.env.MONGODB_DATABASE!,
});

await db.createOne({ collection: "users", doc: { name: "Alice" } });
const user = await db.findOne({ collection: "users", filter: { name: "Alice" } });
await db.close();
```

See [README.md](./README.md) for Zod validation, optimistic concurrency, soft deletes, and full API.

## Rules

- Do NOT modify vendored code. Extend via adapters or wrappers.
- If you must modify, update `.vendor.json` to mark `"forked": true`.
- Connection strings / secrets must come from environment variables.
