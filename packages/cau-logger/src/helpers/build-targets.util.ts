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
  DEFAULT_DATE_FORMAT,
  DEFAULT_BATCH_SIZE,
  DEFAULT_FLUSH_INTERVAL,
  DEFAULT_MONGO_COLLECTION,
  DEFAULT_SQL_TABLE,
} from "../constants";

const PINO_PRETTY_TARGET = "pino-pretty";
const PINO_FILE_TARGET = "pino/file";
const PINO_ROLL_TARGET = "pino-roll";
const MONGO_TRANSPORT_FILE = "mongo.transport.js";
const SQL_TRANSPORT_FILE = "sql.transport.js";
const TRANSPORTS_SUBDIR = "transports";
const STDOUT_FD = 1;
const STDERR_FD = 2;
const PRODUCTION_ENV = "production";

type PinoTarget = {
  target: string;
  level?: string;
  options: Record<string, unknown>;
};

const getTransportDir = (): string => {
  const dirnameTransports = join(__dirname, "..", TRANSPORTS_SUBDIR);
  const distTransports = join(process.cwd(), "dist", TRANSPORTS_SUBDIR);

  const hasDirnameMongo = existsSync(
    join(dirnameTransports, MONGO_TRANSPORT_FILE),
  );
  const hasDistMongo = existsSync(join(distTransports, MONGO_TRANSPORT_FILE));

  const useDist = !hasDirnameMongo && hasDistMongo;

  return useDist ? distTransports : dirnameTransports;
};

const TRANSPORT_DIR = getTransportDir();

const buildConsoleTarget = (config: ConsoleTransportConfig): PinoTarget => {
  const isPretty =
    config.format !== undefined
      ? config.format === LogFormat.PRETTY
      : ENV.NODE_ENV !== PRODUCTION_ENV;
  const dest =
    config.destination === OutputDestination.STDERR ? STDERR_FD : STDOUT_FD;

  const target: PinoTarget = isPretty
    ? {
        target: PINO_PRETTY_TARGET,
        level: config.level,
        options: {
          colorize: config.colorize ?? true,
          destination: dest,
        },
      }
    : {
        target: PINO_FILE_TARGET,
        level: config.level,
        options: { destination: dest },
      };

  return target;
};

const buildFileTarget = (config: FileTransportConfig): PinoTarget => {
  const frequency = config.rotation ?? RotationInterval.DAILY;
  const isTimeBased =
    frequency === RotationInterval.DAILY ||
    frequency === RotationInterval.HOURLY;

  return {
    target: PINO_ROLL_TARGET,
    level: config.level,
    options: {
      file: config.path,
      frequency,
      ...(isTimeBased
        ? { dateFormat: config.dateFormat ?? DEFAULT_DATE_FORMAT }
        : {}),
      ...(config.maxSize ? { size: config.maxSize } : {}),
      ...(config.maxFiles ? { limit: { count: config.maxFiles } } : {}),
      mkdir: config.mkdir ?? true,
    },
  };
};

const buildMongoTarget = (config: MongoTransportConfig): PinoTarget => ({
  target: join(TRANSPORT_DIR, MONGO_TRANSPORT_FILE),
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
  target: join(TRANSPORT_DIR, SQL_TRANSPORT_FILE),
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
