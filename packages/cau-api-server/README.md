# cau-api-server

Zero-boilerplate Express API server with built-in security, structured error handling, and graceful shutdown for [custom-agent-utils](https://github.com/maakrupa/custom-agent-utils).

`ApiServer` is a singleton-friendly class that wires helmet, CORS, rate limiting, compression, request-id middleware, POST-only routing, and process signal handlers -- all from a single `create()` call.

## Install

```bash
npm install cau-api-server
```

Also requires `cau-logger` (peer/sibling dependency):

```bash
npm install cau-logger
```

## Quick Start

```typescript
import { ApiServer } from "cau-api-server";

const server = ApiServer.create({
  config: { PORT: 3001 },
  routes: [
    {
      path: "/hello",
      handler: async (input, { logger }) => {
        logger.info("Hello handler called");
        return { message: "hello world" };
      },
    },
  ],
});

await server.start();
```

## With Custom Logger

```typescript
import { ApiServer } from "cau-api-server";
import { Logger } from "cau-logger";

const logger = Logger.create({
  level: "debug",
  context: "MyApp",
  transports: [
    { type: "console", format: "pretty" },
    { type: "file", path: "./logs/app.log", rotation: "daily" },
  ],
});

const server = ApiServer.create({
  config: {
    PORT: 3001,
    API_PREFIX: "/api",
    ALLOWED_ORIGINS: ["http://localhost:3000"],
  },
  logger,
  onAppStart: async () => {
    // connect to database, warm caches, etc.
  },
  onAppStop: async () => {
    // disconnect, flush, cleanup
  },
  routes: [
    {
      path: "/users",
      handler: async (input, { logger, requestId }) => {
        logger.info("Fetching users", { filter: input });
        return [{ name: "alice" }];
      },
    },
  ],
});

// Add custom Express middleware before starting
server.expressApp.use(customAuthMiddleware);

await server.start();
```

## Singleton

```typescript
const server = ApiServer.getInstance({
  config: { PORT: 3001 },
  routes: [...],
});

// Elsewhere -- same instance
const server = ApiServer.getInstance();
```

## Built-in Health Endpoint

A `GET /health` endpoint is always registered at the root (outside `API_PREFIX`):

```
GET /health -> { "data": { "status": "ok", "uptime": 42.5 }, "error": null }
```

## Response Envelope

All routes return a uniform envelope:

```json
{
  "data": "<handler return value or null>",
  "error": "<error message string or null>"
}
```

On success, `data` has the value and `error` is `null`. On failure, `data` is `null` and `error` has the message.

## API

### `ApiServer` class

| Method / Property | Signature | Description |
|---|---|---|
| `ApiServer.create(config)` | `(config: ApiServerConfig) => ApiServer` | Creates a new ApiServer instance |
| `ApiServer.getInstance(config?)` | `(config?: ApiServerConfig) => ApiServer` | Singleton access -- creates on first call |
| `ApiServer.reset()` | `() => void` | Clears the singleton instance |
| `server.start()` | `() => Promise<void>` | Starts listening, calls `onAppStart`, registers signal handlers |
| `server.stop()` | `() => Promise<void>` | Calls `onAppStop`, closes server, removes signal handlers |
| `server.expressApp` | `express.Application` | Underlying Express app for adding custom middleware |
| `server.port` | `number` | Actual port after `start()` (useful with `PORT: 0`) |

### `ApiServerConfig`

| Field | Type | Default | Description |
|---|---|---|---|
| `config` | `ServerConfig` | `{}` | Server configuration (see below) |
| `logger` | `Logger` | auto-created console logger | cau-logger instance |
| `onAppStart` | `() => Promise<void> \| void` | -- | Called during `start()` |
| `onAppStop` | `() => Promise<void> \| void` | -- | Called during `stop()` |
| `routes` | `RouteDefinition[]` | **required** | Array of route definitions |

### `ServerConfig`

| Field | Type | Default | Description |
|---|---|---|---|
| `PORT` | `number` | `3001` | Port to listen on (use `0` for random) |
| `API_PREFIX` | `string` | `"/api"` | Prefix for all POST routes |
| `ALLOWED_ORIGINS` | `string[]` | `[]` (all origins) | CORS allowed origins |
| `BODY_LIMIT` | `string` | `"1mb"` | Max JSON body size |
| `RATE_LIMIT_WINDOW_MS` | `number` | `60000` | Rate limit window (ms) |
| `RATE_LIMIT_MAX` | `number` | `100` | Max requests per window per IP |

### `RouteDefinition`

| Field | Type | Description |
|---|---|---|
| `path` | `string` | Route path (e.g. `"/users"`) |
| `handler` | `RouteHandler` | `(input: unknown, context: RouteContext) => Promise<unknown> \| unknown` |

### `RouteContext`

| Field | Type | Description |
|---|---|---|
| `logger` | `Logger` | Child logger with `{ requestId }` bound |
| `requestId` | `string` | UUID for the current request |

### `HTTP_STATUS_CODES`

Exported constant object with standard HTTP status codes:

```typescript
HTTP_STATUS_CODES.OK                    // 200
HTTP_STATUS_CODES.CREATED               // 201
HTTP_STATUS_CODES.BAD_REQUEST           // 400
HTTP_STATUS_CODES.UNAUTHORIZED          // 401
HTTP_STATUS_CODES.FORBIDDEN             // 403
HTTP_STATUS_CODES.NOT_FOUND             // 404
HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR // 500
HTTP_STATUS_CODES.BAD_GATEWAY           // 502
HTTP_STATUS_CODES.SERVICE_UNAVAILABLE   // 503
```

## Security (applied automatically)

| Middleware | Purpose |
|---|---|
| `helmet` | Security HTTP headers |
| `cors` | CORS with configurable origins |
| `compression` | Gzip response compression |
| `express-rate-limit` | Brute-force / DDoS protection |
| `express.json` | JSON body parser with size limit |
| request-id | Auto-generated `X-Request-Id` header + child logger |

## Graceful Shutdown

Process signals (`SIGTERM`, `SIGINT`, `uncaughtException`, `unhandledRejection`) are handled automatically. On shutdown:

1. `onAppStop` callback is called
2. HTTP server closes (stops accepting new connections)
3. Logger flushes
4. Process exits

A 10-second safety timer forces exit if cleanup stalls.

## Tests

```bash
cd packages/cau-api-server
npm test
```

Tests use real HTTP servers on random ports with real `fetch` requests (zero mocking).
