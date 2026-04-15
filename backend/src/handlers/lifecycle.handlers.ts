import type { RouteHandler } from "cau-api-server";
import type { ForgetLifecycleInput } from "../types";

import { AgentMemory } from "cau-redis-agent-memory";

import { DEFAULT_LIST_LIMIT, SEARCH_ALL_LIMIT, FORGET_LIMIT } from "../constants";
import { getAppState } from "../app-state";
import { deletePartitionsForView } from "../services/ams-partition-cleanup";
import { SuggestionStore } from "../services/suggestion-store";
import { TopicStore } from "../services/topic-store";
import { TranscriptChunkStore } from "../services/transcript-chunk-store";

const resetLifecycleHandler: RouteHandler = async (_input, { logger }) => {
  const { namespace, userId, datasetConfig } = getAppState();
  const memory = AgentMemory.getInstance();
  const resetStartMs = Date.now();

  logger.info("Resetting lifecycle -- clearing all memories", { namespace });

  const sessionsStartMs = Date.now();
  // 1. Delete all working memory sessions in batches.
  // AMS enforces a hard limit of 100 on GET /v1/working-memory/ (GetSessionsQuery),
  // so a single listSessions call can miss sessions beyond 100. Loop until empty.
  let sessionsDeleted = 0;
  let sessionBatch;
  do {
    sessionBatch = await memory.listSessions({
      namespace,
      userId,
      limit: DEFAULT_LIST_LIMIT,
    });
    for (const sessionId of sessionBatch.sessions) {
      await memory.deleteWorkingMemory(sessionId, { namespace, userId });
      sessionsDeleted += 1;
    }
  } while (sessionBatch.sessions.length >= DEFAULT_LIST_LIMIT);
  logger.info("Step 1/5: Working memory sessions deleted", {
    sessionsDeleted,
    latencyMs: Date.now() - sessionsStartMs,
  });

  const ltStartMs = Date.now();
  // 2. Delete all long-term memories in batches.
  // AMS enforces a hard limit of 100 on POST /v1/long-term-memory/search (SearchRequest),
  // so a single search call can miss memories beyond 100. Loop until empty.
  let memoriesDeleted = 0;
  let ltBatch;
  do {
    ltBatch = await memory.searchLongTermMemory({
      text: "",
      namespace: { eq: namespace },
      limit: SEARCH_ALL_LIMIT,
    });
    if (ltBatch.memories.length > 0) {
      const batchIds = ltBatch.memories.map((m) => m.id);
      await memory.deleteLongTermMemories(batchIds);
      memoriesDeleted += batchIds.length;
    }
  } while (ltBatch.memories.length > 0);
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
  let partitionsDeleted = 0;
  for (const view of ownViews) {
    // Workaround: https://github.com/redis/agent-memory-server/issues/229
    partitionsDeleted += await deletePartitionsForView(view.id);
    await memory.deleteSummaryView(view.id);
    viewsDeleted += 1;
  }
  logger.info("Step 3/5: Summary views deleted", {
    viewsDeleted,
    partitionsDeleted,
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

/**
 * Not called by the frontend or any backend flow. The "Clear all memories"
 * button uses `resetLifecycleHandler` instead. This endpoint exists for
 * ad-hoc / demo use of the AMS forget-policy feature via direct API call.
 */
const forgetLifecycleHandler: RouteHandler = async (input, { logger }) => {
  const { policy, dryRun } = (input as ForgetLifecycleInput) ?? {};
  const { namespace, userId } = getAppState();

  logger.info("Running forget policy", { policy, dryRun, namespace });

  const result = await AgentMemory.getInstance().forgetLongTermMemories(
    policy ?? {},
    {
      namespace,
      userId,
      limit: FORGET_LIMIT,
    },
  );

  return result;
};

export { resetLifecycleHandler, forgetLifecycleHandler };
