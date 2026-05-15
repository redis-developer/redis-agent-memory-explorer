import type { OnConflict, OnError } from "./constants";

// ── Config ──

type ContextSurfacesConfig = {
  adminApiUrl?: string;
  mcpUrl?: string;
  adminKey?: string;
  agentKey?: string;
  timeout?: number;
  retries?: number;
};

// ── Data Model ──

type DataModel = {
  title: string;
  description: string;
  entities: EntityDescription[];
  entityCount?: number;
};

type EntityDescription = {
  name: string;
  description: string;
  redisKeyTemplate?: string;
  fields?: FieldDescription[];
  relationships?: RelationshipDescription[];
};

type FieldDescription = {
  name: string;
  type: string;
  description: string;
  mutable?: boolean;
  isKeyComponent?: boolean;
  redisIndices?: RedisIndexConfig[];
};

type RedisIndexConfig = {
  type: string;
  weight?: number;
  noStem?: boolean;
  sortable?: boolean;
  vectorDim?: number;
  distanceMetric?: string;
};

type RelationshipDescription = {
  name: string;
  target: string;
  description: string;
  sourceField: string;
};

// ── Surfaces ──

type CreateSurfaceInput = {
  name: string;
  description?: string;
  dataModel?: DataModel;
  dataSource?: DataSourceConfig;
  metadata?: Record<string, string>;
};

type DataSourceConfig = {
  type: "redis";
  name: string;
  connectionConfig: RedisConnectionConfig;
};

type RedisConnectionConfig = {
  addr: string;
  username?: string;
  password?: string;
  db?: number;
  tlsEnabled?: boolean;
  poolSize?: number;
  minIdleConns?: number;
};

type Surface = {
  id: string;
  name: string;
  description?: string;
  owner: string;
  status?: string;
  statusReason?: string;
  tools?: string[];
  dataModel?: DataModel;
  metadata?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
};

type UpdateSurfaceInput = {
  name?: string;
  description?: string;
  metadata?: Record<string, string>;
};

type ListSurfacesResult = {
  surfaces: Surface[];
  pagination?: Pagination;
};

// ── Agent Keys ──

type CreateAgentKeyInput = {
  name: string;
  description?: string;
  expiresAt?: string;
  metadata?: Record<string, string>;
};

type AgentKey = {
  id: string;
  key: string;
  name: string;
  contextSurfaceId: string;
  description?: string;
  metadata?: Record<string, string>;
  createdAt: string;
  expiresAt?: string;
};

type ListAgentKeysResult = {
  agentKeys: AgentKey[];
  pagination?: Pagination;
};

// ── MCP ──

type McpTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

type McpToolResult = {
  content?: Array<{ type: string; text?: string }>;
  isError?: boolean;
};

type McpInitResult = {
  protocolVersion: string;
  capabilities: Record<string, unknown>;
  serverInfo: { name: string; version: string };
};

// ── Data Loading ──

type LoadRecordsInput = {
  entity: string;
  records: Record<string, unknown>[];
  options?: {
    onConflict?: OnConflict;
    onError?: OnError;
  };
};

type LoadRecordsResult = {
  loaded: number;
  errors?: Array<{ index: number; message: string }>;
};

// ── Pagination ──

type Pagination = {
  page?: number;
  pageSize?: number;
  totalCount?: number;
  totalPages?: number;
  hasNext?: boolean;
  hasPrev?: boolean;
};

type ListOptions = {
  page?: number;
  pageSize?: number;
};

// ── JSON-RPC ──

type JsonRpcRequest = {
  jsonrpc: string;
  id: number;
  method: string;
  params: Record<string, unknown>;
};

type JsonRpcResult = {
  result: unknown;
};

type JsonRpcError = {
  code: number;
  message: string;
  data?: unknown;
};

// ── Key Validation ──

type KeyValidation = {
  valid: boolean;
  owner?: string;
};

type HealthResult = {
  status: string;
  version?: string;
};

export type {
  ContextSurfacesConfig,
  DataModel,
  EntityDescription,
  FieldDescription,
  RedisIndexConfig,
  RelationshipDescription,
  CreateSurfaceInput,
  DataSourceConfig,
  RedisConnectionConfig,
  Surface,
  UpdateSurfaceInput,
  ListSurfacesResult,
  CreateAgentKeyInput,
  AgentKey,
  ListAgentKeysResult,
  McpTool,
  McpToolResult,
  McpInitResult,
  LoadRecordsInput,
  LoadRecordsResult,
  Pagination,
  ListOptions,
  JsonRpcRequest,
  JsonRpcResult,
  JsonRpcError,
  KeyValidation,
  HealthResult,
};
