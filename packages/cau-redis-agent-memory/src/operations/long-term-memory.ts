import type { MemoryAPIClient, SearchOptions } from "agent-memory-client";
import type {
  MemoryRecordInput,
  MemoryRecordResult,
  MemoryEditInput,
  MemorySearchOptions,
  MemorySearchResult,
  SearchAllOptions,
  SearchAllResult,
  CreateMemoriesOptions,
  AckResult,
  RawClientConfig,
} from "../types";

import { DEFAULT_SEARCH_ALL_BATCH_SIZE } from "../constants";
import {
  mapInputToSdkRecord,
  mapSdkRecordToResult,
} from "../helpers/map-records.util";
import { buildSearchFilters } from "../helpers/build-search-filters.util";
import { rawPost } from "../helpers/raw-client.util";

/**
 * The SDK (agent-memory-client@0.3.1) does not support `deduplicate`
 * in the CreateMemoryRecordRequest body. When `deduplicate` is provided
 * we bypass the SDK and issue a raw HTTP POST.
 */
const createLongTermMemoriesOp = async (
  client: MemoryAPIClient,
  memories: MemoryRecordInput[],
  options?: CreateMemoriesOptions,
  rawConfig?: RawClientConfig,
): Promise<AckResult> => {
  const sdkRecords = memories.map(mapInputToSdkRecord);
  const hasDeduplicate = options?.deduplicate !== undefined;
  const shouldUseRawClient = hasDeduplicate && rawConfig !== undefined;

  let response: { status: string };

  if (shouldUseRawClient) {
    response = await rawPost<{ status: string }>(
      rawConfig!,
      "/v1/long-term-memory/",
      {
        memories: sdkRecords,
        deduplicate: options!.deduplicate,
      },
    );
  } else {
    response = await client.createLongTermMemory(sdkRecords);
  }

  return { status: response.status };
};

const searchLongTermMemoryOp = async (
  client: MemoryAPIClient,
  options: MemorySearchOptions,
): Promise<MemorySearchResult> => {
  const sdkOptions = buildSearchFilters(options) as SearchOptions;
  const response = await client.searchLongTermMemory(sdkOptions);

  return {
    memories: response.memories.map(mapSdkRecordToResult),
    total: response.total,
    nextOffset: response.next_offset ?? null,
  };
};

/**
 * Auto-paginating search that collects all matching long-term memories.
 * Iterates with `batchSize` (default 100, the AMS server max) until all
 * pages are exhausted, then returns the full flat array.
 */
const searchAllLongTermMemoriesOp = async (
  client: MemoryAPIClient,
  options: SearchAllOptions,
): Promise<SearchAllResult> => {
  const { batchSize, ...searchOptions } = options;
  const resolvedBatchSize = batchSize ?? DEFAULT_SEARCH_ALL_BATCH_SIZE;

  const allMemories: MemoryRecordResult[] = [];
  let offset = 0;
  let lastTotal = 0;
  let batch: MemorySearchResult;

  do {
    batch = await searchLongTermMemoryOp(client, {
      ...searchOptions,
      limit: resolvedBatchSize,
      offset,
    });
    allMemories.push(...batch.memories);
    lastTotal = batch.total;
    offset += resolvedBatchSize;
  } while (batch.memories.length >= resolvedBatchSize);

  return {
    memories: allMemories,
    total: lastTotal,
  };
};

const getLongTermMemoryOp = async (
  client: MemoryAPIClient,
  memoryId: string,
): Promise<MemoryRecordResult | null> => {
  const response = await client.getLongTermMemory(memoryId);

  const isNotFound = response === null;

  return isNotFound ? null : mapSdkRecordToResult(response);
};

const editLongTermMemoryOp = async (
  client: MemoryAPIClient,
  memoryId: string,
  updates: MemoryEditInput,
): Promise<MemoryRecordResult> => {
  const sdkUpdates: Record<string, unknown> = {};

  const hasText = updates.text !== undefined;
  if (hasText) {
    sdkUpdates.text = updates.text;
  }

  const hasTopics = updates.topics !== undefined;
  if (hasTopics) {
    sdkUpdates.topics = updates.topics;
  }

  const hasEntities = updates.entities !== undefined;
  if (hasEntities) {
    sdkUpdates.entities = updates.entities;
  }

  const hasMemoryType = updates.memoryType !== undefined;
  if (hasMemoryType) {
    sdkUpdates.memory_type = updates.memoryType;
  }

  const hasEventDate = updates.eventDate !== undefined;
  if (hasEventDate) {
    sdkUpdates.event_date = updates.eventDate;
  }

  const hasNamespace = updates.namespace !== undefined;
  if (hasNamespace) {
    sdkUpdates.namespace = updates.namespace;
  }

  const hasUserId = updates.userId !== undefined;
  if (hasUserId) {
    sdkUpdates.user_id = updates.userId;
  }

  const hasSessionId = updates.sessionId !== undefined;
  if (hasSessionId) {
    sdkUpdates.session_id = updates.sessionId;
  }

  const response = await client.editLongTermMemory(
    memoryId,
    sdkUpdates as Parameters<typeof client.editLongTermMemory>[1],
  );

  return mapSdkRecordToResult(response);
};

const deleteLongTermMemoriesOp = async (
  client: MemoryAPIClient,
  memoryIds: string[],
): Promise<AckResult> => {
  const response = await client.deleteLongTermMemories(memoryIds);

  return { status: response.status };
};

export {
  createLongTermMemoriesOp,
  searchLongTermMemoryOp,
  searchAllLongTermMemoriesOp,
  getLongTermMemoryOp,
  editLongTermMemoryOp,
  deleteLongTermMemoriesOp,
};
