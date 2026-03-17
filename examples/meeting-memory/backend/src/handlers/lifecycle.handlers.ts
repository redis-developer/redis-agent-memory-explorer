import type { RouteHandler } from "cau-api-server";
import type { ForgetLifecycleInput } from "../types";

import { AgentMemory } from "cau-redis-agent-memory";

import { SEARCH_ALL_LIMIT } from "../constants";
import { getAppState } from "../app-state";

const resetLifecycleHandler: RouteHandler = async (_input, { logger }) => {
  const { namespace, userId, datasetConfig } = getAppState();
  const memory = AgentMemory.getInstance();

  logger.info("Resetting lifecycle -- clearing all memories", { namespace });
  // 1. Delete all working memory sessions
  const sessions = await memory.listSessions({ namespace, userId });
  let sessionsDeleted = 0;
  for (const sessionId of sessions.sessions) {
    await memory.deleteWorkingMemory(sessionId, { namespace, userId });
    sessionsDeleted += 1;
  }

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
  // 3. Delete all summary views
  const existingViews = await memory.listSummaryViews();
  let viewsDeleted = 0;
  for (const view of existingViews) {
    await memory.deleteSummaryView(view.id);
    viewsDeleted += 1;
  }
  // 4. Re-create summary view definition

  const viewConfigs = datasetConfig!.memoryLabels.summaryViews.views;
  let viewsCreated = 0;
  for (const config of viewConfigs) {
    await memory.createSummaryView({
      name: config.name,
      source: config.source,
      groupBy: config.groupBy,
      filters: config.filters,
      timeWindowDays: config.timeWindowDays,
      continuous: config.continuous,
      prompt: config.prompt,
    });
    viewsCreated += 1;
  }

  logger.info("Lifecycle reset complete", {
    sessionsDeleted,
    memoriesDeleted,
    viewsDeleted,
    viewsCreated,
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
