import type { CreateSurfaceInput } from "cau-context-surfaces";
import type {
  ClientDataFile,
  DatasetConfig,
  ParsedRedisUrl,
  SetupResult,
} from "../types";

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ContextSurfaces } from "cau-context-surfaces";
import { Logger } from "cau-logger";

import { ENV } from "../config";
import {
  CLIENT_DATA_FILENAME,
  CTX_DATA_SOURCE_NAME,
  CTX_DATA_SOURCE_TYPE,
  DEFAULT_REDIS_PORT,
  DEFAULT_REDIS_USERNAME,
  REDIS_TLS_PROTOCOL,
  SURFACE_SETUP_POLL_INTERVAL_MS,
  SURFACE_SETUP_POLL_TIMEOUT_MS,
} from "../constants";

let _logger: ReturnType<typeof Logger.getInstance> | null = null;
const getLogger = () => {
  if (!_logger)
    _logger = Logger.getInstance().child({ component: "ContextSurfacesSetup" });
  return _logger;
};

const parseRedisUrl = (url: string): ParsedRedisUrl => {
  const parsed = new URL(url);
  const host = parsed.hostname;
  const port = parsed.port || DEFAULT_REDIS_PORT;
  const tls = parsed.protocol === REDIS_TLS_PROTOCOL;
  const dbPath = parsed.pathname.replace("/", "");
  const db = dbPath ? parseInt(dbPath, 10) : 0;

  return {
    addr: `${host}:${port}`,
    username: parsed.username || DEFAULT_REDIS_USERNAME,
    password: parsed.password,
    tls,
    db,
  };
};

const loadClientDataFile = (datasetId: string): ClientDataFile => {
  const filePath = join(ENV.DATA_DIR, datasetId, CLIENT_DATA_FILENAME);
  const fileExists = existsSync(filePath);

  if (!fileExists) {
    throw new Error(`Client data file not found: ${filePath}`);
  }

  const raw = readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(raw) as ClientDataFile;

  return parsed;
};

const waitForSurfaceActive = async (
  cs: ContextSurfaces,
  surfaceId: string,
): Promise<void> => {
  const logger = getLogger();
  const startMs = Date.now();
  let settled = false;
  let error: Error | null = null;

  while (!settled && Date.now() - startMs < SURFACE_SETUP_POLL_TIMEOUT_MS) {
    const surface = await cs.getSurface(surfaceId);
    const isActive = surface.status === "active";
    const isFailed =
      surface.status === "failed" || surface.status === "indices_failed";

    if (isActive) {
      logger.info("Surface is active", {
        surfaceId,
        waitMs: Date.now() - startMs,
      });
      settled = true;
    } else if (isFailed) {
      error = new Error(
        `Surface entered terminal status: ${surface.status} (${surface.statusReason ?? "unknown"})`,
      );
      settled = true;
    } else {
      logger.info("Waiting for surface to become active", {
        surfaceId,
        currentStatus: surface.status,
      });
      await new Promise((resolve) =>
        setTimeout(resolve, SURFACE_SETUP_POLL_INTERVAL_MS),
      );
    }
  }

  if (!settled) {
    error = new Error(
      `Surface did not become active within ${SURFACE_SETUP_POLL_TIMEOUT_MS}ms`,
    );
  }

  if (error) {
    throw error;
  }
};

const createAndLoadSurface = async (
  cs: ContextSurfaces,
  datasetConfig: DatasetConfig,
): Promise<SetupResult> => {
  const logger = getLogger();
  const csConfig = datasetConfig.contextSurfaces;

  const hasNoConfig = csConfig === undefined;
  if (hasNoConfig) {
    throw new Error("Dataset config missing contextSurfaces section");
  }

  const clientData = loadClientDataFile(datasetConfig.id);
  const redis = parseRedisUrl(ENV.REDIS_URL);
  const surfaceName = `${csConfig.surfaceName}-${Date.now()}`;

  const surfaceInput: CreateSurfaceInput = {
    name: surfaceName,
    description: `Structured client data for ${datasetConfig.name}`,
    dataModel: clientData.dataModel,
    dataSource: {
      type: CTX_DATA_SOURCE_TYPE,
      name: CTX_DATA_SOURCE_NAME,
      connectionConfig: {
        addr: redis.addr,
        username: redis.username,
        password: redis.password,
        db: redis.db,
        tlsEnabled: redis.tls,
        poolSize: 5,
        minIdleConns: 1,
      },
    },
  };

  logger.info("Creating context surface", { surfaceName });
  const surface = await cs.createSurface(surfaceInput);
  const surfaceId = surface.id;
  logger.info("Surface created", { surfaceId, surfaceName });

  await waitForSurfaceActive(cs, surfaceId);

  const entities = Object.entries(clientData.records);
  for (const [entity, records] of entities) {
    const result = await cs.loadRecords(surfaceId, { entity, records });
    logger.info("Records loaded", { entity, loaded: result.loaded });
  }

  logger.info("Creating agent key");
  const agentKey = await cs.createAgentKey(surfaceId, {
    name: `chatbot-agent-key-${Date.now()}`,
  });

  logger.info("---");
  logger.info("Context Surfaces setup complete. Add these to .env to reuse:");
  logger.info(`  CTX_SURFACE_ID=${surfaceId}`);
  logger.info(`  MCP_AGENT_KEY=${agentKey.key}`);
  logger.info("---");

  return { surfaceId, agentKey: agentKey.key };
};

const initializeContextSurfaces = async (
  datasetConfig: DatasetConfig,
): Promise<SetupResult> => {
  const logger = getLogger();
  const hasNoAdminKey = !ENV.CTX_ADMIN_KEY;
  if (hasNoAdminKey) {
    throw new Error(
      "CTX_ADMIN_KEY is required for Context Surfaces integration",
    );
  }

  const cs = ContextSurfaces.create({
    adminKey: ENV.CTX_ADMIN_KEY,
    adminApiUrl: ENV.CTX_ADMIN_API_URL || undefined,
    mcpUrl: ENV.CTX_MCP_URL || undefined,
  });

  const hasExistingSurface =
    ENV.CTX_SURFACE_ID !== "" && ENV.MCP_AGENT_KEY !== "";

  let result: SetupResult;
  if (hasExistingSurface) {
    cs.setAgentKey(ENV.MCP_AGENT_KEY);
    logger.info("Reusing existing context surface", {
      surfaceId: ENV.CTX_SURFACE_ID,
      agentKeyPrefix: ENV.MCP_AGENT_KEY.slice(0, 12) + "...",
    });
    result = { surfaceId: ENV.CTX_SURFACE_ID, agentKey: ENV.MCP_AGENT_KEY };
  } else {
    logger.info(
      "No existing surface found, creating new surface and loading data",
    );
    result = await createAndLoadSurface(cs, datasetConfig);
    cs.setAgentKey(result.agentKey);
  }

  return result;
};

export { initializeContextSurfaces };
