import { ApiServer } from "cau-api-server";
import { Logger } from "cau-logger";
import { AgentMemory, SummaryViewSource } from "cau-redis-agent-memory";

import { LOGGER_CONTEXT } from "./constants";
import { routes } from "./routes";
import { setAppState } from "./app-state";
import { ENV } from "./config";
import { DatasetLoaderService } from "./services/dataset-loader.service";

const logger = Logger.create({
  level: "info",
  context: LOGGER_CONTEXT,
  transports: [{ type: "console", format: "pretty" }],
});

const createDefaultSummaryView = async (
  defaultViewName: string,
  defaultGroupBy: string[],
): Promise<string> => {
  let viewId: string;
  let logMessage: string;

  const memory = AgentMemory.getInstance();
  const existingViews = await memory.listSummaryViews();
  const matchingView = existingViews.find((v) => v.name === defaultViewName);
  const isExisting = matchingView !== undefined && matchingView.id;

  if (isExisting) {
    viewId = matchingView.id;
    logMessage = "Default summary view already exists";
  } else {
    const created = await memory.createSummaryView({
      name: defaultViewName,
      source: SummaryViewSource.LONG_TERM,
      groupBy: defaultGroupBy,
    });
    viewId = created.id;
    logMessage = "Created default summary view";
  }

  logger.info(logMessage, { id: viewId });

  return viewId;
};

const initializeApp = async (): Promise<void> => {
  const datasetConfig =
    DatasetLoaderService.loadDatasetConfig(ENV.ACTIVE_DATASET);
  const { namespace, userId } = datasetConfig;

  AgentMemory.create({
    baseUrl: ENV.AGENT_MEMORY_BASE_URL,
    defaultNamespace: namespace,
    defaultModelName: ENV.MODEL_NAME,
  });

  await AgentMemory.getInstance().healthCheck();
  logger.info("Agent Memory Server connected", {
    baseUrl: ENV.AGENT_MEMORY_BASE_URL,
  });

  const defaultSummaryViewId = await createDefaultSummaryView(
    datasetConfig.memoryLabels.summaryViews.defaultViewName,
    datasetConfig.memoryLabels.summaryViews.defaultGroupBy,
  );

  setAppState({
    datasetConfig,
    defaultSummaryViewId,
    namespace,
    userId,
  });

  logger.info("Backend ready", {
    dataset: ENV.ACTIVE_DATASET,
    namespace,
    userId,
    defaultSummaryViewId,
    modelName: ENV.MODEL_NAME,
  });
};

const server = ApiServer.create({
  config: {
    PORT: ENV.PORT,
    ALLOWED_ORIGINS: ENV.ALLOWED_ORIGINS,
  },
  logger,
  routes,
  onAppStart: initializeApp,
  onAppStop: async () => {
    await AgentMemory.getInstance().close();
    logger.info("Backend stopped");
  },
});

server.start();
