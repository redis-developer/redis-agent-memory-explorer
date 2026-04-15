import type { RouteHandler } from "cau-api-server";
import type {
  SearchLongTermMemoryInput,
  SearchLongTermMemoryBySessionInput,
} from "../types";

import { AgentMemory } from "cau-redis-agent-memory";

import { getAppState } from "../app-state";

const searchLongTermMemoryHandler: RouteHandler = async (
  input,
  { logger },
) => {
  const {
    text,
    memoryType,
    topics,
    entities,
  } = (input as SearchLongTermMemoryInput) ?? {};
  const { namespace, userId } = getAppState();

  logger.info("Searching long-term memory", { text, memoryType, topics, entities });

  const startMs = Date.now();
  const result = await AgentMemory.getInstance().searchAllLongTermMemories({
    text: text ?? "",
    userId: { eq: userId },
    namespace: { eq: namespace },
    memoryType: memoryType ? { eq: memoryType } : undefined,
    topics: topics ? { any: topics } : undefined,
    entities: entities ? { any: entities } : undefined,
  });

  logger.info("Long-term memory search complete", {
    total: result.total,
    returned: result.memories.length,
    latencyMs: Date.now() - startMs,
  });

  return result;
};

const searchLongTermMemoryBySessionHandler: RouteHandler = async (
  input,
  { logger },
) => {
  const { sessionId } = input as SearchLongTermMemoryBySessionInput;
  const { namespace } = getAppState();

  const startMs = Date.now();
  const result = await AgentMemory.getInstance().searchAllLongTermMemories({
    text: "",
    sessionId: { eq: sessionId },
    namespace: { eq: namespace },
  });

  logger.info("Searched long-term memory by session", {
    sessionId,
    total: result.total,
    returned: result.memories.length,
    latencyMs: Date.now() - startMs,
  });

  return result;
};

export {
  searchLongTermMemoryHandler,
  searchLongTermMemoryBySessionHandler,
};
