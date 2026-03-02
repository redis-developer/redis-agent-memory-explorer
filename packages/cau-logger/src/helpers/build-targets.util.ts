import { join } from "node:path";

import { ENV } from "../config";

import type {
  TransportConfig,
  ConsoleTransportConfig,
  FileTransportConfig,
  MongoTransportConfig,
  SqlTransportConfig,
} from "../types";
import {
  DEFAULT_BATCH_SIZE,
  DEFAULT_FLUSH_INTERVAL,
  DEFAULT_MONGO_COLLECTION,
  DEFAULT_SQL_TABLE,
} from "../constants";

type PinoTarget = {
  target: string;
  level?: string;
  options: Record<string, unknown>;
};

const TRANSPORT_DIR = join(__dirname, "..", "transports");

const buildConsoleTarget = (config: ConsoleTransportConfig): PinoTarget => {
  const isPretty = config.pretty ?? ENV.NODE_ENV !== "production";
  const dest = config.destination === "stderr" ? 2 : 1;

  if (isPretty) {
    return {
      target: "pino-pretty",
      level: config.level,
      options: {
        colorize: config.colorize ?? true,
        destination: dest,
      },
    };
  }

  return {
    target: "pino/file",
    level: config.level,
    options: { destination: dest },
  };
};

const buildFileTarget = (config: FileTransportConfig): PinoTarget => ({
  target: "pino-roll",
  level: config.level,
  options: {
    file: config.path,
    frequency: config.frequency ?? "daily",
    ...(config.maxSize ? { size: config.maxSize } : {}),
    ...(config.maxFiles ? { limit: { count: config.maxFiles } } : {}),
    mkdir: config.mkdir ?? true,
  },
});

const buildMongoTarget = (config: MongoTransportConfig): PinoTarget => ({
  target: join(TRANSPORT_DIR, "mongo.transport.js"),
  level: config.level,
  options: {
    uri: config.uri,
    database: config.database,
    collection: config.collection ?? DEFAULT_MONGO_COLLECTION,
    batchSize: config.batchSize ?? DEFAULT_BATCH_SIZE,
    flushInterval: config.flushInterval ?? DEFAULT_FLUSH_INTERVAL,
  },
});

const buildSqlTarget = (config: SqlTransportConfig): PinoTarget => ({
  target: join(TRANSPORT_DIR, "sql.transport.js"),
  level: config.level,
  options: {
    knexConfig: config.knexConfig,
    table: config.table ?? DEFAULT_SQL_TABLE,
    batchSize: config.batchSize ?? DEFAULT_BATCH_SIZE,
    flushInterval: config.flushInterval ?? DEFAULT_FLUSH_INTERVAL,
  },
});

const buildTarget = (config: TransportConfig): PinoTarget => {
  switch (config.type) {
    case "console":
      return buildConsoleTarget(config);
    case "file":
      return buildFileTarget(config);
    case "mongo":
      return buildMongoTarget(config);
    case "sql":
      return buildSqlTarget(config);
  }
};

const buildTargets = (transports: TransportConfig[]): PinoTarget[] =>
  transports.map(buildTarget);

export { buildTargets, buildTarget };
export type { PinoTarget };
