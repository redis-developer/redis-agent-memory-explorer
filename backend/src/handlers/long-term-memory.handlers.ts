import type { RouteHandler } from "cau-api-server";
import type { MemoryFilter } from "cau-ram";
import type {
  SearchLongTermMemoryInput,
  SearchLongTermMemoryBySessionInput,
} from "../types";

import { RedisAgentMemory } from "cau-ram";

import { getAppState } from "../app-state";

const searchLongTermMemoryHandler: RouteHandler = async (
  input,
  { logger },
) => {
  const {
    text,
    memoryType,
    topics,
  } = (input as SearchLongTermMemoryInput) ?? {};
  const { userId } = getAppState();

  logger.info("Searching long-term memory", { text, memoryType, topics });

  const filter: MemoryFilter = {
    ownerId: userId,
  };
  if (memoryType) {
    filter.memoryType = memoryType;
  }
  if (topics) {
    filter.topics = topics;
  }

  const hasText = !!text;
  const searchText = hasText ? text : "*";

  const startMs = Date.now();
  const result = await RedisAgentMemory.getInstance().searchAllLongTermMemory({
    text: searchText,
    filter,
  });

  const total = result.memories.length;

  logger.info("Long-term memory search complete", {
    returned: total,
    latencyMs: Date.now() - startMs,
  });

  return { memories: result.memories, total };
};

const searchLongTermMemoryBySessionHandler: RouteHandler = async (
  input,
  { logger },
) => {
  const { sessionId } = input as SearchLongTermMemoryBySessionInput;

  const filter: MemoryFilter = {
    sessionId,
  };

  const startMs = Date.now();
  const result = await RedisAgentMemory.getInstance().searchAllLongTermMemory({
    text: "",
    filter,
  });

  const total = result.memories.length;

  logger.info("Searched long-term memory by session", {
    sessionId,
    returned: total,
    latencyMs: Date.now() - startMs,
  });

  return { memories: result.memories, total };
};

export {
  searchLongTermMemoryHandler,
  searchLongTermMemoryBySessionHandler,
};
