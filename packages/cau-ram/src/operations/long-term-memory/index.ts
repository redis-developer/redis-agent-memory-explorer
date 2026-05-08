import type {
  CreateMemoryInput,
  MemoryRecord,
  MemorySearchOptions,
  MemorySearchResult,
  MemoryUpdateInput,
  BulkCreateResult,
  BulkDeleteResult,
} from "../../types";

import { randomUUID } from "node:crypto";
import { AgentMemory } from "@redis-ai/agent-memory";

import { DEFAULT_LTM_SEARCH_LIMIT } from "../../constants";
import { buildLongTermMemoryFilter, mapFilterOp } from "./build-filters.util";

const mapSdkRecordToMemoryRecord = (sdkRecord: {
  id: string;
  text: string;
  memoryType?: string;
  sessionId?: string;
  ownerId?: string;
  namespace?: string;
  topics?: string[];
  createdAt: number;
  updatedAt: number;
}): MemoryRecord => {
  return {
    id: sdkRecord.id,
    text: sdkRecord.text,
    memoryType: sdkRecord.memoryType as MemoryRecord["memoryType"],
    sessionId: sdkRecord.sessionId,
    ownerId: sdkRecord.ownerId,
    namespace: sdkRecord.namespace,
    topics: sdkRecord.topics,
    createdAt: sdkRecord.createdAt,
    updatedAt: sdkRecord.updatedAt,
  };
};

const createLongTermMemories = async (
  client: AgentMemory,
  records: CreateMemoryInput[],
): Promise<BulkCreateResult> => {
  const sdkRecords = records.map((r) => ({
    id: r.id ?? randomUUID(),
    text: r.text,
    memoryType: r.memoryType as any,
    sessionId: r.sessionId,
    ownerId: r.ownerId,
    namespace: r.namespace,
    topics: r.topics,
  }));

  const response = await client.bulkCreateLongTermMemories({ memories: sdkRecords });

  return {
    created: response.created,
    errors: response.errors?.map((e) => ({ id: e.id, message: e.error })),
  };
};

const searchLongTermMemory = async (
  client: AgentMemory,
  options?: MemorySearchOptions,
): Promise<MemorySearchResult> => {
  const hasText = !!options?.text;
  const hasFilter = !!options?.filter && Object.keys(options.filter).length > 0;

  if (!hasText && !hasFilter) {
    throw new Error("searchLongTermMemory requires at least one of 'text' or 'filter'.");
  }

  const cloudFilter = buildLongTermMemoryFilter(options?.filter);
  const filterOp = mapFilterOp(options?.filterOp);

  const response = await client.searchLongTermMemory({
    text: options?.text,
    filter: cloudFilter,
    filterOp,
    limit: options?.limit ?? DEFAULT_LTM_SEARCH_LIMIT,
    pageToken: options?.pageToken,
    similarityThreshold: options?.similarityThreshold,
  });

  return {
    memories: response.memories.map(mapSdkRecordToMemoryRecord),
    nextPageToken: response.nextPageToken,
  };
};

const searchAllLongTermMemory = async (
  client: AgentMemory,
  options?: Omit<MemorySearchOptions, "pageToken">,
): Promise<{ memories: MemoryRecord[] }> => {
  const hasText = !!options?.text;
  const hasFilter = !!options?.filter && Object.keys(options.filter).length > 0;

  if (!hasText && !hasFilter) {
    throw new Error("searchAllLongTermMemory requires at least one of 'text' or 'filter'.");
  }

  const allMemories: MemoryRecord[] = [];
  let pageToken: string | undefined = undefined;

  let hasMore = true;
  while (hasMore) {
    const result = await searchLongTermMemory(client, {
      ...options,
      pageToken,
    });
    allMemories.push(...result.memories);
    pageToken = result.nextPageToken;
    hasMore = !!pageToken;
  }

  return { memories: allMemories };
};

const getLongTermMemory = async (
  client: AgentMemory,
  memoryId: string,
): Promise<MemoryRecord> => {
  const response = await client.getLongTermMemory(memoryId);

  return mapSdkRecordToMemoryRecord(response);
};

const updateLongTermMemory = async (
  client: AgentMemory,
  memoryId: string,
  updates: MemoryUpdateInput,
): Promise<MemoryRecord> => {
  const response = await client.updateLongTermMemory(memoryId, {
    text: updates.text,
    memoryType: updates.memoryType as any,
    topics: updates.topics,
    namespace: updates.namespace,
    ownerId: updates.ownerId,
    sessionId: updates.sessionId,
  });

  return mapSdkRecordToMemoryRecord(response);
};

const deleteLongTermMemories = async (
  client: AgentMemory,
  memoryIds: string[],
): Promise<BulkDeleteResult> => {
  const response = await client.bulkDeleteLongTermMemories({ memoryIds });

  return {
    deleted: response.deleted,
    errors: response.errors?.map((e) => ({ id: e.id, message: e.error })),
  };
};

export {
  createLongTermMemories,
  searchLongTermMemory,
  searchAllLongTermMemory,
  getLongTermMemory,
  updateLongTermMemory,
  deleteLongTermMemories,
};
