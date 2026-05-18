// Main exports for @cloud-context-engine/client

// Client
export { CloudContextSurfaceClient } from './client';
export type { ClientConfig } from './client';

// Errors
export {
  CloudContextSurfaceError,
  AuthenticationError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  RateLimitError,
  APIError,
} from './errors';

// Schemas (for advanced use cases)
export {
  PaginationSchema,
  ContextSurfaceSchema,
  ListContextSurfacesResponseSchema,
  AdminAPIKeySchema,
  AgentAPIKeySchema,
  ListAgentKeysResponseSchema,
  HealthResponseSchema,
  RedisConnectionConfigSchema,
  RedisInstanceSchema,
  ListRedisInstancesResponseSchema,
  TestConnectionResponseSchema,
  AuthResponseSchema,
  UserSchema,
  DataModelSchema,
  EntityDescriptionSchema,
  FieldDescriptionSchema,
  RelationshipDescriptionSchema,
  RedisIndexConfigSchema,
} from './schemas';

// Types
export type {
  Pagination,
  ContextSurface,
  AdminAPIKey,
  AgentAPIKey,
  HealthResponse,
  RedisConnectionConfig,
  RedisInstance,
  TestConnectionResponse,
  AuthResponse,
  User,
  DataModel,
  EntityDescription,
  FieldDescription,
  RelationshipDescription,
  RedisIndexConfig,
} from './schemas';

// Re-export generated types for advanced use cases
export * as GeneratedTypes from './generated/api-types';
