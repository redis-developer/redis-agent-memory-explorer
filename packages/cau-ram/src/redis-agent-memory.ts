import type {
  RedisAgentMemoryConfig,
  SessionEventInput,
  SessionEvent,
  SessionMemory,
  SessionListOptions,
  SessionListResult,
  CreateMemoryInput,
  MemoryRecord,
  MemorySearchOptions,
  MemorySearchResult,
  MemoryUpdateInput,
  BulkCreateResult,
  BulkDeleteResult,
  BuildMemoryPromptOptions,
  MemoryPromptResult,
  HealthResult,
} from "./types";

import { AgentMemory } from "@redis-ai/agent-memory";

import { loadConfig } from "./config";
import {
  addSessionEvent as addSessionEventOp,
  getSessionMemory as getSessionMemoryOp,
  getSessionEvent as getSessionEventOp,
  deleteSessionEvent as deleteSessionEventOp,
  deleteSessionMemory as deleteSessionMemoryOp,
  listSessions as listSessionsOp,
} from "./operations/session-memory";
import {
  createLongTermMemories as createLongTermMemoriesOp,
  searchLongTermMemory as searchLongTermMemoryOp,
  searchAllLongTermMemory as searchAllLongTermMemoryOp,
  getLongTermMemory as getLongTermMemoryOp,
  updateLongTermMemory as updateLongTermMemoryOp,
  deleteLongTermMemories as deleteLongTermMemoriesOp,
} from "./operations/long-term-memory";
import { buildMemoryPrompt as buildMemoryPromptOp } from "./operations/memory-prompt";

let instance: RedisAgentMemory | null = null;

class RedisAgentMemory {
  private client: AgentMemory;
  private config: RedisAgentMemoryConfig;

  private constructor(config: RedisAgentMemoryConfig) {
    this.config = config;
    this.client = new AgentMemory({
      serverURL: config.ram.endpoint,
      apiKey: config.ram.apiKey,
      storeId: config.ram.storeId,
    });
  }

  static create = (configOverride?: Partial<RedisAgentMemoryConfig>): RedisAgentMemory => {
    const envConfig = loadConfig();
    const mergedConfig: RedisAgentMemoryConfig = {
      ram: { ...envConfig.ram, ...configOverride?.ram },
      llm: configOverride?.llm ?? envConfig.llm,
    };

    instance = new RedisAgentMemory(mergedConfig);

    return instance;
  };

  static getInstance = (): RedisAgentMemory => {
    if (!instance) {
      throw new Error("RedisAgentMemory not initialized. Call RedisAgentMemory.create() first.");
    }

    return instance;
  };

  static resetInstance = (): void => {
    instance = null;
  };

  // ── Health ──

  health = async (): Promise<HealthResult> => {
    const response = await this.client.health();

    return { status: response.status };
  };

  // ── Session Memory ──

  addSessionEvent = async (input: SessionEventInput): Promise<SessionEvent> => {
    return addSessionEventOp(this.client, input);
  };

  getSessionMemory = async (sessionId: string): Promise<SessionMemory | null> => {
    return getSessionMemoryOp(this.client, sessionId);
  };

  getSessionEvent = async (sessionId: string, eventId: string): Promise<SessionEvent> => {
    return getSessionEventOp(this.client, sessionId, eventId);
  };

  deleteSessionEvent = async (sessionId: string, eventId: string): Promise<void> => {
    return deleteSessionEventOp(this.client, sessionId, eventId);
  };

  deleteSessionMemory = async (sessionId: string): Promise<void> => {
    return deleteSessionMemoryOp(this.client, sessionId);
  };

  listSessions = async (options?: SessionListOptions): Promise<SessionListResult> => {
    return listSessionsOp(this.client, options);
  };

  // ── Long-Term Memory ──

  createLongTermMemories = async (records: CreateMemoryInput[]): Promise<BulkCreateResult> => {
    return createLongTermMemoriesOp(this.client, records);
  };

  searchLongTermMemory = async (options?: MemorySearchOptions): Promise<MemorySearchResult> => {
    return searchLongTermMemoryOp(this.client, options);
  };

  searchAllLongTermMemory = async (
    options?: Omit<MemorySearchOptions, "pageToken">,
  ): Promise<{ memories: MemoryRecord[] }> => {
    return searchAllLongTermMemoryOp(this.client, options);
  };

  getLongTermMemory = async (memoryId: string): Promise<MemoryRecord> => {
    return getLongTermMemoryOp(this.client, memoryId);
  };

  updateLongTermMemory = async (memoryId: string, updates: MemoryUpdateInput): Promise<MemoryRecord> => {
    return updateLongTermMemoryOp(this.client, memoryId, updates);
  };

  deleteLongTermMemories = async (memoryIds: string[]): Promise<BulkDeleteResult> => {
    return deleteLongTermMemoriesOp(this.client, memoryIds);
  };

  // ── Memory Prompt ──

  buildMemoryPrompt = async (options: BuildMemoryPromptOptions): Promise<MemoryPromptResult> => {
    return buildMemoryPromptOp(this.client, this.config.llm, options);
  };
}

export { RedisAgentMemory };
