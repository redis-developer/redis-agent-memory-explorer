import type {
  TransportConfig,
  ConsoleTransportConfig,
  FileTransportConfig,
  MongoTransportConfig,
  SqlTransportConfig,
} from "../types";

import { join } from "node:path";
import { existsSync } from "node:fs";

import { ENV } from "../config";
import {
  LogFormat,
  OutputDestination,
  RotationInterval,
  TransportType,
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

const getTransportDir = (): string => {
  const dirnameTransports = join(__dirname, "..", "transports");
  const mongoInDirname = join(dirnameTransports, "mongo.transport.js");
  if (existsSync(mongoInDirname)) {
    return dirnameTransports;
  }
  const distTransports = join(process.cwd(), "dist", "transports");
  const mongoInDist = join(distTransports, "mongo.transport.js");
  if (existsSync(mongoInDist)) {
    return distTransports;
  }
  return dirnameTransports;
};

const TRANSPORT_DIR = getTransportDir();

const buildConsoleTarget = (config: ConsoleTransportConfig): PinoTarget => {
  const isPretty =
    config.format !== undefined
      ? config.format === LogFormat.PRETTY
      : ENV.NODE_ENV !== "production";
  const dest = config.destination === OutputDestination.STDERR ? 2 : 1;

  const target: PinoTarget = isPretty
    ? {
        target: "pino-pretty",
        level: config.level,
        options: {
          colorize: config.colorize ?? true,
          destination: dest,
        },
      }
    : {
        target: "pino/file",
        level: config.level,
        options: { destination: dest },
      };

  return target;
};

const buildFileTarget = (config: FileTransportConfig): PinoTarget => ({
  target: "pino-roll",
  level: config.level,
  options: {
    file: config.path,
    frequency: config.rotation ?? RotationInterval.DAILY,
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
    knexConfig: config.connection,
    table: config.table ?? DEFAULT_SQL_TABLE,
    batchSize: config.batchSize ?? DEFAULT_BATCH_SIZE,
    flushInterval: config.flushInterval ?? DEFAULT_FLUSH_INTERVAL,
  },
});

const buildTarget = (config: TransportConfig): PinoTarget => {
  let target: PinoTarget;
  switch (config.type) {
    case TransportType.CONSOLE:
      target = buildConsoleTarget(config);
      break;
    case TransportType.FILE:
      target = buildFileTarget(config);
      break;
    case TransportType.MONGO:
      target = buildMongoTarget(config);
      break;
    case TransportType.SQL:
      target = buildSqlTarget(config);
      break;
  }
  return target;
};

const buildTargets = (transports: TransportConfig[]): PinoTarget[] =>
  transports.map(buildTarget);

export { buildTargets, buildTarget };
export type { PinoTarget };
