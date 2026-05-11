import type { RouteHandler } from "cau-api-server";

import { RedisAgentMemory } from "cau-ram";

import { DEFAULT_LIST_LIMIT } from "../constants";
import { getAppState } from "../app-state";
import { SuggestionStore } from "../services/suggestion-store";
import { TopicStore } from "../services/topic-store";
import { TranscriptChunkStore } from "../services/transcript-chunk-store";

const resetLifecycleHandler: RouteHandler = async (_input, { logger }) => {
  const { namespace } = getAppState();
  const ram = RedisAgentMemory.getInstance();
  const resetStartMs = Date.now();

  logger.info("Resetting lifecycle -- clearing all memories", { namespace });

  const sessionsStartMs = Date.now();
  let sessionsDeleted = 0;
  let sessionBatch;
  do {
    sessionBatch = await ram.listSessions({ limit: DEFAULT_LIST_LIMIT });
    for (const sessionId of sessionBatch.sessions) {
      await ram.deleteSessionMemory(sessionId);
      sessionsDeleted += 1;
    }
  } while (sessionBatch.sessions.length >= DEFAULT_LIST_LIMIT);
  logger.info("Step 1/3: Sessions deleted", {
    sessionsDeleted,
    latencyMs: Date.now() - sessionsStartMs,
  });

  const ltStartMs = Date.now();
  let memoriesDeleted = 0;
  let ltBatch;
  do {
    ltBatch = await ram.searchLongTermMemory({
      text: "",
      filter: { namespace },
    });
    if (ltBatch.memories.length > 0) {
      const batchIds = ltBatch.memories.map((m) => m.id);
      await ram.deleteLongTermMemories(batchIds);
      memoriesDeleted += batchIds.length;
    }
  } while (ltBatch.memories.length > 0);
  logger.info("Step 2/3: Long-term memories deleted", {
    memoriesDeleted,
    latencyMs: Date.now() - ltStartMs,
  });

  const storesStartMs = Date.now();
  await SuggestionStore.clearAll();
  await TopicStore.clearAll();
  await TranscriptChunkStore.clearAll();
  logger.info("Step 3/3: Copilot stores cleared", {
    latencyMs: Date.now() - storesStartMs,
  });

  logger.info("Lifecycle reset complete", {
    sessionsDeleted,
    memoriesDeleted,
    totalLatencyMs: Date.now() - resetStartMs,
  });

  return {
    sessionsDeleted,
    memoriesDeleted,
  };
};

export { resetLifecycleHandler };
