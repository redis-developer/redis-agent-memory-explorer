---
name: cau-logger
description: Fast, multi-transport structured logger (console, file, MongoDB, SQL). Built on Pino with a class-based Logger exposing static factory and singleton methods. Use when the user needs logging with any combination of console, file, MongoDB, or relational database output.
metadata:
  author: prasan
  version: "0.2.0"
  repo: git@github.com:PrasanKumar93/custom-agent-utils.git
  path: packages/cau-logger
  dest: packages/cau-logger
---

# cau-logger

Fast, multi-transport structured logger for Node.js/TypeScript projects.

For full API reference, transport options, and config details, see [README.md](./README.md).

## When to Use

Vendor this package when the user needs:
- Structured JSON logging
- Console output (pretty for dev, JSON for production)
- File logging with rotation
- MongoDB logging (batched inserts)
- SQL database logging (PostgreSQL, MySQL, SQLite, MSSQL)
- Request-scoped child loggers
- Log redaction (passwords, tokens, etc.)

## Vendoring

Sparse checkout + copy. The `--branch` flag accepts a git tag (preferred) or `main`.

```bash
CAU_REF="<git-tag-or-main>"
TMPDIR=$(mktemp -d)
git clone --depth 1 --branch "$CAU_REF" --filter=blob:none --sparse \
  git@github.com:PrasanKumar93/custom-agent-utils.git "$TMPDIR"
cd "$TMPDIR" && git sparse-checkout set packages/cau-logger
cp -r "$TMPDIR/packages/cau-logger" <your-project>/packages/cau-logger
rm -rf "$TMPDIR"
```

### After vendoring

```bash
cd packages/cau-logger
npm install
npm run build
```

If using MongoDB transport, also install:

```bash
npm install mongodb
```

If using SQL transport, install the DB driver:

```bash
npm install knex pg        # PostgreSQL
npm install knex mysql2    # MySQL
npm install knex better-sqlite3  # SQLite
```

### Provenance file

After vendoring, create `packages/cau-logger/.vendor.json`:

```json
{
  "source": "git@github.com:PrasanKumar93/custom-agent-utils.git",
  "package": "packages/cau-logger",
  "tag": "<git-tag-or-main>",
  "vendoredAt": "<ISO-8601 date>",
  "forked": false
}
```

### Updating

Re-run the sparse checkout commands above with the new `CAU_REF`, then:

```bash
cd packages/cau-logger && npm install && npm run build
```

Update `.vendor.json` with the new `tag` and `vendoredAt`.

## Quick usage (vendored path)

```typescript
import { Logger } from "cau-logger";

// Bootstrap: create() initializes and stores the singleton.
const logger = Logger.create();
logger.info("Server started");

// Elsewhere: retrieve the same instance.
const same = Logger.getInstance();
```

See [README.md](./README.md) for multi-transport config, child loggers, graceful shutdown, and full API.

## Rules

- Do NOT modify vendored code. Extend via adapters or wrappers in your project code.
- If you must modify, update `.vendor.json` to mark the package as `"forked": true`.
- Connection strings for Mongo/SQL should come from environment variables, never hardcoded.
