import type { SummaryViewConfigEntry } from "./types";

import { ApiServer } from "cau-api-server";
import { Logger } from "cau-logger";
import { AgentMemory } from "cau-redis-agent-memory";

import { LOGGER_CONTEXT, COPILOTKIT_ENDPOINT } from "./constants";
import { routes } from "./routes";
import { setAppState } from "./app-state";
import { ENV } from "./config";
import { DatasetLoaderService } from "./services/dataset-loader.service";
import { handleCopilotKitLanggraph } from "./chatbot-agent";

const logger = Logger.create({
  level: "info",
  context: LOGGER_CONTEXT,
  transports: [{ type: "console", format: "pretty" }],
});

const ensureSummaryViews = async (
  viewConfigs: SummaryViewConfigEntry[],
  namespace: string,
  userId: string,
): Promise<void> => {
  const memory = AgentMemory.getInstance();
  const existingViews = await memory.listSummaryViews();
  const ownViews = existingViews.filter(
    (v) => v.filters?.namespace === namespace,
  );

  for (const config of viewConfigs) {
    const matchingView = ownViews.find((v) => v.name === config.name);
    const isExisting = matchingView !== undefined;

    if (isExisting) {
      logger.info("Summary view already exists", {
        name: config.name,
        id: matchingView.id,
      });
    } else {
      const scopedFilters = {
        ...config.filters,
        namespace,
        user_id: userId,
      };
      const created = await memory.createSummaryView({
        name: config.name,
        source: config.source,
        groupBy: config.groupBy,
        filters: scopedFilters,
        timeWindowDays: config.timeWindowDays,
        continuous: config.continuous,
        prompt: config.prompt,
      });
      logger.info("Created summary view", {
        name: config.name,
        id: created.id,
      });
    }
  }
};

const initializeApp = async (): Promise<void> => {
  const datasetConfig = DatasetLoaderService.loadDatasetConfig(
    ENV.ACTIVE_DATASET,
  );
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

  await ensureSummaryViews(
    datasetConfig.memoryLabels.summaryViews.views,
    namespace,
    userId,
  );

  setAppState({
    datasetConfig,
    namespace,
    userId,
  });

  logger.info("Backend ready", {
    dataset: ENV.ACTIVE_DATASET,
    namespace,
    userId,
    modelName: ENV.MODEL_NAME,
    contextWindowMax: ENV.CONTEXT_WINDOW_MAX,
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

server.expressApp.use(COPILOTKIT_ENDPOINT, async (req, res, next) => {
  req.url = COPILOTKIT_ENDPOINT + (req.url === "/" ? "" : req.url);

  try {
    await handleCopilotKitLanggraph(req, res);
  } catch (err) {
    next(err);
  }
});

server.start();
