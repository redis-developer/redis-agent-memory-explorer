import type {
  AgentMemoryConfig,
  SessionListOptions,
  SessionListResult,
  WorkingMemoryOptions,
  WorkingMemoryPayload,
  WorkingMemoryResult,
  MemoryRecordInput,
  MemoryRecordResult,
  MemoryEditInput,
  CreateMemoriesOptions,
  MemorySearchOptions,
  MemorySearchResult,
  SearchAllOptions,
  SearchAllResult,
  MemoryPromptRequest,
  MemoryPromptResult,
  ForgetPolicy,
  ForgetOptions,
  ForgetResult,
  CreateSummaryViewInput,
  SummaryViewResult,
  SummaryPartitionResult,
  PartitionListFilters,
  TaskResult,
  AckResult,
  HealthResult,
  RawClientConfig,
} from "./types";

import { MemoryAPIClient } from "agent-memory-client";

import { ENV } from "./config";
import { DEFAULT_TIMEOUT_MS } from "./constants";
import {
  listSessionsOp,
  getWorkingMemoryOp,
  putWorkingMemoryOp,
  getOrCreateWorkingMemoryOp,
  deleteWorkingMemoryOp,
} from "./operations/working-memory";
import {
  createLongTermMemoriesOp,
  searchLongTermMemoryOp,
  searchAllLongTermMemoriesOp,
  getLongTermMemoryOp,
  editLongTermMemoryOp,
  deleteLongTermMemoriesOp,
} from "./operations/long-term-memory";
import { memoryPromptOp } from "./operations/memory-prompt";
import { forgetLongTermMemoriesOp } from "./operations/forget";
import {
  createSummaryViewOp,
  listSummaryViewsOp,
  getSummaryViewOp,
  deleteSummaryViewOp,
  runSummaryViewPartitionOp,
  listSummaryViewPartitionsOp,
  runSummaryViewOp,
  getTaskOp,
} from "./operations/summary-view";

const buildClientConfig = (
  config?: AgentMemoryConfig,
): ConstructorParameters<typeof MemoryAPIClient>[0] => {
  const baseUrl = config?.baseUrl ?? ENV.AGENT_MEMORY_BASE_URL;
  const timeout = config?.timeout ?? ENV.AGENT_MEMORY_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS;
  const apiKey = config?.apiKey ?? (ENV.AGENT_MEMORY_API_KEY || undefined);
  const bearerToken =
    config?.bearerToken ?? (ENV.AGENT_MEMORY_BEARER_TOKEN || undefined);
  const defaultNamespace =
    config?.defaultNamespace ?? (ENV.AGENT_MEMORY_DEFAULT_NAMESPACE || undefined);
  const defaultModelName =
    config?.defaultModelName as ConstructorParameters<typeof MemoryAPIClient>[0]["defaultModelName"];
  const defaultContextWindowMax = config?.defaultContextWindowMax;

  return {
    baseUrl,
    timeout,
    apiKey,
    bearerToken,
    defaultNamespace,
    defaultModelName,
    defaultContextWindowMax,
  };
};

class AgentMemory {
  static #instance: AgentMemory | null = null;

  #client: MemoryAPIClient;
  #rawConfig: RawClientConfig;

  private constructor(client: MemoryAPIClient, rawConfig: RawClientConfig) {
    this.#client = client;
    this.#rawConfig = rawConfig;
  }

  static create = (config?: AgentMemoryConfig): AgentMemory => {
    const clientConfig = buildClientConfig(config);
    const client = new MemoryAPIClient(clientConfig);

    const rawConfig: RawClientConfig = {
      baseUrl: clientConfig.baseUrl,
      apiKey: clientConfig.apiKey,
      bearerToken: clientConfig.bearerToken,
      defaultNamespace: clientConfig.defaultNamespace,
      timeout: clientConfig.timeout,
    };

    const instance = new AgentMemory(client, rawConfig);
    AgentMemory.#instance = instance;

    return instance;
  };

  static getInstance = (): AgentMemory => {
    const isNotInitialized = AgentMemory.#instance === null;

    if (isNotInitialized) {
      throw new Error(
        "AgentMemory not initialized. Call AgentMemory.create() first.",
      );
    }

    return AgentMemory.#instance!;
  };

  close = async (): Promise<void> => {
    const isSingleton = AgentMemory.#instance === this;
    if (isSingleton) {
      AgentMemory.#instance = null;
    }

    this.#client.close();
  };

  //#region Health

  healthCheck = async (): Promise<HealthResult> => {
    const response = await this.#client.healthCheck();

    return { now: response.now };
  };

  //#endregion

  //#region Working Memory

  listSessions = async (
    options?: SessionListOptions,
  ): Promise<SessionListResult> => {
    return listSessionsOp(this.#client, options, this.#rawConfig);
  };

  getWorkingMemory = async (
    sessionId: string,
    options?: WorkingMemoryOptions,
  ): Promise<WorkingMemoryResult | null> => {
    return getWorkingMemoryOp(this.#client, sessionId, options, this.#rawConfig);
  };

  putWorkingMemory = async (
    sessionId: string,
    payload: WorkingMemoryPayload,
    options?: WorkingMemoryOptions,
  ): Promise<WorkingMemoryResult> => {
    return putWorkingMemoryOp(this.#client, sessionId, payload, options);
  };

  getOrCreateWorkingMemory = async (
    sessionId: string,
    options?: WorkingMemoryOptions,
  ): Promise<{ created: boolean; memory: WorkingMemoryResult }> => {
    return getOrCreateWorkingMemoryOp(this.#client, sessionId, options, this.#rawConfig);
  };

  deleteWorkingMemory = async (
    sessionId: string,
    options?: { namespace?: string; userId?: string },
  ): Promise<AckResult> => {
    return deleteWorkingMemoryOp(this.#client, sessionId, options, this.#rawConfig);
  };

  //#endregion

  //#region Long-Term Memory

  createLongTermMemories = async (
    memories: MemoryRecordInput[],
    options?: CreateMemoriesOptions,
  ): Promise<AckResult> => {
    return createLongTermMemoriesOp(this.#client, memories, options, this.#rawConfig);
  };

  searchLongTermMemory = async (
    options: MemorySearchOptions,
  ): Promise<MemorySearchResult> => {
    return searchLongTermMemoryOp(this.#client, options);
  };

  searchAllLongTermMemories = async (
    options: SearchAllOptions,
  ): Promise<SearchAllResult> => {
    return searchAllLongTermMemoriesOp(this.#client, options);
  };

  getLongTermMemory = async (
    memoryId: string,
  ): Promise<MemoryRecordResult | null> => {
    return getLongTermMemoryOp(this.#client, memoryId);
  };

  editLongTermMemory = async (
    memoryId: string,
    updates: MemoryEditInput,
  ): Promise<MemoryRecordResult> => {
    return editLongTermMemoryOp(this.#client, memoryId, updates);
  };

  deleteLongTermMemories = async (
    memoryIds: string[],
  ): Promise<AckResult> => {
    return deleteLongTermMemoriesOp(this.#client, memoryIds);
  };

  //#endregion

  //#region Memory Prompt

  memoryPrompt = async (
    request: MemoryPromptRequest,
  ): Promise<MemoryPromptResult> => {
    return memoryPromptOp(this.#client, request);
  };

  //#endregion

  //#region Forget / Lifecycle

  forgetLongTermMemories = async (
    policy: ForgetPolicy,
    options?: ForgetOptions,
  ): Promise<ForgetResult> => {
    return forgetLongTermMemoriesOp(this.#client, policy, options);
  };

  //#endregion

  //#region Summary Views

  createSummaryView = async (
    request: CreateSummaryViewInput,
  ): Promise<SummaryViewResult> => {
    return createSummaryViewOp(this.#client, request);
  };

  listSummaryViews = async (): Promise<SummaryViewResult[]> => {
    return listSummaryViewsOp(this.#client);
  };

  getSummaryView = async (
    viewId: string,
  ): Promise<SummaryViewResult | null> => {
    return getSummaryViewOp(this.#client, viewId);
  };

  deleteSummaryView = async (viewId: string): Promise<AckResult> => {
    return deleteSummaryViewOp(this.#client, viewId);
  };

  runSummaryViewPartition = async (
    viewId: string,
    group: Record<string, string>,
  ): Promise<SummaryPartitionResult> => {
    return runSummaryViewPartitionOp(this.#client, viewId, group);
  };

  listSummaryViewPartitions = async (
    viewId: string,
    filters?: PartitionListFilters,
  ): Promise<SummaryPartitionResult[]> => {
    return listSummaryViewPartitionsOp(this.#client, viewId, filters);
  };

  runSummaryView = async (
    viewId: string,
    options?: { force?: boolean },
  ): Promise<TaskResult> => {
    return runSummaryViewOp(this.#client, viewId, options);
  };

  //#endregion

  //#region Tasks

  getTask = async (taskId: string): Promise<TaskResult | null> => {
    return getTaskOp(this.#client, taskId);
  };

  //#endregion
}

export { AgentMemory };
