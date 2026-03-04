---
name: cau-api-server
description: Zero-boilerplate Express API server with built-in security (helmet, CORS, rate limiting, compression), structured error handling, request-id child loggers, and graceful shutdown. Use when the user needs an API server with minimal setup.
metadata:
  author: prasan
  version: "0.1.0"
  repo: git@github.com:PrasanKumar93/custom-agent-utils.git
  path: packages/cau-api-server
  dest: packages/cau-api-server
---

# cau-api-server

Zero-boilerplate Express API server for Node.js/TypeScript projects.

For full API reference see [README.md](./README.md).

## When to Use

Vendor this package when the user needs:
- A production-ready API server with minimal boilerplate
- Built-in security middleware (helmet, CORS, rate limiting, compression)
- POST-only routes with uniform `{ data, error }` response envelope
- Per-request child loggers with auto-generated request IDs
- Graceful shutdown with process signal handling
- Lifecycle callbacks (onAppStart, onAppStop)

## Vendoring

Sparse checkout + copy. The `--branch` flag accepts a git tag (preferred) or `main`.

You can vendor multiple packages in a single sparse checkout by listing them together.

```bash
CAU_REF="<git-tag-or-main>"
TMPDIR=$(mktemp -d)
git clone --depth 1 --branch "$CAU_REF" --filter=blob:none --sparse \
  git@github.com:PrasanKumar93/custom-agent-utils.git "$TMPDIR"
cd "$TMPDIR" && git sparse-checkout set packages/cau-api-server packages/cau-logger
cp -r "$TMPDIR/packages/cau-api-server" <your-project>/packages/cau-api-server
cp -r "$TMPDIR/packages/cau-logger" <your-project>/packages/cau-logger
rm -rf "$TMPDIR"
```

`cau-logger` is a peer dependency -- always vendor it alongside `cau-api-server`.

### After vendoring

```bash
cd packages/cau-logger && npm install && npm run build
cd ../cau-api-server && npm install && npm run build
```

### Provenance file

Create `packages/cau-api-server/.vendor.json` (and the same for `packages/cau-logger`):

```json
{
  "source": "git@github.com:PrasanKumar93/custom-agent-utils.git",
  "package": "packages/cau-api-server",
  "tag": "<git-tag-or-main>",
  "vendoredAt": "<ISO-8601 date>",
  "forked": false
}
```

### Updating

Re-run the sparse checkout commands above with the new `CAU_REF`, then:

```bash
cd packages/cau-logger && npm install && npm run build
cd ../cau-api-server && npm install && npm run build
```

Update `.vendor.json` in each package with the new `tag` and `vendoredAt`.

## Quick usage (vendored path)

```typescript
import { ApiServer, HTTP_STATUS_CODES } from "cau-api-server";
import { Logger } from "cau-logger";

const logger = Logger.create({
  context: "MyApp",
  transports: [{ type: "console", format: "pretty" }],
});

const server = ApiServer.create({
  config: { PORT: 3001 },
  logger,
  routes: [
    {
      path: "/users",
      handler: async (input, { logger }) => {
        logger.info("Fetching users");
        return [{ name: "alice" }];
      },
    },
  ],
});

await server.start();
```

## Rules

- Do NOT modify vendored code. Extend via adapters or wrappers in your project code.
- If you must modify, update `.vendor.json` to mark `"forked": true`.
- Connection strings and secrets must come from environment variables, never hardcoded.
