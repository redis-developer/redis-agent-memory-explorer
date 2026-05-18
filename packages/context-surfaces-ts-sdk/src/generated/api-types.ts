/* eslint-disable */
/* tslint:disable */
// @ts-nocheck
/*
 * ---------------------------------------------------------------
 * ## THIS FILE WAS GENERATED VIA SWAGGER-TYPESCRIPT-API        ##
 * ##                                                           ##
 * ## AUTHOR: acacode                                           ##
 * ## SOURCE: https://github.com/acacode/swagger-typescript-api ##
 * ---------------------------------------------------------------
 */

export enum GithubComRedislabsdevCloudContextEngineInternalContextmodelRedisIndexType {
  IndexTypeText = "text",
  IndexTypeTag = "tag",
  IndexTypeNumeric = "numeric",
  IndexTypeVector = "vector",
}

export enum GithubComRedislabsdevCloudContextEngineInternalContextmodelDistanceMetric {
  DistanceMetricCosine = "cosine",
  DistanceMetricEuclidean = "euclidean",
  DistanceMetricDotProduct = "dot_product",
}

export interface GithubComRedislabsdevCloudContextEngineInternalContextmodelDataModel {
  description?: string;
  entities?: GithubComRedislabsdevCloudContextEngineInternalContextmodelEntityDescription[];
  entity_count?: number;
  title?: string;
}

export interface GithubComRedislabsdevCloudContextEngineInternalContextmodelEntityDescription {
  description?: string;
  fields?: GithubComRedislabsdevCloudContextEngineInternalContextmodelFieldDescription[];
  name?: string;
  redis_key_template?: string;
  relationships?: GithubComRedislabsdevCloudContextEngineInternalContextmodelRelationshipDescription[];
}

export interface GithubComRedislabsdevCloudContextEngineInternalContextmodelFieldDescription {
  description?: string;
  is_key_component?: boolean;
  mutable?: boolean;
  name?: string;
  redis_indices?: GithubComRedislabsdevCloudContextEngineInternalContextmodelRedisIndexConfig[];
  type?: string;
}

export interface GithubComRedislabsdevCloudContextEngineInternalContextmodelRedisIndexConfig {
  distance_metric?: GithubComRedislabsdevCloudContextEngineInternalContextmodelDistanceMetric;
  no_stem?: boolean;
  /** NumericIndex fields */
  sortable?: boolean;
  type?: GithubComRedislabsdevCloudContextEngineInternalContextmodelRedisIndexType;
  /** VectorIndex fields */
  vector_dim?: number;
  /** TextIndex fields */
  weight?: number;
}

export interface GithubComRedislabsdevCloudContextEngineInternalContextmodelRelationshipDescription {
  description?: string;
  name?: string;
  source_field?: string;
  target?: string;
}

export interface GithubComRedislabsdevCloudContextEngineInternalToolsErrorResponse {
  /** @example "Unauthorized" */
  error?: string;
}

export interface GithubComRedislabsdevCloudContextEngineInternalToolsJSONRPCError {
  /** @example -32600 */
  code?: number;
  data?: object;
  /** @example "Invalid Request" */
  message?: string;
}

export interface GithubComRedislabsdevCloudContextEngineInternalToolsJSONRPCErrorResponse {
  error?: GithubComRedislabsdevCloudContextEngineInternalToolsJSONRPCError;
  /** @example 1 */
  id?: number;
  /** @example "2.0" */
  jsonrpc?: string;
}

export interface GithubComRedislabsdevCloudContextEngineInternalToolsJSONRPCRequest {
  /** @example 1 */
  id?: number;
  /** @example "2.0" */
  jsonrpc?: string;
  /** @example "initialize" */
  method?: "initialize" | "tools/list" | "tools/call";
  params?: object;
}

export interface GithubComRedislabsdevCloudContextEngineInternalToolsJSONRPCSuccessResponse {
  /** @example 1 */
  id?: number;
  /** @example "2.0" */
  jsonrpc?: string;
  result?: object;
}

export interface InternalContextsurfaceCreateAgentKeyRequestDTO {
  /** @example "Agent key for production" */
  description?: string;
  /** @example "2026-12-31T23:59:59Z" */
  expires_at?: string;
  /** @example {"env":"production"} */
  metadata?: Record<string, string>;
  /** @example "my-agent-key" */
  name: string;
}

export interface InternalContextsurfaceCreateAgentKeyResponseDTO {
  /** @example "ce-123" */
  context_surface_id?: string;
  /** @example "2025-12-26T10:00:00Z" */
  created_at?: string;
  /** @example "Agent key for production" */
  description?: string;
  /** @example "2026-12-31T23:59:59Z" */
  expires_at?: string;
  /** @example "550e8400-e29b-41d4-a716-446655440000" */
  id?: string;
  /** @example "ce_agent_xK8s9mP2nQ4vR7wT1yU5zB3cD6eF8gH0iJ2kL4mN6oP8qR0sT2uV4wX6yZ8" */
  key?: string;
  /** @example "agent" */
  key_type?: string;
  /** @example {"env":"production"} */
  metadata?: Record<string, string>;
  /** @example "my-agent-key" */
  name?: string;
  /** @example "user-123" */
  owner?: string;
  /** @example "2025-12-26T10:00:00Z" */
  updated_at?: string;
}

export interface InternalContextsurfaceCreateContextSurfaceRequestDTO {
  data_model?: GithubComRedislabsdevCloudContextEngineInternalContextmodelDataModel;
  /** @example "A context surface for my project" */
  description?: string;
  /** @example {"key":"value"} */
  metadata?: Record<string, string>;
  /** @example "my-context-surface" */
  name: string;
  /** @example "550e8400-e29b-41d4-a716-446655440000" */
  redis_instance_id?: string;
}

export interface InternalContextsurfaceErrorResponse {
  /** @example "Invalid request" */
  error?: string;
}

export interface InternalContextsurfaceItemDTO {
  /** @example "2025-12-26T10:00:00Z" */
  created_at?: string;
  data_model?: GithubComRedislabsdevCloudContextEngineInternalContextmodelDataModel;
  /** @example "A context surface for my project" */
  description?: string;
  /** @example "550e8400-e29b-41d4-a716-446655440000" */
  id?: string;
  /** @example {"key":"value"} */
  metadata?: Record<string, string>;
  /** @example "my-context-surface" */
  name?: string;
  /** @example "user-123" */
  owner?: string;
  /** @example "550e8400-e29b-41d4-a716-446655440000" */
  redis_instance_id?: string;
  /** @example ["search_customer_by_text","filter_customer_by_status"] */
  tools?: string[];
  /** @example "2025-12-26T10:00:00Z" */
  updated_at?: string;
}

export interface InternalContextsurfaceListAgentKeysResponseDTO {
  agent_keys?: InternalContextsurfaceCreateAgentKeyResponseDTO[];
  pagination?: InternalContextsurfacePagination;
}

export interface InternalContextsurfaceListContextSurfacesResponseDTO {
  context_surfaces?: InternalContextsurfaceItemDTO[];
  pagination?: InternalContextsurfacePagination;
}

export interface InternalContextsurfacePagination {
  /** @example true */
  has_next?: boolean;
  /** @example false */
  has_prev?: boolean;
  /** @example 1 */
  page?: number;
  /** @example 20 */
  page_size?: number;
  /** @example 47 */
  total_count?: number;
  /** @example 3 */
  total_pages?: number;
}

export interface InternalContextsurfaceResponseDTO {
  /** @example "2025-12-26T10:00:00Z" */
  created_at?: string;
  data_model?: GithubComRedislabsdevCloudContextEngineInternalContextmodelDataModel;
  /** @example "A context surface for my project" */
  description?: string;
  /** @example "550e8400-e29b-41d4-a716-446655440000" */
  id?: string;
  /** @example {"key":"value"} */
  metadata?: Record<string, string>;
  /** @example "my-context-surface" */
  name?: string;
  /** @example "user-123" */
  owner?: string;
  /** @example "550e8400-e29b-41d4-a716-446655440000" */
  redis_instance_id?: string;
  /** @example ["search_customer_by_text","filter_customer_by_status"] */
  tools?: string[];
  /** @example "2025-12-26T10:00:00Z" */
  updated_at?: string;
}

export interface InternalContextsurfaceUpdateContextSurfaceRequestDTO {
  data_model?: GithubComRedislabsdevCloudContextEngineInternalContextmodelDataModel;
  /** @example "Updated description" */
  description?: string;
  /** @example {"key":"value"} */
  metadata?: Record<string, string>;
  /** @example "updated-surface" */
  name?: string;
}

export interface InternalObservabilityHealthResponse {
  /** @example {"storage":"UP","tool_storage":"UP"} */
  checks?: Record<string, string>;
  /** @example "UP" */
  status?: string;
}

export interface InternalRedisinstanceErrorResponse {
  /** @example "error message" */
  error?: string;
}

export interface InternalRedisinstanceListRedisInstancesResponse {
  /** Instances is the list of Redis instances */
  instances?: InternalRedisinstanceRedisInstanceResponse[];
  /** Total is the total number of instances */
  total?: number;
}

/** Redis connection configuration details */
export interface InternalRedisinstanceRedisConnectionConfig {
  /**
   * Addr is the Redis server address (e.g., "redis.example.com:6379")
   * For docker-compose setup, use "host.docker.internal:6380" to connect to redis-data
   * @example "host.docker.internal:6380"
   */
  addr?: string;
  /** CACert is the optional CA certificate for TLS verification */
  ca_cert?: string;
  /**
   * DB is the Redis database number
   * @example 0
   */
  db?: number;
  /**
   * MinIdleConns is the minimum number of idle connections
   * @example 2
   */
  min_idle_conns?: number;
  /**
   * Password is the Redis authentication password
   * @example ""
   */
  password?: string;
  /**
   * PoolSize is the maximum number of socket connections
   * @example 10
   */
  pool_size?: number;
  /**
   * TLSEnabled indicates whether TLS is enabled for the connection
   * @example false
   */
  tls_enabled?: boolean;
}

export interface InternalRedisinstanceRedisInstanceResponse {
  /** CreatedAt is the creation timestamp */
  created_at?: string;
  /** Description is the optional description */
  description?: string;
  /** ID is the unique identifier of the Redis instance */
  id?: string;
  /** Metadata is the metadata key-value pairs */
  metadata?: Record<string, string>;
  /** Name is the human-readable name */
  name?: string;
  /** Owner is the user ID of the owner */
  owner?: string;
  /** UpdatedAt is the last update timestamp */
  updated_at?: string;
}

/** Request to register a new Redis instance with connection details */
export interface InternalRedisinstanceRegisterRedisInstanceRequest {
  /** ConnectionConfig contains the Redis connection details */
  connection_config?: InternalRedisinstanceRedisConnectionConfig;
  /**
   * Description is an optional description of the Redis instance
   * @example "Redis instance for customer data"
   */
  description?: string;
  /**
   * Metadata is optional metadata key-value pairs
   * @example {"environment":"production","region":"us-west-2"}
   */
  metadata?: Record<string, string>;
  /**
   * Name is the human-readable name for the Redis instance
   * @example "My Redis Instance"
   */
  name?: string;
}

export interface InternalRedisinstanceTestConnectionRequest {
  /** ConnectionConfig contains the Redis connection details to test */
  connection_config?: InternalRedisinstanceRedisConnectionConfig;
}

export interface InternalRedisinstanceTestConnectionResponse {
  /** Error provides error details if the test failed */
  error?: string;
  /** Message provides additional information about the test result */
  message?: string;
  /** Success indicates whether the connection test was successful */
  success?: boolean;
}

export interface InternalServerCreateAPIKeyRequest {
  /** @example "API key for production service" */
  description?: string;
  /** @example {"environment":"production","team":"platform"} */
  metadata?: Record<string, string>;
  /** @example "Production API Key" */
  name: string;
  /** @example "service-xyz" */
  owner: string;
}

export interface InternalServerCreateAPIKeyResponse {
  /** @example "2025-12-26T10:00:00Z" */
  created_at?: string;
  /** @example "API key for production service" */
  description?: string;
  /** @example "550e8400-e29b-41d4-a716-446655440000" */
  id?: string;
  /** @example "660e8400-e29b-41d4-a716-446655440001" */
  key?: string;
  /** @example {"environment":"production","team":"platform"} */
  metadata?: Record<string, string>;
  /** @example "Production API Key" */
  name?: string;
  /** @example "service-xyz" */
  owner?: string;
  /** @example "2025-12-26T10:00:00Z" */
  updated_at?: string;
}

export interface InternalServerErrorResponse {
  /** @example "Invalid request" */
  error?: string;
}

export interface InternalServerValidateAPIKeyResponse {
  /** @example "2025-12-26T10:00:00Z" */
  created_at?: string;
  /** @example "API key for production service" */
  description?: string;
  /** @example "550e8400-e29b-41d4-a716-446655440000" */
  id?: string;
  /** @example "660e8400-e29b-41d4-a716-446655440001" */
  key?: string;
  /** @example {"environment":"production","team":"platform"} */
  metadata?: Record<string, string>;
  /** @example "Production API Key" */
  name?: string;
  /** @example "service-xyz" */
  owner?: string;
  /** @example "2025-12-26T10:00:00Z" */
  updated_at?: string;
  /** @example true */
  valid?: boolean;
}

export interface V1ContextSurfacesListParams {
  /**
   * Page number (default: 1)
   * @min 1
   */
  page?: number;
  /**
   * Items per page (default: 20, max: 100)
   * @min 1
   * @max 100
   */
  page_size?: number;
}

export type V1ContextSurfacesListData =
  InternalContextsurfaceListContextSurfacesResponseDTO;

export type V1ContextSurfacesListError = InternalContextsurfaceErrorResponse;

export type V1ContextSurfacesCreateData = InternalContextsurfaceResponseDTO;

export type V1ContextSurfacesCreateError = InternalContextsurfaceErrorResponse;

export interface V1ContextSurfacesDetailParams {
  /** Context surface ID */
  id: string;
}

export type V1ContextSurfacesDetailData = InternalContextsurfaceResponseDTO;

export type V1ContextSurfacesDetailError = InternalContextsurfaceErrorResponse;

export interface V1ContextSurfacesUpdateParams {
  /** Context surface ID */
  id: string;
}

export type V1ContextSurfacesUpdateData = InternalContextsurfaceResponseDTO;

export type V1ContextSurfacesUpdateError = InternalContextsurfaceErrorResponse;

export interface V1ContextSurfacesDeleteParams {
  /** Context surface ID */
  id: string;
}

export type V1ContextSurfacesDeleteData = any;

export type V1ContextSurfacesDeleteError = InternalContextsurfaceErrorResponse;

export interface V1ContextSurfacesAgentKeysListParams {
  /**
   * Page number (default: 1)
   * @min 1
   */
  page?: number;
  /**
   * Page size (default: 10, max: 100)
   * @min 1
   * @max 100
   */
  page_size?: number;
  /** Context Surface ID */
  id: string;
}

export type V1ContextSurfacesAgentKeysListData =
  InternalContextsurfaceListAgentKeysResponseDTO;

export type V1ContextSurfacesAgentKeysListError =
  InternalContextsurfaceErrorResponse;

export interface V1ContextSurfacesAgentKeysCreateParams {
  /** Context Surface ID */
  id: string;
}

export type V1ContextSurfacesAgentKeysCreateData =
  InternalContextsurfaceCreateAgentKeyResponseDTO;

export type V1ContextSurfacesAgentKeysCreateError =
  InternalContextsurfaceErrorResponse;

export type V1KeysCreateData = InternalServerCreateAPIKeyResponse;

export type V1KeysCreateError = InternalServerErrorResponse;

export type V1KeysValidateCreateData = InternalServerValidateAPIKeyResponse;

export type V1KeysValidateCreateError = InternalServerErrorResponse;

export type V1RedisInstancesListData =
  InternalRedisinstanceListRedisInstancesResponse;

export type V1RedisInstancesListError = InternalRedisinstanceErrorResponse;

export type V1RedisInstancesCreateData =
  InternalRedisinstanceRedisInstanceResponse;

export type V1RedisInstancesCreateError = InternalRedisinstanceErrorResponse;

export type V1RedisInstancesTestConnectionCreateData =
  InternalRedisinstanceTestConnectionResponse;

export type V1RedisInstancesTestConnectionCreateError =
  InternalRedisinstanceErrorResponse;

export interface V1RedisInstancesDetailParams {
  /** Redis instance ID */
  id: string;
}

export type V1RedisInstancesDetailData =
  InternalRedisinstanceRedisInstanceResponse;

export type V1RedisInstancesDetailError = InternalRedisinstanceErrorResponse;

export interface V1RedisInstancesDeleteParams {
  /** Redis instance ID */
  id: string;
}

export type V1RedisInstancesDeleteData = any;

export type V1RedisInstancesDeleteError = InternalRedisinstanceErrorResponse;

export type HealthListData = InternalObservabilityHealthResponse;

export type LivenessListData = InternalObservabilityHealthResponse;

export type ReadinessListData = InternalObservabilityHealthResponse;

export type ReadinessListError = InternalObservabilityHealthResponse;

export type PostMcpData =
  GithubComRedislabsdevCloudContextEngineInternalToolsJSONRPCSuccessResponse;

export type PostMcpError =
  | GithubComRedislabsdevCloudContextEngineInternalToolsJSONRPCErrorResponse
  | GithubComRedislabsdevCloudContextEngineInternalToolsErrorResponse;
