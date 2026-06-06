import { resolve, join } from "node:path";

import { ApiServer } from "cau-api-server";
import { Logger } from "cau-logger";
import { RedisDb } from "cau-redis";
import { RedisAgentMemory } from "cau-ram";
import { LangCache } from "cau-langcache";

import {
  LOGGER_CONTEXT,
  COPILOTKIT_ENDPOINT,
  DEFAULT_RATE_LIMIT_MAX,
  DEFAULT_STATIC_DIR,
  DEFAULT_LOG_FILE,
  DEFAULT_ERROR_LOG_FILE,
  DEFAULT_LOG_MAX_FILES,
} from "./constants";
import { routes } from "./routes";
import { setAppState } from "./app-state";
import { ENV } from "./config";
import { DatasetLoaderService } from "./services/dataset-loader.service";
import { initializeContextSurfaces } from "./services/context-surfaces-setup.service";
import { handleCopilotKitLanggraph } from "./chatbot-agent";

const logger = Logger.create({
  level: "info",
  context: LOGGER_CONTEXT,
  transports: [
    { type: "console", format: "pretty" },
    {
      type: "file",
      path: join(ENV.LOG_DIR, DEFAULT_LOG_FILE),
      rotation: "daily",
      maxFiles: DEFAULT_LOG_MAX_FILES,
      mkdir: true,
    },
    {
      type: "file",
      level: "error",
      path: join(ENV.LOG_DIR, DEFAULT_ERROR_LOG_FILE),
      rotation: "daily",
      maxFiles: DEFAULT_LOG_MAX_FILES,
      mkdir: true,
    },
  ],
});

const redactUrl = (url: string): string => {
  try {
    const parsed = new URL(url);
    if (parsed.password) parsed.password = "***";
    if (parsed.username) parsed.username = "***";
    return parsed.toString();
  } catch {
    return "<invalid url>";
  }
};

const initializeApp = async (): Promise<void> => {
  const datasetConfig = DatasetLoaderService.loadDatasetConfig(
    ENV.ACTIVE_DATASET,
  );
  const { userId } = datasetConfig;

  RedisAgentMemory.create({
    ram: {
      endpoint: ENV.RAM_ENDPOINT,
      apiKey: ENV.RAM_API_KEY,
      storeId: ENV.RAM_STORE_ID,
    },
    llm: {
      model: ENV.BACKGROUND_MODEL,
      apiKey: ENV.OPENAI_API_KEY,
    },
  });

  const healthResult = await RedisAgentMemory.getInstance().health();

  logger.info("Redis Agent Memory connected", {
    endpoint: ENV.RAM_ENDPOINT,
    storeId: ENV.RAM_STORE_ID,
    status: healthResult.status,
  });

  const redis = RedisDb.create({ url: ENV.REDIS_URL, logger });
  await redis.connect();
  logger.info("Redis connected for copilot stores", {
    url: redactUrl(ENV.REDIS_URL),
  });

  const hasLangCacheConfig =
    ENV.LANGCACHE_ENABLED &&
    ENV.LANGCACHE_SERVER_URL &&
    ENV.LANGCACHE_CACHE_ID &&
    ENV.LANGCACHE_API_KEY;
  if (hasLangCacheConfig) {
    LangCache.create({
      serverURL: ENV.LANGCACHE_SERVER_URL,
      cacheId: ENV.LANGCACHE_CACHE_ID,
      apiKey: ENV.LANGCACHE_API_KEY,
    });
    const langCacheHealthy = await LangCache.getInstance().health();
    logger.info("LangCache initialized", {
      serverURL: ENV.LANGCACHE_SERVER_URL,
      healthy: langCacheHealthy,
    });
  }

  let ctxSurfaceId = "";
  let mcpAgentKey = "";

  const hasCtxAdminKey = ENV.CTX_ADMIN_KEY !== "";
  const hasContextSurfacesConfig = datasetConfig.contextSurfaces !== undefined;
  if (hasCtxAdminKey && hasContextSurfacesConfig) {
    const csResult = await initializeContextSurfaces(datasetConfig);
    ctxSurfaceId = csResult.surfaceId;
    mcpAgentKey = csResult.agentKey;
  } else {
    logger.info(
      "Context Surfaces integration skipped (missing CTX_ADMIN_KEY or dataset contextSurfaces config)",
    );
  }

  setAppState({
    datasetConfig,
    userId,
    ctxSurfaceId,
    mcpAgentKey,
  });

  logger.info("Backend ready", {
    dataset: ENV.ACTIVE_DATASET,
    userId,
    chatbotModel: ENV.CHATBOT_MODEL,
    backgroundModel: ENV.BACKGROUND_MODEL,
    contextWindowMax: ENV.CONTEXT_WINDOW_MAX,
    ctxSurfaceId: ctxSurfaceId || "(not configured)",
  });
};

const STATIC_DIR = resolve(__dirname, DEFAULT_STATIC_DIR);

const server = ApiServer.create({
  config: {
    PORT: ENV.PORT,
    ALLOWED_ORIGINS: ENV.ALLOWED_ORIGINS,
    RATE_LIMIT_MAX: DEFAULT_RATE_LIMIT_MAX,
    STATIC_DIR,
  },
  logger,
  routes,
  onAppStart: initializeApp,
  onAppStop: async () => {
    const redisDbInst = RedisDb.getInstance();
    const isRedisConnected = redisDbInst.isConnected();
    if (isRedisConnected) {
      await redisDbInst.close();
    }

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
