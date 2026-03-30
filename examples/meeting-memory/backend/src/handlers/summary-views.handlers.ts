import type { RouteHandler } from "cau-api-server";
import type {
  CreateSummaryViewInput,
  GetSummaryViewInput,
  ComputeSummaryInput,
  GetComputedSummariesInput,
  DeleteSummaryViewInput,
  GetTaskInput,
} from "../types";

import { AgentMemory } from "cau-redis-agent-memory";

import { SUPPORTED_GROUP_BY_FIELDS } from "../constants";
import { getAppState } from "../app-state";

const validateGroupBy = (groupBy?: string[]): void => {
  const hasGroupBy = groupBy !== undefined && groupBy.length > 0;
  let unsupported: string[] = [];
  if (hasGroupBy) {
    unsupported = groupBy.filter(
      (field) => !SUPPORTED_GROUP_BY_FIELDS.includes(field),
    );
  }
  const hasUnsupported = unsupported.length > 0;

  if (hasUnsupported) {
    throw new Error(
      `Unsupported groupBy fields: ${unsupported.join(", ")}. Supported: ${SUPPORTED_GROUP_BY_FIELDS.join(", ")}`,
    );
  }
};

const createSummaryViewHandler: RouteHandler = async (input, { logger }) => {
  const { name, source, groupBy, timeWindowDays } =
    input as CreateSummaryViewInput;
  const { namespace, userId } = getAppState();

  validateGroupBy(groupBy);

  logger.info("Creating summary view", { name, source, groupBy, namespace });

  const scopedFilters = { namespace, user_id: userId };
  const view = await AgentMemory.getInstance().createSummaryView({
    name,
    source,
    groupBy,
    filters: scopedFilters,
    timeWindowDays,
  });

  return {
    viewId: view.id,
    name: view.name,
    source: view.source,
    groupBy: view.groupBy,
    createdAt: new Date().toISOString(),
  };
};

const listSummaryViewsHandler: RouteHandler = async (_input, { logger }) => {
  const { namespace } = getAppState();
  const allViews = await AgentMemory.getInstance().listSummaryViews();
  const views = allViews.filter((v) => v.filters?.namespace === namespace);

  const mapped = views.map((v) => ({
    viewId: v.id,
    name: v.name,
    source: v.source,
    groupBy: v.groupBy,
  }));

  logger.info("Listing summary views", { count: mapped.length, namespace });

  return { views: mapped };
};

const getSummaryViewHandler: RouteHandler = async (input, { logger }) => {
  const { viewId } = input as GetSummaryViewInput;

  logger.info("Getting summary view", { viewId });

  const view = await AgentMemory.getInstance().getSummaryView(viewId);

  const isNotFound = view === null;
  if (isNotFound) {
    throw new Error(`Summary view not found: ${viewId}`);
  }

  return {
    viewId: view.id,
    name: view.name,
    source: view.source,
    groupBy: view.groupBy,
    timeWindowDays: view.timeWindowDays,
    continuous: view.continuous,
    prompt: view.prompt,
    modelName: view.modelName,
  };
};

const computeSummaryHandler: RouteHandler = async (input, { logger }) => {
  const { viewId, group } = input as ComputeSummaryInput;

  logger.info("Computing summary", { viewId, group });

  const result = await AgentMemory.getInstance().runSummaryViewPartition(
    viewId,
    group,
  );

  return {
    viewId: result.viewId,
    group: result.group,
    summary: result.summary,
    memoryCount: result.memoryCount,
    computedAt: result.computedAt,
  };
};

const getComputedSummariesHandler: RouteHandler = async (
  input,
  { logger },
) => {
  const { viewId } = input as GetComputedSummariesInput;
  const { namespace, userId } = getAppState();

  logger.info("Fetching computed summaries", { viewId, namespace });

  const partitions =
    await AgentMemory.getInstance().listSummaryViewPartitions(viewId, {
      namespace,
      userId,
    });

  const summaries = partitions.map((p) => ({
    group: p.group,
    summary: p.summary,
    memoryCount: p.memoryCount,
    computedAt: p.computedAt,
  }));

  return { summaries };
};

const deleteSummaryViewHandler: RouteHandler = async (input, { logger }) => {
  const { viewId } = input as DeleteSummaryViewInput;

  logger.info("Deleting summary view", { viewId });

  const result = await AgentMemory.getInstance().deleteSummaryView(viewId);

  return result;
};

const getTaskHandler: RouteHandler = async (input, { logger }) => {
  const { taskId } = input as GetTaskInput;

  logger.info("Getting task status", { taskId });

  const task = await AgentMemory.getInstance().getTask(taskId);

  const isNotFound = task === null;
  if (isNotFound) {
    throw new Error(`Task not found: ${taskId}`);
  }

  return task;
};

export {
  createSummaryViewHandler,
  listSummaryViewsHandler,
  getSummaryViewHandler,
  computeSummaryHandler,
  getComputedSummariesHandler,
  deleteSummaryViewHandler,
  getTaskHandler,
};
