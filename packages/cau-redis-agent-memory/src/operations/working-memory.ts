import type { MemoryAPIClient, WorkingMemoryResponse as SdkWorkingMemoryResponse } from "agent-memory-client";
import type {
  SessionListOptions,
  SessionListResult,
  WorkingMemoryOptions,
  WorkingMemoryPayload,
  WorkingMemoryResult,
  AckResult,
  RawClientConfig,
} from "../types";

import { DEFAULT_SESSION_LIST_LIMIT } from "../constants";
import {
  mapSdkWorkingMemoryToResult,
  mapInputToSdkRecord,
  mapMessageToSdkMessage,
} from "../helpers/map-records.util";
import { rawGet, rawDelete } from "../helpers/raw-client.util";

const listSessionsOp = async (
  client: MemoryAPIClient,
  options?: SessionListOptions,
): Promise<SessionListResult> => {
  const response = await client.listSessions({
    namespace: options?.namespace,
    limit: options?.limit ?? DEFAULT_SESSION_LIST_LIMIT,
    offset: options?.offset,
  });

  return {
    sessions: response.sessions,
    total: response.total,
  };
};

/**
 * The SDK (agent-memory-client@0.3.1) does not support `user_id` as a
 * query parameter on GET /v1/working-memory/{session_id}. The server
 * includes `user_id` in the Redis key, so omitting it causes a key
 * mismatch (reads a different/empty key). When `userId` is provided we
 * bypass the SDK and issue a raw HTTP GET with the `user_id` param.
 *
 * See: https://github.com/redis/agent-memory-server/issues/185
 */
const getWorkingMemoryOp = async (
  client: MemoryAPIClient,
  sessionId: string,
  options?: WorkingMemoryOptions,
  rawConfig?: RawClientConfig,
): Promise<WorkingMemoryResult | null> => {
  const hasUserId = options?.userId !== undefined;
  const shouldUseRawClient = hasUserId && rawConfig !== undefined;

  let response: SdkWorkingMemoryResponse | null;

  if (shouldUseRawClient) {
    response = await rawGet<SdkWorkingMemoryResponse>(
      rawConfig!,
      `/v1/working-memory/${encodeURIComponent(sessionId)}`,
      {
        namespace: options?.namespace,
        user_id: options?.userId,
        model_name: options?.modelName,
        context_window_max: options?.contextWindowMax,
      },
    );
  } else {
    response = await client.getWorkingMemory(sessionId, {
      namespace: options?.namespace,
      modelName: options?.modelName as Parameters<
        typeof client.getWorkingMemory
      >[1] extends { modelName?: infer M } ? M : never,
      contextWindowMax: options?.contextWindowMax,
    });
  }

  const isNotFound = response === null;
  const result = isNotFound ? null : mapSdkWorkingMemoryToResult(response!);

  return result;
};

const putWorkingMemoryOp = async (
  client: MemoryAPIClient,
  sessionId: string,
  payload: WorkingMemoryPayload,
  options?: WorkingMemoryOptions,
): Promise<WorkingMemoryResult> => {
  const sdkPayload: Record<string, unknown> = {
    session_id: sessionId,
  };

  const hasMessages = payload.messages !== undefined;
  if (hasMessages) {
    sdkPayload.messages = payload.messages!.map(mapMessageToSdkMessage);
  }

  const hasMemories = payload.memories !== undefined;
  if (hasMemories) {
    sdkPayload.memories = payload.memories!.map(mapInputToSdkRecord);
  }

  const hasData = payload.data !== undefined;
  if (hasData) {
    sdkPayload.data = payload.data;
  }

  const hasContext = payload.context !== undefined;
  if (hasContext) {
    sdkPayload.context = payload.context;
  }

  const hasUserId = payload.userId !== undefined || options?.userId !== undefined;
  if (hasUserId) {
    sdkPayload.user_id = payload.userId ?? options?.userId;
  }

  const hasNamespace =
    payload.namespace !== undefined || options?.namespace !== undefined;
  if (hasNamespace) {
    sdkPayload.namespace = payload.namespace ?? options?.namespace;
  }

  const hasTtl = payload.ttlSeconds !== undefined;
  if (hasTtl) {
    sdkPayload.ttl_seconds = payload.ttlSeconds;
  }

  const hasStrategy = payload.longTermMemoryStrategy !== undefined;
  if (hasStrategy) {
    sdkPayload.long_term_memory_strategy = {
      strategy: payload.longTermMemoryStrategy!.strategy,
      config: payload.longTermMemoryStrategy!.config,
    };
  }

  const response = await client.putWorkingMemory(sessionId, sdkPayload, {
    namespace: options?.namespace ?? payload.namespace,
    modelName: options?.modelName as Parameters<
      typeof client.putWorkingMemory
    >[2] extends { modelName?: infer M } ? M : never,
    contextWindowMax: options?.contextWindowMax,
  });

  return mapSdkWorkingMemoryToResult(response);
};

const getOrCreateWorkingMemoryOp = async (
  client: MemoryAPIClient,
  sessionId: string,
  options?: WorkingMemoryOptions,
): Promise<{ created: boolean; memory: WorkingMemoryResult }> => {
  const response = await client.getOrCreateWorkingMemory(sessionId, {
    namespace: options?.namespace,
    userId: options?.userId,
    modelName: options?.modelName as Parameters<
      typeof client.getOrCreateWorkingMemory
    >[1] extends { modelName?: infer M } ? M : never,
    contextWindowMax: options?.contextWindowMax,
  });

  const created = response.new_session === true;

  return {
    created,
    memory: mapSdkWorkingMemoryToResult(response),
  };
};

const deleteWorkingMemoryOp = async (
  client: MemoryAPIClient,
  sessionId: string,
  options?: { namespace?: string; userId?: string },
  rawConfig?: RawClientConfig,
): Promise<AckResult> => {
  const hasUserId = options?.userId !== undefined;
  const shouldUseRawClient = hasUserId && rawConfig !== undefined;

  let response: { status: string };

  if (shouldUseRawClient) {
    response = await rawDelete(
      rawConfig!,
      `/v1/working-memory/${encodeURIComponent(sessionId)}`,
      {
        namespace: options?.namespace,
        user_id: options?.userId,
      },
    );
  } else {
    response = await client.deleteWorkingMemory(sessionId, {
      namespace: options?.namespace,
    });
  }

  return { status: response.status };
};

export {
  listSessionsOp,
  getWorkingMemoryOp,
  putWorkingMemoryOp,
  getOrCreateWorkingMemoryOp,
  deleteWorkingMemoryOp,
};
