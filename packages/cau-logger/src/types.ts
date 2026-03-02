import type {
  LogLevel,
  LogFormat,
  OutputDestination,
  RotationInterval,
} from "./constants";

import { TransportType } from "./constants";

type LogMethod = (msg: string, data?: Record<string, unknown>) => void;

type ConsoleTransportConfig = {
  type: typeof TransportType.CONSOLE;
  level?: LogLevel;
  format?: LogFormat;
  colorize?: boolean;
  destination?: OutputDestination;
};

type FileTransportConfig = {
  type: typeof TransportType.FILE;
  level?: LogLevel;
  path: string;
  rotation?: RotationInterval | number;
  maxSize?: string | number;
  maxFiles?: number;
  mkdir?: boolean;
};

type MongoTransportConfig = {
  type: typeof TransportType.MONGO;
  level?: LogLevel;
  uri: string;
  database: string;
  collection?: string;
  batchSize?: number;
  flushInterval?: number;
};

type SqlTransportConfig = {
  type: typeof TransportType.SQL;
  level?: LogLevel;
  connection: Record<string, unknown>;
  table?: string;
  batchSize?: number;
  flushInterval?: number;
};

type TransportConfig =
  | ConsoleTransportConfig
  | FileTransportConfig
  | MongoTransportConfig
  | SqlTransportConfig;

type LoggerConfig = {
  level?: LogLevel;
  context?: string;
  redact?: string[];
  transports?: TransportConfig[];
  timestamp?: boolean;
};

type MongoTransportOptions = {
  uri: string;
  database: string;
  collection: string;
  batchSize: number;
  flushInterval: number;
};

type SqlTransportOptions = {
  knexConfig: Record<string, unknown>;
  table: string;
  batchSize: number;
  flushInterval: number;
};

export type {
  LogMethod,
  ConsoleTransportConfig,
  FileTransportConfig,
  MongoTransportConfig,
  SqlTransportConfig,
  TransportConfig,
  LoggerConfig,
  MongoTransportOptions,
  SqlTransportOptions,
};
