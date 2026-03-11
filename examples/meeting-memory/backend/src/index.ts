import { ApiServer } from "cau-api-server";
import { Logger } from "cau-logger";
import { AgentMemory, SummaryViewSource } from "cau-redis-agent-memory";

import { routes } from "./routes";
import { setAppState } from "./app-state";
import {
  PORT,
  ALLOWED_ORIGINS,
  AGENT_MEMORY_BASE_URL,
  ACTIVE_DATASET,
  MODEL_NAME,
} from "./config";
import { DatasetLoaderService } from "./services/dataset-loader.service";

const LOGGER_CONTEXT = "MeetingMemory";

const logger = Logger.create({
  level: "info",
  context: LOGGER_CONTEXT,
  transports: [{ type: "console", format: "pretty" }],
});

const createDefaultSummaryView = async (
  defaultViewName: string,
  defaultGroupBy: string[],
): Promise<string> => {
  const memory = AgentMemory.getInstance();

  try {
    const view = await memory.createSummaryView({
      name: defaultViewName,
      source: SummaryViewSource.LONG_TERM,
      groupBy: defaultGroupBy,
    });

    return view.id;
  } catch (_createError) {
    logger.info(
      "Default summary view may already exist, attempting to find it",
    );

    const existingViews = await memory.listSummaryViews();
    const matchingView = existingViews.find((v) => v.name === defaultViewName);

    const isFound = matchingView !== undefined;
    if (isFound) {
      return matchingView.id;
    }

    throw new Error(
      `Failed to create or find default summary view: ${defaultViewName}`,
    );
  }
};

const server = ApiServer.create({
  config: {
    PORT,
    ALLOWED_ORIGINS,
  },
  logger,
  routes,
  onAppStart: async () => {
    const datasetConfig = DatasetLoaderService.loadDatasetConfig(ACTIVE_DATASET);
    const { namespace, userId } = datasetConfig;

    AgentMemory.create({
      baseUrl: AGENT_MEMORY_BASE_URL,
      defaultNamespace: namespace,
      defaultModelName: MODEL_NAME,
    });

    await AgentMemory.getInstance().healthCheck();
    logger.info("Agent Memory Server connected", { baseUrl: AGENT_MEMORY_BASE_URL });

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
      dataset: ACTIVE_DATASET,
      namespace,
      userId,
      defaultSummaryViewId,
      modelName: MODEL_NAME,
    });
  },
  onAppStop: async () => {
    await AgentMemory.getInstance().close();
    logger.info("Backend stopped");
  },
});

server.start();
