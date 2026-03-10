import type {
  MemoryAPIClient,
  SummaryView as SdkSummaryView,
  Task as SdkTask,
  SummaryViewPartitionResult as SdkPartitionResult,
} from "agent-memory-client";
import type {
  CreateSummaryViewInput,
  SummaryViewResult,
  SummaryPartitionResult,
  PartitionListFilters,
  TaskResult,
  AckResult,
} from "../types";
import type { SummaryViewSource, TaskStatus } from "../constants";

const mapSdkViewToResult = (view: SdkSummaryView): SummaryViewResult => {
  return {
    id: view.id,
    name: view.name ?? null,
    source: view.source as SummaryViewSource,
    groupBy: view.group_by,
    filters: view.filters ?? {},
    timeWindowDays: view.time_window_days ?? null,
    continuous: view.continuous ?? false,
    prompt: view.prompt ?? null,
    modelName: view.model_name ?? null,
  };
};

const mapSdkPartitionToResult = (
  partition: SdkPartitionResult,
): SummaryPartitionResult => {
  return {
    viewId: partition.view_id,
    group: partition.group,
    summary: partition.summary,
    memoryCount: partition.memory_count,
    computedAt: partition.computed_at ?? "",
  };
};

const mapSdkTaskToResult = (task: SdkTask): TaskResult => {
  return {
    id: task.id,
    type: task.type,
    status: task.status as TaskStatus,
    viewId: task.view_id ?? null,
    createdAt: task.created_at ?? "",
    startedAt: task.started_at ?? null,
    completedAt: task.completed_at ?? null,
    errorMessage: task.error_message ?? null,
  };
};

const createSummaryViewOp = async (
  client: MemoryAPIClient,
  request: CreateSummaryViewInput,
): Promise<SummaryViewResult> => {
  const response = await client.createSummaryView({
    name: request.name,
    source: request.source,
    group_by: request.groupBy ?? [],
    filters: request.filters,
    time_window_days: request.timeWindowDays,
    continuous: request.continuous,
    prompt: request.prompt,
    model_name: request.modelName,
  });

  return mapSdkViewToResult(response);
};

const listSummaryViewsOp = async (
  client: MemoryAPIClient,
): Promise<SummaryViewResult[]> => {
  const response = await client.listSummaryViews();

  return response.map(mapSdkViewToResult);
};

const getSummaryViewOp = async (
  client: MemoryAPIClient,
  viewId: string,
): Promise<SummaryViewResult | null> => {
  const response = await client.getSummaryView(viewId);

  const isNotFound = response === null;

  return isNotFound ? null : mapSdkViewToResult(response);
};

const deleteSummaryViewOp = async (
  client: MemoryAPIClient,
  viewId: string,
): Promise<AckResult> => {
  const response = await client.deleteSummaryView(viewId);

  return { status: response.status };
};

const runSummaryViewPartitionOp = async (
  client: MemoryAPIClient,
  viewId: string,
  group: Record<string, string>,
): Promise<SummaryPartitionResult> => {
  const response = await client.runSummaryViewPartition(viewId, group);

  return mapSdkPartitionToResult(response);
};

const listSummaryViewPartitionsOp = async (
  client: MemoryAPIClient,
  viewId: string,
  filters?: PartitionListFilters,
): Promise<SummaryPartitionResult[]> => {
  const response = await client.listSummaryViewPartitions(viewId, {
    namespace: filters?.namespace,
    userId: filters?.userId,
    sessionId: filters?.sessionId,
    memoryType: filters?.memoryType,
  });

  return response.map(mapSdkPartitionToResult);
};

const runSummaryViewOp = async (
  client: MemoryAPIClient,
  viewId: string,
  options?: { force?: boolean },
): Promise<TaskResult> => {
  const response = await client.runSummaryView(viewId, {
    force: options?.force,
  });

  return mapSdkTaskToResult(response);
};

const getTaskOp = async (
  client: MemoryAPIClient,
  taskId: string,
): Promise<TaskResult | null> => {
  const response = await client.getTask(taskId);

  const isNotFound = response === null;

  return isNotFound ? null : mapSdkTaskToResult(response);
};

export {
  createSummaryViewOp,
  listSummaryViewsOp,
  getSummaryViewOp,
  deleteSummaryViewOp,
  runSummaryViewPartitionOp,
  listSummaryViewPartitionsOp,
  runSummaryViewOp,
  getTaskOp,
};
