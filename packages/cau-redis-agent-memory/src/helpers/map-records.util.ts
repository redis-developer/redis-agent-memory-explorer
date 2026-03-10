import type {
  MemoryRecord as SdkMemoryRecord,
  MemoryRecordResult as SdkMemoryRecordResult,
  WorkingMemoryResponse as SdkWorkingMemoryResponse,
  MemoryMessage as SdkMemoryMessage,
} from "agent-memory-client";
import type {
  MemoryMessage,
  MemoryRecordInput,
  MemoryRecordResult,
  WorkingMemoryResult,
} from "../types";
import type { MemoryType } from "../constants";

import { randomUUID } from "node:crypto";

const mapSdkMessageToMessage = (msg: SdkMemoryMessage): MemoryMessage => {
  return {
    role: msg.role,
    content: msg.content,
    id: msg.id,
    createdAt: msg.created_at,
  };
};

const mapSdkRecordToResult = (
  rec: SdkMemoryRecord | SdkMemoryRecordResult,
): MemoryRecordResult => {
  const dist = "dist" in rec ? (rec as SdkMemoryRecordResult).dist : null;

  return {
    id: rec.id,
    text: rec.text,
    memoryType: (rec.memory_type ?? "semantic") as MemoryType,
    topics: rec.topics ?? null,
    entities: rec.entities ?? null,
    userId: rec.user_id ?? null,
    sessionId: rec.session_id ?? null,
    namespace: rec.namespace ?? null,
    eventDate: rec.event_date ?? null,
    createdAt: rec.created_at ?? "",
    updatedAt: rec.updated_at ?? "",
    lastAccessed: rec.last_accessed ?? "",
    persistedAt: rec.persisted_at ?? null,
    pinned: false,
    accessCount: 0,
    memoryHash: rec.memory_hash ?? null,
    dist,
  };
};

const mapSdkWorkingMemoryToResult = (
  response: SdkWorkingMemoryResponse,
): WorkingMemoryResult => {
  const raw = response as unknown as Record<string, unknown>;

  return {
    sessionId: response.session_id,
    messages: (response.messages ?? []).map(mapSdkMessageToMessage),
    memories: (response.memories ?? []).map(mapSdkRecordToResult),
    data: (response.data as Record<string, unknown>) ?? null,
    context: response.context ?? null,
    userId: response.user_id ?? null,
    namespace: response.namespace ?? null,
    tokens: response.tokens ?? 0,
    ttlSeconds: response.ttl_seconds ?? null,
    lastAccessed: response.last_accessed ?? "",
    createdAt: (raw["created_at"] as string) ?? "",
    updatedAt: (raw["updated_at"] as string) ?? "",
    contextPercentageTotalUsed: response.context_percentage_total_used ?? null,
    contextPercentageUntilSummarization:
      response.context_percentage_until_summarization ?? null,
  };
};

const mapInputToSdkRecord = (input: MemoryRecordInput): SdkMemoryRecord => {
  return {
    id: input.id ?? randomUUID(),
    text: input.text,
    memory_type: input.memoryType as SdkMemoryRecord["memory_type"],
    topics: input.topics,
    entities: input.entities,
    user_id: input.userId,
    session_id: input.sessionId,
    namespace: input.namespace,
    event_date: input.eventDate,
  };
};

const mapMessageToSdkMessage = (msg: MemoryMessage): SdkMemoryMessage => {
  return {
    role: msg.role,
    content: msg.content,
    id: msg.id,
    created_at: msg.createdAt,
  };
};

export {
  mapSdkMessageToMessage,
  mapSdkRecordToResult,
  mapSdkWorkingMemoryToResult,
  mapInputToSdkRecord,
  mapMessageToSdkMessage,
};
