import type { MessageRole, MemoryType, FilterOp } from "./constants";

// ── Session Memory ──

type SessionEventInput = {
  sessionId: string;
  actorId: string;
  role: MessageRole;
  content: string;
  createdAt?: number;
  metadata?: Record<string, unknown>;
};

type SessionEvent = {
  eventId: string;
  sessionId: string;
  actorId: string;
  role: MessageRole;
  content: string;
  createdAt: number;
  metadata?: Record<string, unknown>;
};

type SessionMemory = {
  sessionId: string;
  ownerId: string;
  events: SessionEvent[];
};

type SessionListOptions = {
  limit?: number;
  offset?: number;
};

type SessionListResult = {
  sessions: string[];
  total: number;
};

// ── Long-Term Memory ──

type CreateMemoryInput = {
  text: string;
  id?: string;
  memoryType?: MemoryType;
  sessionId?: string;
  ownerId?: string;
  namespace?: string;
  topics?: string[];
};

type MemoryRecord = {
  id: string;
  text: string;
  memoryType?: MemoryType;
  sessionId?: string;
  ownerId?: string;
  namespace?: string;
  topics?: string[];
  createdAt: number;
  updatedAt: number;
};

type MemoryFilter = {
  sessionId?: string;
  ownerId?: string;
  namespace?: string;
  topics?: string[];
  memoryType?: MemoryType;
  createdAfter?: number;
  createdBefore?: number;
};

type MemorySearchOptions = {
  text?: string;
  filter?: MemoryFilter;
  filterOp?: FilterOp;
  limit?: number;
  pageToken?: string;
  similarityThreshold?: number;
};

type MemorySearchResult = {
  memories: MemoryRecord[];
  nextPageToken?: string;
};

type MemoryUpdateInput = {
  text?: string;
  memoryType?: MemoryType;
  topics?: string[];
  namespace?: string;
  ownerId?: string;
  sessionId?: string;
};

type BulkCreateResult = {
  created: string[];
  errors?: Array<{ id: string; message: string }>;
};

type BulkDeleteResult = {
  deleted: string[];
  errors?: Array<{ id: string; message: string }>;
};

// ── Config ──

type RamConfig = {
  endpoint: string;
  apiKey: string;
  storeId: string;
};

type LlmConfig = {
  provider: string;
  model: string;
  apiKey: string;
};

type RedisAgentMemoryConfig = {
  ram: RamConfig;
  llm?: LlmConfig;
};

// ── Health ──

type HealthResult = {
  status: string;
};

export type {
  SessionEventInput,
  SessionEvent,
  SessionMemory,
  SessionListOptions,
  SessionListResult,
  CreateMemoryInput,
  MemoryRecord,
  MemoryFilter,
  MemorySearchOptions,
  MemorySearchResult,
  MemoryUpdateInput,
  BulkCreateResult,
  BulkDeleteResult,
  RamConfig,
  LlmConfig,
  RedisAgentMemoryConfig,
  HealthResult,
};
