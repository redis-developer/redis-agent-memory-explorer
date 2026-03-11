import type { RouteHandler } from "cau-api-server";
import type {
  SearchLongTermMemoryInput,
  SearchLongTermMemoryBySessionInput,
} from "../types";

import { AgentMemory } from "cau-redis-agent-memory";

import { getAppState } from "../app-state";

const DEFAULT_SEARCH_LIMIT = 20;
const DEFAULT_SEARCH_OFFSET = 0;
const SESSION_SEARCH_LIMIT = 50;

const searchLongTermMemoryHandler: RouteHandler = async (
  input,
  { logger },
) => {
  const {
    text,
    memoryType,
    topics,
    entities,
    limit,
    offset,
  } = (input as SearchLongTermMemoryInput) ?? {};
  const { namespace, userId } = getAppState();

  const result = await AgentMemory.getInstance().searchLongTermMemory({
    text: text ?? "",
    userId: { eq: userId },
    namespace: { eq: namespace },
    memoryType: memoryType ? { eq: memoryType } : undefined,
    topics: topics ? { any: topics } : undefined,
    entities: entities ? { any: entities } : undefined,
    limit: limit ?? DEFAULT_SEARCH_LIMIT,
    offset: offset ?? DEFAULT_SEARCH_OFFSET,
  });

  logger.info("Searched long-term memory", {
    total: result.total,
    returned: result.memories.length,
  });

  return result;
};

const searchLongTermMemoryBySessionHandler: RouteHandler = async (
  input,
  { logger },
) => {
  const { sessionId } = input as SearchLongTermMemoryBySessionInput;
  const { namespace } = getAppState();

  const result = await AgentMemory.getInstance().searchLongTermMemory({
    text: "",
    sessionId: { eq: sessionId },
    namespace: { eq: namespace },
    limit: SESSION_SEARCH_LIMIT,
  });

  logger.info("Searched long-term memory by session", {
    sessionId,
    total: result.total,
    returned: result.memories.length,
  });

  return result;
};

export {
  searchLongTermMemoryHandler,
  searchLongTermMemoryBySessionHandler,
};
