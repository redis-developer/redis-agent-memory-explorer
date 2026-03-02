---
name: cau-logger
description: Fast, multi-transport structured logger (console, file, MongoDB, SQL). Built on Pino with a library-agnostic CauLogger interface. Use when the user needs logging with any combination of console, file, MongoDB, or relational database output.
metadata:
  author: prasan
  version: "0.1.0"
  repo: git@github.com:PrasanKumar93/custom-agent-utils.git
  path: packages/cau-logger
  dest: utils/cau-logger
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

### Option A: Git subtree (recommended)

**First time:**

```bash
git subtree add --prefix=utils/cau-logger \
  git@github.com:PrasanKumar93/custom-agent-utils.git main \
  --squash
```

Note: this vendors the entire repo. To get only `packages/cau-logger`, use Option B.

### Option B: Sparse checkout + copy

```bash
TMPDIR=$(mktemp -d)
git clone --depth 1 --filter=blob:none --sparse \
  git@github.com:PrasanKumar93/custom-agent-utils.git "$TMPDIR"
cd "$TMPDIR" && git sparse-checkout set packages/cau-logger
cp -r "$TMPDIR/packages/cau-logger" ./utils/cau-logger
rm -rf "$TMPDIR"
```

### After vendoring

```bash
cd utils/cau-logger
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

After vendoring, create `utils/cau-logger/.vendor.json`:

```json
{
  "source": "git@github.com:PrasanKumar93/custom-agent-utils.git",
  "path": "packages/cau-logger",
  "ref": "main",
  "vendored_at": "2026-03-02T00:00:00Z"
}
```

Update `ref` to a tag or commit SHA for production pinning.

### Updating

Re-run the vendor command (Option A: `git subtree pull`, Option B: re-clone + copy). Then:

```bash
cd utils/cau-logger && npm install && npm run build
```

## Quick usage (vendored path)

```typescript
import { createLogger } from "./utils/cau-logger";

const logger = createLogger();
logger.info("Server started");
```

See [README.md](./README.md) for multi-transport config, child loggers, graceful shutdown, and full API.

## Rules

- Do NOT modify vendored code. Extend via adapters or wrappers in your project code.
- If you must modify, update `.vendor.json` to mark the package as `"forked": true`.
- Connection strings for Mongo/SQL should come from environment variables, never hardcoded.
