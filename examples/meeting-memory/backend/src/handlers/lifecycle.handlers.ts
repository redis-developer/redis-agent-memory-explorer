import type { RouteHandler } from "cau-api-server";
import type { ForgetLifecycleInput } from "../types";

import { AgentMemory, SummaryViewSource } from "cau-redis-agent-memory";

import { SEARCH_ALL_LIMIT } from "../constants";
import { getAppState, setAppState } from "../app-state";

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
  const views = await memory.listSummaryViews();
  let viewsDeleted = 0;
  for (const view of views) {
    await memory.deleteSummaryView(view.id);
    viewsDeleted += 1;
  }

  // 4. Re-create the default summary view
  const defaultViewName =
    datasetConfig!.memoryLabels.summaryViews.defaultViewName;
  const defaultGroupBy =
    datasetConfig!.memoryLabels.summaryViews.defaultGroupBy;

  const newDefaultView = await memory.createSummaryView({
    name: defaultViewName,
    source: SummaryViewSource.LONG_TERM,
    groupBy: defaultGroupBy,
  });

  setAppState({ defaultSummaryViewId: newDefaultView.id });

  logger.info("Lifecycle reset complete", {
    sessionsDeleted,
    memoriesDeleted,
    viewsDeleted,
    defaultSummaryViewId: newDefaultView.id,
  });

  return {
    sessionsDeleted,
    memoriesDeleted,
    viewsDeleted,
    defaultSummaryViewId: newDefaultView.id,
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
