import type { RouteHandler } from "cau-api-server";
import type { ForgetLifecycleInput } from "../types";

import { AgentMemory } from "cau-redis-agent-memory";

import { SEARCH_ALL_LIMIT } from "../constants";
import { getAppState } from "../app-state";
import { SuggestionStore } from "../services/suggestion-store";
import { TopicStore } from "../services/topic-store";
import { TranscriptChunkStore } from "../services/transcript-chunk-store";

const resetLifecycleHandler: RouteHandler = async (_input, { logger }) => {
  const { namespace, userId, datasetConfig } = getAppState();
  const memory = AgentMemory.getInstance();
  const resetStartMs = Date.now();

  logger.info("Resetting lifecycle -- clearing all memories", { namespace });

  const sessionsStartMs = Date.now();
  // 1. Delete all working memory sessions
  const sessions = await memory.listSessions({ namespace, userId });
  let sessionsDeleted = 0;
  for (const sessionId of sessions.sessions) {
    await memory.deleteWorkingMemory(sessionId, { namespace, userId });
    sessionsDeleted += 1;
  }
  logger.info("Step 1/5: Working memory sessions deleted", {
    sessionsDeleted,
    latencyMs: Date.now() - sessionsStartMs,
  });

  const ltStartMs = Date.now();
  // 2. Delete all long-term memories
  const ltResult = await memory.searchLongTermMemory({
    text: "",
    namespace: { eq: namespace },
    limit: SEARCH_ALL_LIMIT,
  });
  const memoryIds = ltResult.memories.map((m) => m.id);
  const memoriesDeleted = memoryIds.length;
  const hasMemories = memoriesDeleted > 0;
  if (hasMemories) {
    await memory.deleteLongTermMemories(memoryIds);
  }
  logger.info("Step 2/5: Long-term memories deleted", {
    memoriesDeleted,
    latencyMs: Date.now() - ltStartMs,
  });

  const viewsStartMs = Date.now();
  // 3. Delete summary views belonging to this namespace only
  const existingViews = await memory.listSummaryViews();
  const ownViews = existingViews.filter(
    (v) => v.filters?.namespace === namespace,
  );
  let viewsDeleted = 0;
  for (const view of ownViews) {
    await memory.deleteSummaryView(view.id);
    viewsDeleted += 1;
  }
  logger.info("Step 3/5: Summary views deleted", {
    viewsDeleted,
    latencyMs: Date.now() - viewsStartMs,
  });

  const createViewsStartMs = Date.now();
  // 4. Re-create summary view definitions with namespace scoping

  const viewConfigs = datasetConfig!.memoryLabels.summaryViews.views;
  let viewsCreated = 0;
  for (const config of viewConfigs) {
    const scopedFilters = {
      ...config.filters,
      namespace,
      user_id: userId,
    };
    await memory.createSummaryView({
      name: config.name,
      source: config.source,
      groupBy: config.groupBy,
      filters: scopedFilters,
      timeWindowDays: config.timeWindowDays,
      continuous: config.continuous,
      prompt: config.prompt,
    });
    viewsCreated += 1;
  }
  logger.info("Step 4/5: Summary views re-created", {
    viewsCreated,
    latencyMs: Date.now() - createViewsStartMs,
  });

  const storesStartMs = Date.now();
  // 5. Clear all copilot stores (suggestions, topics, raw chunks)

  await SuggestionStore.clearAll();
  await TopicStore.clearAll();
  await TranscriptChunkStore.clearAll();
  logger.info("Step 5/5: Copilot stores cleared", {
    latencyMs: Date.now() - storesStartMs,
  });

  logger.info("Lifecycle reset complete", {
    sessionsDeleted,
    memoriesDeleted,
    viewsDeleted,
    viewsCreated,
    totalLatencyMs: Date.now() - resetStartMs,
  });

  return {
    sessionsDeleted,
    memoriesDeleted,
    viewsDeleted,
    viewsCreated,
  };
};

const forgetLifecycleHandler: RouteHandler = async (input, { logger }) => {
  const { policy, dryRun } = (input as ForgetLifecycleInput) ?? {};
  const { namespace, userId } = getAppState();

  logger.info("Running forget policy", { policy, dryRun, namespace });

  const result = await AgentMemory.getInstance().forgetLongTermMemories(
    policy ?? {},
    {
      namespace,
      userId,
      limit: SEARCH_ALL_LIMIT,
    },
  );

  return result;
};

export { resetLifecycleHandler, forgetLifecycleHandler };
