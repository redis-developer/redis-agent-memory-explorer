---
name: cau-api-server
description: Zero-boilerplate Express API server with built-in security (helmet, CORS, rate limiting, compression), structured error handling, request-id child loggers, and graceful shutdown. Use when the user needs an API server with minimal setup.
metadata:
  author: prasan
  version: "0.1.0"
  repo: git@github.com:PrasanKumar93/custom-agent-utils.git
  path: packages/cau-api-server
  dest: utils/cau-api-server
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

### Option A: Git subtree (recommended)

```bash
git subtree add --prefix utils/cau-api-server \
  git@github.com:PrasanKumar93/custom-agent-utils.git \
  main --squash
```

To update later:

```bash
git subtree pull --prefix utils/cau-api-server \
  git@github.com:PrasanKumar93/custom-agent-utils.git \
  main --squash
```

### Option B: Sparse checkout + copy

```bash
git clone --filter=blob:none --sparse \
  git@github.com:PrasanKumar93/custom-agent-utils.git /tmp/cau
cd /tmp/cau
git sparse-checkout set packages/cau-api-server
cp -r packages/cau-api-server <your-project>/utils/cau-api-server
```

### After vendoring

```bash
cd utils/cau-api-server
npm install
npm run build
```

Also vendor `cau-logger` (peer dependency):

```bash
# repeat vendoring steps for packages/cau-logger
```

### Provenance file

Create `utils/cau-api-server/.vendor.json`:

```json
{
  "source": "git@github.com:PrasanKumar93/custom-agent-utils.git",
  "path": "packages/cau-api-server",
  "version": "0.1.0",
  "vendoredAt": "<ISO date>",
  "forked": false
}
```

## Quick usage (vendored path)

```typescript
import { ApiServer, HTTP_STATUS_CODES } from "./utils/cau-api-server";
import { Logger } from "./utils/cau-logger";

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
