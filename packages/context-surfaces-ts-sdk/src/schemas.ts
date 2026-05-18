import { z } from 'zod';

// Pagination schema
export const PaginationSchema = z.object({
  page: z.number().optional(),
  page_size: z.number().optional(),
  total_count: z.number().optional(),
  total_pages: z.number().optional(),
  has_next: z.boolean().optional(),
  has_prev: z.boolean().optional(),
});

// Redis Index Config schema
export const RedisIndexConfigSchema = z.object({
  type: z.enum(['text', 'tag', 'numeric', 'vector']),
  weight: z.number().optional(),
  no_stem: z.boolean().optional(),
  sortable: z.boolean().optional(),
  vector_dim: z.number().optional(),
  distance_metric: z.enum(['cosine', 'euclidean', 'inner_product']).optional(),
});

// Field Description schema
export const FieldDescriptionSchema = z.object({
  name: z.string(),
  type: z.string(),
  description: z.string(),
  mutable: z.boolean().optional(),
  is_key_component: z.boolean().optional(),
  redis_indices: z.array(RedisIndexConfigSchema).optional().nullable(),
});

// Relationship Description schema
export const RelationshipDescriptionSchema = z.object({
  name: z.string(),
  target: z.string(),
  description: z.string(),
  source_field: z.string(),
});

// Entity Description schema
export const EntityDescriptionSchema = z.object({
  name: z.string(),
  description: z.string(),
  redis_key_template: z.string().optional().nullable(),
  fields: z.array(FieldDescriptionSchema).optional().nullable(),
  relationships: z.array(RelationshipDescriptionSchema).optional().nullable(),
});

// Data Model schema
export const DataModelSchema = z.object({
  title: z.string(),
  description: z.string(),
  entities: z.array(EntityDescriptionSchema).optional().nullable(),
  entity_count: z.number().optional().nullable(),
});

// Context Surface schema
export const ContextSurfaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional().nullable(),
  owner: z.string(),
  status: z.string().optional().nullable(),
  status_reason: z.string().optional().nullable(),
  redis_instance_id: z.string().optional().nullable(),
  tools: z.array(z.string()).optional().nullable(),
  data_model: DataModelSchema.optional().nullable(),
  metadata: z.record(z.string()).optional().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

// List Context Surfaces Response schema
export const ListContextSurfacesResponseSchema = z.object({
  context_surfaces: z.array(ContextSurfaceSchema),
  pagination: PaginationSchema.optional(),
});

// Admin API Key schema
export const AdminAPIKeySchema = z.object({
  id: z.string(),
  key: z.string(),
  name: z.string(),
  owner: z.string(),
  description: z.string().optional(),
  metadata: z.record(z.string()).optional(),
  created_at: z.string(),
  updated_at: z.string().optional(),
  valid: z.boolean().optional(),
});

// Agent API Key schema
export const AgentAPIKeySchema = z.object({
  id: z.string(),
  key: z.string(),
  name: z.string(),
  context_surface_id: z.string(),
  key_type: z.literal('agent').optional(),
  owner: z.string().optional(),
  description: z.string().optional(),
  metadata: z.record(z.string()).optional(),
  created_at: z.string(),
  updated_at: z.string().optional(),
  expires_at: z.string().optional().nullable(),
});

// List Agent Keys Response schema
export const ListAgentKeysResponseSchema = z.object({
  agent_keys: z.array(AgentAPIKeySchema),
  pagination: PaginationSchema.optional(),
});

// Health Response schema
export const HealthResponseSchema = z.object({
  status: z.string(),
  checks: z.record(z.string()).optional(),
});

// Redis Connection Config schema
export const RedisConnectionConfigSchema = z.object({
  addr: z.string().optional(),
  password: z.string().optional(),
  db: z.number().optional(),
  tls_enabled: z.boolean().optional(),
  pool_size: z.number().optional(),
  min_idle_conns: z.number().optional(),
  ca_cert: z.string().optional(),
});

// Redis Instance schema
export const RedisInstanceSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  owner: z.string(),
  metadata: z.record(z.string()).optional(),
  created_at: z.string(),
  updated_at: z.string().optional(),
});

// List Redis Instances Response schema
export const ListRedisInstancesResponseSchema = z.object({
  instances: z.array(RedisInstanceSchema),
  total: z.number().optional(),
});

// Test Connection Response schema
export const TestConnectionResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  error: z.string().optional(),
});

// Auth Response schema
export const AuthResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number(),
  token_type: z.string(),
});

// User schema
export const UserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  created_at: z.string(),
});

// Inferred types
export type Pagination = z.infer<typeof PaginationSchema>;
export type ContextSurface = z.infer<typeof ContextSurfaceSchema>;
export type AdminAPIKey = z.infer<typeof AdminAPIKeySchema>;
export type AgentAPIKey = z.infer<typeof AgentAPIKeySchema>;
export type RedisInstance = z.infer<typeof RedisInstanceSchema>;
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
export type User = z.infer<typeof UserSchema>;
export type TestConnectionResponse = z.infer<typeof TestConnectionResponseSchema>;
export type RedisConnectionConfig = z.infer<typeof RedisConnectionConfigSchema>;
export type DataModel = z.infer<typeof DataModelSchema>;
export type EntityDescription = z.infer<typeof EntityDescriptionSchema>;
export type FieldDescription = z.infer<typeof FieldDescriptionSchema>;
export type RelationshipDescription = z.infer<typeof RelationshipDescriptionSchema>;
export type RedisIndexConfig = z.infer<typeof RedisIndexConfigSchema>;
