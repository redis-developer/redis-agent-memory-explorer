# Cloud context surface TypeScript Client

High-quality TypeScript client SDK for the Cloud context surface API with full type safety, Zod validation, and retry logic.

## Installation

```bash
npm install @cloud-context-engine/client
```

Or for local development:

```bash
npm install file:../typescript-client
```

## Quick Start

### Using JWT Authentication (Dashboard/Web Apps)

```typescript
import { CloudContextSurfaceClient } from '@cloud-context-engine/client'

const client = new CloudContextSurfaceClient({
  baseUrl: 'http://localhost:8080',
})

// Login to get access token
const auth = await client.login('user@example.com', 'password')
client.setAccessToken(auth.access_token)

// Now use the client
const engines = await client.listContextSurfaces()
console.log('context surfaces:', engines.context_surfaces)
```

### Using API Key Authentication (Server-to-Server)

```typescript
import { CloudContextSurfaceClient } from '@cloud-context-engine/client'

const client = new CloudContextSurfaceClient({
  baseUrl: 'http://localhost:8080',
  apiKey: 'ak_your_admin_api_key',
})

// Create a context surface
const engine = await client.createContextSurface({
  name: 'My context surface',
  description: 'A context surface for my application',
})

// Create an agent key for the engine
const agentKey = await client.createAgentKey(engine.id, {
  name: 'My Agent',
})

console.log('Agent Key:', agentKey.key)
```

## API Reference

### Client Configuration

```typescript
interface ClientConfig {
  baseUrl: string       // API base URL
  apiKey?: string       // Admin API key (X-API-Key header)
  accessToken?: string  // JWT access token (Bearer token)
  timeout?: number      // Request timeout in ms (default: 30000)
  retries?: number      // Max retry attempts (default: 3)
}
```

### context surfaces

- `listContextSurfaces(params?)` - List all context surfaces
- `getContextSurface(id)` - Get a context surface by ID
- `createContextSurface(data)` - Create a new context surface
- `updateContextSurface(id, data)` - Update a context surface
- `deleteContextSurface(id)` - Delete a context surface

### Agent Keys

- `listAgentKeys(contextSurfaceId, params?)` - List agent keys for an engine
- `createAgentKey(contextSurfaceId, data)` - Create an agent key

### Admin Keys

- `createAdminKey(data)` - Create a new admin API key
- `validateAdminKey()` - Validate the current admin key

### Redis Instances

- `listRedisInstances()` - List all Redis instances
- `getRedisInstance(id)` - Get a Redis instance by ID
- `createRedisInstance(data)` - Create a new Redis instance
- `deleteRedisInstance(id)` - Delete a Redis instance
- `testRedisConnection(config)` - Test a Redis connection

### Authentication (JWT)

- `login(email, password)` - Login and get tokens
- `register(email, password, name)` - Register a new user
- `refreshToken(refreshToken)` - Refresh access token
- `getCurrentUser()` - Get current user profile
- `updateProfile(data)` - Update user profile
- `changePassword(currentPassword, newPassword)` - Change password

### Health

- `getHealth()` - Get server health status
- `getLiveness()` - Liveness probe
- `getReadiness()` - Readiness probe

## Error Handling

```typescript
import {
  CloudContextSurfaceClient,
  AuthenticationError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  RateLimitError,
  APIError,
} from '@cloud-context-engine/client'

try {
  await client.getContextSurface('non-existent-id')
} catch (error) {
  if (error instanceof NotFoundError) {
    console.log('Engine not found')
  } else if (error instanceof AuthenticationError) {
    console.log('Invalid API key or token')
  } else if (error instanceof ForbiddenError) {
    console.log('Access denied')
  } else if (error instanceof ValidationError) {
    console.log('Validation failed:', error.details)
  } else if (error instanceof RateLimitError) {
    console.log('Rate limited, retry after:', error.retryAfter)
  } else if (error instanceof APIError) {
    console.log('API error:', error.statusCode, error.response)
  }
}
```

## Features

- **Type Safety**: Full TypeScript support with strict mode
- **Zod Validation**: Runtime validation of API responses
- **Retry Logic**: Automatic retry with exponential backoff for 5xx and 429 errors
- **Dual Auth**: Supports both JWT (Bearer) and API key (X-API-Key) authentication
- **Tree-Shakeable**: ESM modules with proper exports
- **Isomorphic**: Works in Node.js, browsers, and edge runtimes

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build

# Generate types from OpenAPI
npm run generate:types

# Lint
npm run lint

# Type check
npm run typecheck
```

## License

MIT
