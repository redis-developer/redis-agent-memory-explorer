import { RedisAgentMemory } from "./redis-agent-memory";
import { MessageRole, MemoryType, FilterOp } from "./constants";
import { loadConfig, loadRamConfig, loadLlmConfig } from "./config";

export { RedisAgentMemory, MessageRole, MemoryType, FilterOp, loadConfig, loadRamConfig, loadLlmConfig };

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
} from "./types";
