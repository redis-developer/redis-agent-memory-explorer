import type {
  MemoryAPIClient,
  WorkingMemoryResponse as SdkWorkingMemoryResponse,
  SessionListResponse as SdkSessionListResponse,
} from "agent-memory-client";
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

/**
 * The SDK (agent-memory-client@0.3.1) does not support `user_id` as a
 * query parameter on GET /v1/working-memory/. The server uses `user_id`
 * for key-scoping, so omitting it returns sessions across all users.
 * When `userId` is provided we bypass the SDK and issue a raw HTTP GET.
 */
const listSessionsOp = async (
  client: MemoryAPIClient,
  options?: SessionListOptions,
  rawConfig?: RawClientConfig,
): Promise<SessionListResult> => {
  const hasUserId = options?.userId !== undefined;
  const shouldUseRawClient = hasUserId && rawConfig !== undefined;

  let response: SdkSessionListResponse;

  if (shouldUseRawClient) {
    response = await rawGet<SdkSessionListResponse>(
      rawConfig!,
      "/v1/working-memory/",
      {
        namespace: options?.namespace,
        limit: options?.limit ?? DEFAULT_SESSION_LIST_LIMIT,
        offset: options?.offset,
        user_id: options?.userId,
      },
    );
  } else {
    response = await client.listSessions({
      namespace: options?.namespace,
      limit: options?.limit ?? DEFAULT_SESSION_LIST_LIMIT,
      offset: options?.offset,
    });
  }

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
const isNotFoundError = (error: unknown): boolean => {
  return error instanceof Error && error.message.includes("failed (404)");
};

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
    try {
      response = await rawGet<SdkWorkingMemoryResponse>(
        rawConfig!,
        `/v1/working-memory/${encodeURIComponent(sessionId)}`,
        {
          namespace: options?.namespace,
          user_id: options?.userId,
          model_name: options?.modelName,
          context_window_max: options?.contextWindowMax,
          recent_messages_limit: options?.recentMessagesLimit,
        },
      );
    } catch (error) {
      if (isNotFoundError(error)) {
        return null;
      }
      throw error;
    }
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

/**
 * The SDK's getOrCreateWorkingMemory internally calls getWorkingMemory
 * which does not pass `user_id`. When `user_id` is part of the Redis
 * key the GET always misses, causing duplicate session creation.
 *
 * We issue a raw GET with `user_id` first. The server may respond in
 * two ways for non-existent sessions depending on version:
 * - 200 with `unsaved: true` (auto-created transient session)
 * - 404 with session-not-found detail
 *
 * Both cases are treated as "session does not exist" and trigger a
 * PUT to create/persist the session. When rawConfig is not available,
 * falls back to the SDK's getOrCreateWorkingMemory (userId may not
 * be scoped correctly).
 */
const getOrCreateWorkingMemoryOp = async (
  client: MemoryAPIClient,
  sessionId: string,
  options?: WorkingMemoryOptions,
  rawConfig?: RawClientConfig,
): Promise<{ created: boolean; memory: WorkingMemoryResult }> => {
  const hasRawConfig = rawConfig !== undefined;

  let memory: WorkingMemoryResult;
  let created: boolean;

  if (hasRawConfig) {
    let getResponse: SdkWorkingMemoryResponse | null = null;

    try {
      getResponse = await rawGet<SdkWorkingMemoryResponse>(
        rawConfig!,
        `/v1/working-memory/${encodeURIComponent(sessionId)}`,
        {
          namespace: options?.namespace,
          user_id: options?.userId,
          model_name: options?.modelName,
          context_window_max: options?.contextWindowMax,
        },
      );
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error;
      }
    }

    const isNewSession =
      getResponse === null || getResponse.unsaved === true;

    if (isNewSession) {
      const newPayload: WorkingMemoryPayload = {
        messages: [],
        memories: [],
        userId: options?.userId,
        namespace: options?.namespace,
      };
      memory = await putWorkingMemoryOp(client, sessionId, newPayload, options);
      created = true;
    } else {
      memory = mapSdkWorkingMemoryToResult(getResponse!);
      created = false;
    }
  } else {
    const sdkResponse = await client.getOrCreateWorkingMemory(sessionId, {
      namespace: options?.namespace,
      userId: options?.userId,
      modelName: options?.modelName as Parameters<
        typeof client.getOrCreateWorkingMemory
      >[1] extends { modelName?: infer M } ? M : never,
      contextWindowMax: options?.contextWindowMax,
    });
    memory = mapSdkWorkingMemoryToResult(sdkResponse);
    created = sdkResponse.unsaved === true;
  }

  return { created, memory };
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
