# cau-api-server -- Design Plan

Zero-boilerplate Express API server with built-in security, structured error handling, and graceful shutdown. Consumers call one factory method, pass their routes, and get a production-ready server.

### Skills Applied

All code in this package must follow these monorepo skills:

- **js-code-style** -- arrow functions, consolidated exports, separate type exports/imports, import ordering, no nested functions, single return, no hardcoded values, string literal unions as `as const` objects
- **js-naming-conventions** -- kebab-case files/folders, PascalCase classes/types, camelCase functions/variables, UPPER_SNAKE_CASE constants
- **js-package-scaffold** -- folder structure, public interface class pattern, config/types/constants conventions, vitest setup, SKILL.md, README.md, PACKAGE_INDEX registration
- **js-testing** -- zero mocking, real execution, co-located test files, explicit assertions, shared input/output variables

---

## 1. Goals

| Goal                         | Detail                                                                                                                                                      |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Zero boilerplate             | Single `create()` call wires everything -- security, CORS, body parsing, routing, error handling, signal traps                                              |
| POST-only convention         | Every route is a POST endpoint with a uniform `{ data, error }` response envelope                                                                           |
| Framework-agnostic interface | Public types (`ApiServerConfig`, `RouteDefinition`, etc.) do not leak Express types; swapping Express for Fastify/Hono later requires only internal changes |
| Security by default          | Helmet, CORS, rate limiting, compression, JSON body limits -- all applied automatically                                                                     |
| Graceful lifecycle           | Process signals (`SIGTERM`, `SIGINT`, `unhandledRejection`, `uncaughtException`) handled out of the box                                                     |
| Logging via cau-logger       | All internal logging (startup, shutdown, errors) goes through `cau-logger`                                                                                  |

---

## 2. Public API Design

### 2.1 Class Pattern

**Singleton + factory** (matches `cau-logger` pattern).

```typescript
import type { ApiServerConfig } from "./types";

class ApiServer {
  static #instance: ApiServer | null = null;

  #app: ExpressApp;           // private, never leaks Express types to consumers
  #server: HttpServer | null;

  private constructor(app: ExpressApp, config: InternalConfig) { ... }

  // --- factory ---
  static create(config: ApiServerConfig): ApiServer { ... }

  // --- singleton ---
  static getInstance(config?: ApiServerConfig): ApiServer { ... }
  static reset(): void { ... }

  // --- public methods ---
  start():  Promise<void>;   // binds port, calls onAppStart, registers signal handlers
  stop():   Promise<void>;   // calls onAppStop, closes server, cleans up

  // --- middleware extension ---
  get expressApp(): ExpressApp;  // returns underlying express app for adding custom middleware
}
```

### 2.2 Consumer Usage

```typescript
import { ApiServer, HTTP_STATUS_CODES } from "cau-api-server";
import { Logger } from "cau-logger";

const logger = Logger.create({
  level: "info",
  context: "MyApp",
  transports: [{ type: "console", format: "pretty" }],
});

const server = ApiServer.create({
  config: {
    PORT: 3001,
    API_PREFIX: "/api",
    ALLOWED_ORIGINS: ["http://localhost:3000"],
  },
  logger, // optional -- if omitted, a default console logger is created
  onAppStart: async () => {
    await connectToDatabase();
  },
  onAppStop: async () => {
    await disconnectFromDatabase();
  },
  routes: [
    { path: "/health", handler: async () => ({ status: "ok" }) },
    {
      path: "/users",
      handler: async (input, { logger }) => {
        logger.info("Fetching users", { filter: input });
        return userService.list(input);
      },
    },
  ],
});

// Optional: add custom express middleware before starting
server.expressApp.use(customAuthMiddleware);

// Start listening
await server.start();
// Logs: "ApiServer listening on port 3001"
```

### 2.3 Middleware Extension

After `create()` but before `start()`, the user accesses `server.app` and calls `.use()`:

```typescript
const server = ApiServer.create({ ... });
server.expressApp.use(passport.initialize());
server.expressApp.use(customMiddleware);
await server.start();
```

This works because `start()` mounts the API router **after** any user-added middleware, ensuring the correct execution order:

```
security middleware (auto) -> request-id (auto) -> user middleware -> API routes -> error handler (auto)
```

---

## 3. Types (`src/types.ts`)

```typescript
type ServerConfig = {
  PORT?: number;
  API_PREFIX?: string;
  ALLOWED_ORIGINS?: string[];
  BODY_LIMIT?: string; // e.g. "1mb" -- default "1mb"
  RATE_LIMIT_WINDOW_MS?: number;
  RATE_LIMIT_MAX?: number;
};

type RouteContext = {
  logger: Logger; // child logger with { requestId } already bound
  requestId: string; // raw value, useful for forwarding to downstream APIs
};

type RouteHandler = (
  input: unknown,
  context: RouteContext,
) => Promise<unknown> | unknown;

type RouteDefinition = {
  path: string;
  handler: RouteHandler;
};

type LifecycleCallback = () => Promise<void> | void;

type ApiServerConfig = {
  config?: ServerConfig;
  logger?: Logger; // cau-logger instance; if omitted, a default console logger is created
  onAppStart?: LifecycleCallback;
  onAppStop?: LifecycleCallback;
  routes: RouteDefinition[];
};

type ApiResponse<T = unknown> = {
  data: T | null;
  error: string | null;
};
```

---

## 4. Constants (`src/constants.ts`)

```typescript
//constants.ts
const HTTP_STATUS_CODES = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
} as const;
type HttpStatusCode =
  (typeof HTTP_STATUS_CODES)[keyof typeof HTTP_STATUS_CODES];

//config.ts
const DEFAULT_PORT = 3001;
const DEFAULT_API_PREFIX = "/api";
const DEFAULT_BODY_LIMIT = "1mb";
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const DEFAULT_RATE_LIMIT_MAX = 100; // 100 requests per window
const GRACEFUL_SHUTDOWN_TIMEOUT_MS = 10000; // 10 seconds
```

---

## 5. Folder Structure

```
packages/cau-api-server/
  docs/
    plan.md                       # this file
  src/
    helpers/
      register-routes.util.ts     # builds express Router from RouteDefinition[]
      register-routes.util.test.ts
      setup-security.util.ts      # applies helmet, cors, rate-limit, compression
      setup-security.util.test.ts
      setup-signals.util.ts       # process signal handlers
      setup-signals.util.test.ts
      request-id.util.ts          # generates X-Request-Id, creates child logger on req
      request-id.util.test.ts
      serialize-error.util.ts     # converts Error to plain object for safe logging/serialization
      serialize-error.util.test.ts
    constants.ts
    config.ts
    types.ts
    api-server.ts                 # the public ApiServer class
    api-server.test.ts
    index.ts                      # barrel exports
  test.env
  vitest.setup.ts
  vitest.config.ts
  tsconfig.json
  package.json
  SKILL.md
  README.md
```

---

## 6. Security Middleware (applied automatically)

| Package                | Purpose                                                                                               | Default Behaviour                                                          |
| ---------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `helmet`               | Sets security HTTP headers (X-Content-Type-Options, Strict-Transport-Security, X-Frame-Options, etc.) | All defaults enabled                                                       |
| `cors`                 | Cross-Origin Resource Sharing                                                                         | Allow all origins by default, or restrict to `ALLOWED_ORIGINS` if provided |
| `express-rate-limit`   | Brute-force / DDoS protection                                                                         | 100 requests per minute per IP (configurable)                              |
| `compression`          | Gzip/Brotli response compression                                                                      | Enabled for all responses                                                  |
| `express.json()`       | JSON body parser                                                                                      | Limit configurable via `BODY_LIMIT` (default `1mb`)                        |
| `express.urlencoded()` | URL-encoded body parser                                                                               | `extended: true`, same limit                                               |
| request-id (built-in)  | Generates a unique `X-Request-Id` header per request; attaches to cau-logger child logger             | Always enabled, uses `crypto.randomUUID()`                                 |

### Application Order

```
1. helmet
2. cors
3. compression
4. express.json (with body limit)
5. express.urlencoded (with body limit)
6. rate limiter
7. request-id (auto-generated, attached to logger child)
8. GET /health (built-in, always registered)
9. --- user middlewares (via server.expressApp.use() before start()) ---
10. --- API router (POST routes on API_PREFIX) ---
11. 404 handler
12. Global error handler
```

---

## 7. Route Registration

### 7.1 Default Health Endpoint

A built-in `GET /health` endpoint is always registered at the root level (outside `API_PREFIX`). This serves load balancer probes, k8s readiness checks, and manual smoke tests without any consumer configuration:

```typescript
// Always registered automatically -- no user config needed
// GET /health -> { data: { status: "ok", uptime: 42.123 }, error: null }

app.get("/health", (req, res) => {
  const result: ApiResponse = {
    data: { status: "ok", uptime: process.uptime() },
    error: null,
  };
  res.json(result);
});
```

This endpoint:
- Uses `GET` (not POST) so standard monitoring tools work out of the box
- Lives at root `/health`, not under `API_PREFIX`
- Returns the same `{ data, error }` envelope for consistency
- Is useful as a quick sanity check in unit tests

### 7.2 Error Serialization

`Error` objects have non-enumerable properties (`message`, `stack`, `name`), so `JSON.stringify(new Error("foo"))` produces `"{}"` and logging `{ error: err }` often prints `[object Object]`. A `serializeError` helper converts any Error into a plain object safe for logging and JSON responses:

```typescript
// src/helpers/serialize-error.util.ts

const serializeError = (err: unknown): Record<string, unknown> => {
  const isError = err instanceof Error;
  const serialized: Record<string, unknown> = {
    message: isError ? err.message : String(err),
    name: isError ? err.name : "UnknownError",
    stack: isError ? err.stack : undefined,
  };

  // preserve any custom enumerable properties (e.g. statusCode, code)
  if (isError) {
    for (const key of Object.keys(err)) {
      serialized[key] = (err as Record<string, unknown>)[key];
    }
  }

  return serialized;
};
```

### 7.3 User Route Registration

Each entry in the `routes` array is registered as a POST endpoint under `API_PREFIX`:

```typescript
// For route { path: "/users", handler: listUsers }
// Registers: POST /api/users

router.post(route.path, async (req, res) => {
  const result: ApiResponse = { data: null, error: null };
  const input = req.body;
  const requestId = req.requestId;
  const reqLogger = req.logger; // child logger with { requestId } already bound
  const context: RouteContext = { logger: reqLogger, requestId };

  try {
    result.data = await route.handler(input, context);
  } catch (err) {
    const errorDetail = serializeError(err);
    reqLogger.error(`${route.path} API failed`, { error: errorDetail });
    result.error = errorDetail.message as string;
    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR);
  }

  res.json(result);
});
```

Key points:

- **POST only** -- no GET/PUT/DELETE registration (health endpoint is the sole GET exception)
- **Uniform response envelope** -- `{ data, error }` always
- **Try/catch per route** -- one failing route does not crash the server
- **Safe error serialization** -- `serializeError()` extracts `message`, `name`, `stack`, and custom properties into a plain object; no `[object Object]` or `{}` in logs
- **Error logging** via cau-logger child logger with `requestId` context per request
- **No raw Error objects** in response -- only the message string (avoids leaking stack traces)

---

## 8. Process Signal Handling

```typescript
// Graceful shutdown
const gracefulShutdown = async (signal: string): Promise<void> => {
  logger.info(`Received ${signal}, shutting down gracefully`);
  await onAppStop?.();
  server.close();
  await logger.close();
  process.exit(0);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Catch unhandled errors
process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled rejection", { error: serializeError(reason) });
});

process.on("uncaughtException", (err) => {
  logger.fatal("Uncaught exception -- shutting down", { error: serializeError(err) });
  gracefulShutdown("uncaughtException");
});
```

Additionally, a `GRACEFUL_SHUTDOWN_TIMEOUT_MS` (10s) safety timer forces `process.exit(1)` if cleanup stalls.

---

## 9. Logging Integration

The consumer can pass their own cau-logger instance via the `logger` option. If not provided, a default console logger is created internally:

```typescript
// Consumer-supplied logger (recommended)
const logger = Logger.create({
  level: "debug",
  context: "MyApp",
  transports: [
    { type: "console", format: "pretty" },
    { type: "file", path: "./logs/app.log" },
  ],
});
const server = ApiServer.create({ logger, routes: [...] });

// OR: fallback -- package creates a default console logger
const server = ApiServer.create({ routes: [...] });
```

### Request-Id Child Loggers

The built-in request-id middleware generates a `crypto.randomUUID()` per request, sets the `X-Request-Id` response header, and creates a cau-logger child logger bound with `{ requestId }`. This child logger is attached to `req.logger` so route handlers automatically get per-request log context.

### Internal log calls

- `logger.info("ApiServer listening on port {PORT}")`
- `reqLogger.error("{path} API failed", { error })` -- per-request child logger
- `logger.info("Received {signal}, shutting down")`
- `logger.fatal("Uncaught exception", { error })`

---

## 10. Dependencies

### Runtime

| Package              | Version              | Purpose                                             |
| -------------------- | -------------------- | --------------------------------------------------- |
| `express`            | `^5.1.0`             | HTTP framework (Express 5 -- stable, promise-aware) |
| `helmet`             | `^8.1.0`             | Security headers                                    |
| `cors`               | `^2.8.5`             | CORS                                                |
| `express-rate-limit` | `^7.5.0`             | Rate limiting                                       |
| `compression`        | `^1.8.0`             | Response compression                                |
| `cau-logger`         | `file:../cau-logger` | Structured logging                                  |
| `dotenv`             | `^16.4.5`            | Env loading                                         |

### Dev

| Package              | Version   | Purpose                      |
| -------------------- | --------- | ---------------------------- |
| `@types/express`     | `^5.0.0`  | Express type definitions     |
| `@types/cors`        | `^2.8.17` | CORS type definitions        |
| `@types/compression` | `^1.7.5`  | Compression type definitions |
| `@types/node`        | `^25.3.3` | Node.js type definitions     |
| `typescript`         | `^5.9.3`  | TypeScript compiler          |
| `vitest`             | `^4.0.18` | Test runner                  |

> Note: Exact versions will be resolved at `npm install` time. Above are targets.

---

## 11. Testing Strategy

Following the **js-testing** skill (zero mocking, real execution):

### `api-server.test.ts`

- Spin up a real server on a random available port
- Send real HTTP requests using `fetch` (Node 18+ built-in)
- Test the built-in `GET /health` endpoint returns `{ data: { status: "ok", uptime }, error: null }`
- Assert on response status codes and `{ data, error }` bodies for user routes
- Test lifecycle callbacks (onAppStart / onAppStop are called)
- Test graceful shutdown via `server.stop()`

### `register-routes.util.test.ts`

- Create a real Express router, register routes, mount on a test app
- Send real POST requests, verify response envelope
- Verify error handling (handler throws -> `{ data: null, error: "..." }`) with proper error message (not `[object Object]`)
- Verify non-POST methods return 404

### `setup-security.util.test.ts`

- Create a real Express app with security middleware applied
- Send requests and check response headers (helmet headers present, CORS headers correct)
- Test rate limiting (send N+1 requests, verify 429 status)

### `setup-signals.util.test.ts`

- Test the signal handler function directly (verify it calls stop/cleanup in the right order)
- Avoid actually sending process signals in tests (would kill the test runner)

### `serialize-error.util.test.ts`

- Verify standard Error serializes to `{ message, name, stack }`
- Verify custom error subclass preserves custom enumerable properties (e.g. `statusCode`)
- Verify non-Error values (string, number, null, undefined) serialize safely
- Verify no `[object Object]` or `{}` in output

---

## 12. Barrel Exports (`src/index.ts`)

```typescript
import { ApiServer } from "./api-server";
import { HTTP_STATUS_CODES } from "./constants";

import type {
  ApiServerConfig,
  ServerConfig,
  RouteDefinition,
  RouteHandler,
  RouteContext,
  LifecycleCallback,
  ApiResponse,
} from "./types";

export { ApiServer, HTTP_STATUS_CODES };

export type {
  ApiServerConfig,
  ServerConfig,
  RouteDefinition,
  RouteHandler,
  RouteContext,
  LifecycleCallback,
  ApiResponse,
};
```

---

## 13. Decisions (Resolved)

| #   | Question                                                                                | Decision                                                                                                                                  |
| --- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Express 5 vs Express 4?                                                                 | **Express 5** -- stable, native async error handling, better TypeScript support                                                           |
| 2   | Should `routes` support path params (e.g. `/users/:id`)?                                | **No** -- not needed, POST body is the only input                                                                                         |
| 3   | Should the logger config be customizable by the consumer?                               | **Accept a Logger instance** (not config) -- consumer controls lifecycle; if omitted, package creates a default console logger internally |
| 4   | Should we add request-id middleware built-in?                                           | **Yes** -- auto-generates `X-Request-Id`, creates cau-logger child with `{ requestId }` on each request                                   |
| 5   | Should `server.app` be typed as `unknown` to hide Express, or as the real Express type? | **Real Express `Application` type** via `server.expressApp` -- explicit framework coupling, grep-friendly for migration                   |
| 6   | Middleware extension: config array vs `server.expressApp.use()` vs both?                | **`server.expressApp.use()` only** -- no config `middlewares` array; keeps the API surface small                                          |
| 7   | Should route handlers receive the child logger?                                         | **Yes** -- handler receives `(input, context)` where `RouteContext = { logger, requestId }`; keeps requestId in all handler logs          |
| 8   | Default health endpoint?                                                                | **Yes** -- built-in `GET /health` at root (not under API_PREFIX), returns `{ data: { status, uptime }, error: null }`, useful for LB probes and tests |

---

## 14. Checklist (pre-implementation)

| #   | Item                                             | Status  |
| --- | ------------------------------------------------ | ------- |
| 1   | Plan reviewed and approved                       | Pending |
| 2   | Folder structure created                         | Pending |
| 3   | `types.ts` with all public + internal types      | Pending |
| 4   | `constants.ts` with HTTP_STATUS_CODES + defaults | Pending |
| 5   | `config.ts` with env loading                     | Pending |
| 6   | Helper: `register-routes.util.ts`                | Pending |
| 7   | Helper: `setup-security.util.ts`                 | Pending |
| 8   | Helper: `setup-signals.util.ts`                  | Pending |
| 9   | Main class: `api-server.ts`                      | Pending |
| 10  | Tests for all modules                            | Pending |
| 11  | `index.ts` barrel                                | Pending |
| 12  | `package.json`, `tsconfig.json`, vitest config   | Pending |
| 13  | `SKILL.md`                                       | Pending |
| 14  | `README.md`                                      | Pending |
| 15  | Register in `PACKAGE_INDEX.md`                   | Pending |
